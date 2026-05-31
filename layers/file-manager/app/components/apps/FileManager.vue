<script setup lang="ts">
import type { FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'

defineProps<{ windowId: string }>()

const currentPath = ref('/')
const selectedItemPath = ref<string | null>(null)
const showSidebar = ref(true)
const isLoading = ref(false)
const rootLoading = ref(false)
const entries = ref<FileSystemEntry[]>([])
const rootDirectories = ref<FileSystemEntry[]>([])
const localError = ref<string | null>(null)
const addingMount = ref(false)
const creatingEntry = ref(false)

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()

const mountOptions = computed(() =>
  fileSystem.mounts.value.map(mount => ({
    label: mount.name,
    value: mount.id
  }))
)

const selectedMountId = computed({
  get: (): string => fileSystem.activeMountId.value ?? '',
  set: (mountId: string) => {
    void fileSystem.setActiveMount(mountId || null)
  }
})

const hasMount = computed(() => !!fileSystem.activeMountId.value)

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.fileManager.errorGeneric')
}

function buildPath(name: string): string {
  return fileSystem.resolvePath(currentPath.value, name)
}

async function loadEntries(): Promise<void> {
  if (!fileSystem.activeMountId.value) {
    entries.value = []
    return
  }

  isLoading.value = true
  localError.value = null
  try {
    entries.value = await fileSystem.listDirectory(currentPath.value, fileSystem.activeMountId.value)
  } catch (error) {
    localError.value = toErrorMessage(error)
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

async function loadRootDirectories(): Promise<void> {
  if (!fileSystem.activeMountId.value) {
    rootDirectories.value = []
    return
  }

  rootLoading.value = true
  try {
    const rootEntries = await fileSystem.listDirectory('/', fileSystem.activeMountId.value)
    rootDirectories.value = rootEntries.filter(entry => entry.kind === 'directory')
  } catch {
    rootDirectories.value = []
  } finally {
    rootLoading.value = false
  }
}

async function reloadAll(): Promise<void> {
  await Promise.all([loadEntries(), loadRootDirectories()])
}

async function handleAddMount(): Promise<void> {
  addingMount.value = true
  try {
    const mount = await fileSystem.addMount()
    if (mount) {
      notify(t('apps.fileManager.mountAdded', { name: mount.name }), { type: 'success' })
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    addingMount.value = false
    await reloadAll()
  }
}

/** UBreadcrumb 用リンク配列 */
const breadcrumbLinks = computed(() => {
  if (currentPath.value === '/') {
    return [{ label: '/', onClick: () => goTo('/') }]
  }
  const parts = currentPath.value.slice(1).split('/')
  return [
    { label: '/', onClick: () => goTo('/') },
    ...parts.map((part, i) => ({
      label: part,
      onClick: () => goTo('/' + parts.slice(0, i + 1).join('/'))
    }))
  ]
})

/** UContextMenu のアイテム */
const contextMenuItems = computed(() => (entry: FileSystemEntry) => [
  [
    {
      label: t('apps.fileManager.open'),
      icon: entry.kind === 'directory' ? 'i-lucide-folder-open' : 'i-lucide-file-text',
      onSelect: () => navigate(entry)
    }
  ],
  [
    {
      label: t('apps.fileManager.rename'),
      icon: 'i-lucide-pencil',
      onSelect: () => {
        void renameEntry(entry)
      }
    },
    {
      label: t('apps.fileManager.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => {
        void deleteEntry(entry)
      }
    }
  ]
])

async function createFolder(): Promise<void> {
  if (!fileSystem.activeMountId.value) return
  const name = window.prompt(t('apps.fileManager.newFolderPrompt'))?.trim()
  if (!name) return

  creatingEntry.value = true
  try {
    await fileSystem.mkdir(buildPath(name), fileSystem.activeMountId.value, false)
    await reloadAll()
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    creatingEntry.value = false
  }
}

async function createFile(): Promise<void> {
  if (!fileSystem.activeMountId.value) return
  const name = window.prompt(t('apps.fileManager.newFilePrompt'))?.trim()
  if (!name) return

  creatingEntry.value = true
  try {
    await fileSystem.touch(buildPath(name), fileSystem.activeMountId.value)
    await reloadAll()
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    creatingEntry.value = false
  }
}

async function renameEntry(entry: FileSystemEntry): Promise<void> {
  if (!fileSystem.activeMountId.value) return
  const nextName = window.prompt(t('apps.fileManager.renamePrompt'), entry.name)?.trim()
  if (!nextName || nextName === entry.name) return

  try {
    await fileSystem.rename(entry.path, nextName, fileSystem.activeMountId.value)
    await reloadAll()
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function deleteEntry(entry: FileSystemEntry): Promise<void> {
  if (!fileSystem.activeMountId.value) return
  const accepted = window.confirm(t('apps.fileManager.deleteConfirm', { name: entry.name }))
  if (!accepted) return

  try {
    await fileSystem.deleteEntry(entry.path, fileSystem.activeMountId.value, entry.kind === 'directory')
    await reloadAll()
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

function navigate(entry: FileSystemEntry): void {
  if (entry.kind !== 'directory') return
  currentPath.value = entry.path
  selectedItemPath.value = null
}

function goTo(path: string): void {
  currentPath.value = path
  selectedItemPath.value = null
}

function goUp(): void {
  if (currentPath.value === '/') return
  const parts = currentPath.value.slice(1).split('/')
  parts.pop()
  goTo(parts.length > 0 ? `/${parts.join('/')}` : '/')
}

watch(() => fileSystem.activeMountId.value, async () => {
  currentPath.value = '/'
  selectedItemPath.value = null
  await reloadAll()
})

watch(currentPath, async () => {
  await loadEntries()
})

onMounted(async () => {
  await fileSystem.restoreMounts()
  await reloadAll()
})
</script>

<template>
  <div class="file-manager">
    <!-- toolbar -->
    <div class="toolbar">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-panel-left"
        :aria-label="$t('apps.fileManager.sidebar')"
        @click="showSidebar = !showSidebar"
      />
      <USelect
        v-model="selectedMountId"
        :items="mountOptions"
        value-key="value"
        class="mount-select"
        :placeholder="$t('apps.fileManager.mount')"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="primary"
        icon="i-lucide-folder-plus"
        :label="$t('apps.fileManager.addMount')"
        :loading="addingMount"
        @click="handleAddMount"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        :disabled="currentPath === '/'"
        :label="$t('apps.fileManager.up')"
        @click="goUp"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-refresh-cw"
        :label="$t('apps.fileManager.refresh')"
        :loading="isLoading"
        @click="reloadAll"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-folder-plus"
        :label="$t('apps.fileManager.newFolder')"
        :disabled="!hasMount"
        :loading="creatingEntry"
        @click="createFolder"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-file-plus"
        :label="$t('apps.fileManager.newFile')"
        :disabled="!hasMount"
        :loading="creatingEntry"
        @click="createFile"
      />
      <UBreadcrumb
        :links="breadcrumbLinks"
        class="breadcrumb"
      />
    </div>

    <UAlert
      v-if="!fileSystem.isSupported.value"
      icon="i-lucide-info"
      color="neutral"
      variant="soft"
      :description="$t('apps.fileManager.unsupported')"
      class="state-alert"
    />

    <UAlert
      v-else-if="!hasMount"
      icon="i-lucide-folder-search"
      color="neutral"
      variant="soft"
      :description="$t('apps.fileManager.noMounts')"
      class="state-alert"
    />

    <UAlert
      v-if="localError"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="soft"
      :description="localError"
      class="state-alert"
    />

    <!-- main area -->
    <div
      v-if="fileSystem.isSupported.value && hasMount"
      class="main-area"
    >
      <!-- sidebar -->
      <Transition name="sidebar-slide">
        <div
          v-if="showSidebar"
          class="sidebar"
        >
          <p class="sidebar-title">
            {{ $t('apps.fileManager.rootDirectories') }}
          </p>
          <div
            v-if="rootLoading"
            class="sidebar-empty"
          >
            {{ $t('apps.fileManager.loading') }}
          </div>
          <div
            v-else-if="rootDirectories.length === 0"
            class="sidebar-empty"
          >
            {{ $t('apps.fileManager.empty') }}
          </div>
          <button
            v-for="entry in rootDirectories"
            :key="entry.path"
            class="sidebar-item"
            :class="currentPath === entry.path ? 'active' : ''"
            @click="goTo(entry.path)"
          >
            <UIcon name="i-lucide-folder" />
            <span>{{ entry.name }}</span>
          </button>
        </div>
      </Transition>

      <!-- file grid -->
      <div class="file-grid">
        <div
          v-if="isLoading"
          class="empty"
        >
          {{ $t('apps.fileManager.loading') }}
        </div>
        <div
          v-else-if="entries.length === 0"
          class="empty"
        >
          {{ $t('apps.fileManager.empty') }}
        </div>
        <div
          v-else
          class="grid"
        >
          <UContextMenu
            v-for="entry in entries"
            :key="entry.name"
            :items="contextMenuItems(entry)"
          >
            <button
              class="file-item"
              :class="selectedItemPath === entry.path ? 'selected' : ''"
              @click="selectedItemPath = entry.path"
              @dblclick="navigate(entry)"
            >
              <UIcon
                :name="entry.kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-file-text'"
                :class="['file-icon', entry.kind === 'directory' ? 'icon-dir' : 'icon-file']"
              />
              <span>{{ entry.name }}</span>
            </button>
          </UContextMenu>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <span>{{ currentPath }}</span>
      <span>{{ entries.length }} {{ $t('apps.fileManager.items') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.file-manager {
  display: flex;
  flex-direction: column;
  height: 100%;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;
  }

  .mount-select {
    min-width: 12rem;
  }

  .breadcrumb {
    flex: 1 1 0%;
    min-width: 0;
    overflow-x: auto;
    font-size: 0.75rem;
  }

  .main-area {
    display: flex;
    flex: 1 1 0%;
    min-height: 0;
    overflow: hidden;
  }

  .sidebar {
    width: 11rem;
    flex-shrink: 0;
    overflow-y: auto;
    border-right: 1px solid var(--ui-border);
    padding: 0.5rem;
    background: var(--ui-bg-elevated);

    .sidebar-title {
      font-size: 0.75rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: var(--ui-text-muted);
    }

    .sidebar-empty {
      font-size: 0.75rem;
      color: var(--ui-text-muted);
      padding: 0.5rem 0;
    }

    .sidebar-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border: none;
      background: transparent;
      color: inherit;
      border-radius: var(--ui-radius);
      padding: 0.375rem 0.5rem;
      cursor: pointer;
      text-align: left;

      &:hover {
        background: var(--ui-bg);
      }

      &.active {
        background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.75rem;
      }
    }
  }

  // サイドバー スライドアニメーション
  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active {
    transition: width 0.2s ease, opacity 0.2s ease;
    overflow: hidden;
  }

  .sidebar-slide-enter-from,
  .sidebar-slide-leave-to {
    width: 0;
    opacity: 0;
  }

  .file-grid {
    flex: 1 1 0%;
    overflow: auto;
    padding: 0.75rem;

    .empty {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      color: var(--ui-text-muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 0.75rem;
    }
  }

  .file-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: none;
    background: none;
    border-radius: var(--ui-radius);
    cursor: pointer;
    text-align: center;
    transition: background-color 0.1s;
    color: inherit;
    width: 100%;

    &:hover {
      background: var(--ui-bg-elevated);
    }

    &.selected {
      background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
      box-shadow: 0 0 0 1px var(--ui-primary);
    }

    .file-icon {
      font-size: 1.875rem;
    }

    .icon-dir {
      color: var(--ui-primary);
    }

    .icon-file {
      color: var(--ui-text-muted);
    }

    span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.75rem;
    }
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    padding: 0.25rem 0.75rem;
    border-top: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    font-size: 0.75rem;
    color: var(--ui-text-muted);

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .state-alert {
    margin: 0.5rem;
  }
}
</style>
