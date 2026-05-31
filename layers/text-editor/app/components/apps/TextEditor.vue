<script setup lang="ts">
import type { FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'

defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()

const content = ref('')
const filename = ref('untitled.md')
const currentFilePath = ref<string | null>(null)
const isDirty = ref(false)
const isSaving = ref(false)
const isLoadingEntries = ref(false)
const localError = ref<string | null>(null)
const browserPath = ref('/')
const entries = ref<FileSystemEntry[]>([])
const addingMount = ref(false)
const showBrowser = ref(true)
const suppressDirty = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(960)

const isCompact = computed(() => containerWidth.value < 860)

const mountOptions = computed(() =>
  fileSystem.mounts.value.map(mount => ({
    label: mount.name,
    value: mount.id
  }))
)

const hasMount = computed(() => !!fileSystem.activeMountId.value)

const selectedMountId = computed({
  get: (): string => fileSystem.activeMountId.value ?? '',
  set: (mountId: string) => {
    void fileSystem.setActiveMount(mountId || null)
  }
})

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.textEditor.errorGeneric')
}

function formatEntryName(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.at(-1) ?? 'untitled.md'
}

function resetEditor(): void {
  suppressDirty.value = true
  content.value = ''
  currentFilePath.value = null
  filename.value = 'untitled.md'
  isDirty.value = false
}

async function loadEntries(): Promise<void> {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) {
    entries.value = []
    return
  }

  isLoadingEntries.value = true
  localError.value = null
  try {
    entries.value = await fileSystem.listDirectory(browserPath.value, mountId)
  } catch (error) {
    localError.value = toErrorMessage(error)
    entries.value = []
  } finally {
    isLoadingEntries.value = false
  }
}

function goTo(path: string): void {
  browserPath.value = path
}

function goUp(): void {
  if (browserPath.value === '/') return
  const parts = browserPath.value.split('/').filter(Boolean)
  parts.pop()
  browserPath.value = parts.length > 0 ? `/${parts.join('/')}` : '/'
}

async function openEntry(entry: FileSystemEntry): Promise<void> {
  if (entry.kind === 'directory') {
    goTo(entry.path)
    return
  }

  if (isDirty.value) {
    const ok = window.confirm(t('apps.textEditor.discardConfirm'))
    if (!ok) return
  }

  const mountId = fileSystem.activeMountId.value
  if (!mountId) return

  localError.value = null
  try {
    const text = await fileSystem.readTextFile(entry.path, mountId)
    suppressDirty.value = true
    content.value = text
    currentFilePath.value = entry.path
    filename.value = entry.name
    isDirty.value = false
    if (isCompact.value) showBrowser.value = false
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function saveFile(): Promise<void> {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) return

  let targetPath = currentFilePath.value
  if (!targetPath) {
    const requestedName = window.prompt(t('apps.textEditor.newFilePrompt'), filename.value)?.trim()
    if (!requestedName) return
    targetPath = fileSystem.resolvePath(browserPath.value, requestedName)
  }

  isSaving.value = true
  localError.value = null
  try {
    await fileSystem.writeTextFile(targetPath, content.value, mountId)
    currentFilePath.value = targetPath
    filename.value = formatEntryName(targetPath)
    isDirty.value = false
    notify(t('apps.textEditor.saved', { name: filename.value }), { type: 'success' })
    await loadEntries()
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

function createNewDocument(): void {
  if (isDirty.value) {
    const ok = window.confirm(t('apps.textEditor.discardConfirm'))
    if (!ok) return
  }
  resetEditor()
}

async function handleAddMount(): Promise<void> {
  addingMount.value = true
  try {
    const mount = await fileSystem.addMount()
    if (mount) {
      notify(t('apps.textEditor.mountAdded', { name: mount.name }), { type: 'success' })
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    addingMount.value = false
  }
}

watch(content, () => {
  if (suppressDirty.value) {
    suppressDirty.value = false
    return
  }
  isDirty.value = true
})

watch(isCompact, (compact) => {
  if (compact) showBrowser.value = false
})

watch(() => fileSystem.activeMountId.value, async () => {
  browserPath.value = '/'
  resetEditor()
  await loadEntries()
})

watch(browserPath, async () => {
  await loadEntries()
})

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    ro.observe(containerRef.value)
    onUnmounted(() => ro.disconnect())
  }

  await fileSystem.restoreMounts()
  await loadEntries()
})
</script>

<template>
  <div
    ref="containerRef"
    class="text-editor"
  >
    <div class="toolbar">
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-panel-left"
        :label="isCompact ? undefined : $t('apps.textEditor.browser')"
        @click="showBrowser = !showBrowser"
      />
      <USelect
        v-model="selectedMountId"
        :items="mountOptions"
        value-key="value"
        class="mount-select"
        :placeholder="$t('apps.textEditor.mount')"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="primary"
        icon="i-lucide-folder-plus"
        :label="isCompact ? undefined : $t('apps.textEditor.addMount')"
        :loading="addingMount"
        @click="handleAddMount"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-up"
        :label="isCompact ? undefined : $t('apps.textEditor.up')"
        :disabled="!hasMount || browserPath === '/'"
        @click="goUp"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-file-plus"
        :label="isCompact ? undefined : $t('apps.textEditor.new')"
        @click="createNewDocument"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-save"
        :label="$t('apps.textEditor.save')"
        :loading="isSaving"
        :disabled="!hasMount"
        @click="saveFile"
      />
      <span class="filename">
        {{ filename }}<span
          v-if="isDirty"
          class="dirty"
        >*</span>
      </span>
    </div>

    <UAlert
      v-if="!fileSystem.isSupported.value"
      icon="i-lucide-info"
      color="neutral"
      variant="soft"
      :description="$t('apps.textEditor.unsupported')"
      class="state-alert"
    />

    <UAlert
      v-else-if="!hasMount"
      icon="i-lucide-folder-search"
      color="neutral"
      variant="soft"
      :description="$t('apps.textEditor.noMounts')"
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

    <div
      v-if="showBrowser && isCompact"
      class="browser-backdrop"
      @click="showBrowser = false"
    />

    <div class="body">
      <Transition name="browser-slide">
        <aside
          v-if="showBrowser && hasMount && fileSystem.isSupported.value"
          class="browser"
          :class="{ compact: isCompact }"
        >
          <div class="browser-head">
            <p class="browser-path">
              {{ browserPath }}
            </p>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-refresh-cw"
              :label="$t('apps.textEditor.refresh')"
              :loading="isLoadingEntries"
              @click="loadEntries"
            />
          </div>

          <div
            v-if="isLoadingEntries"
            class="browser-empty"
          >
            {{ $t('apps.textEditor.loading') }}
          </div>

          <div
            v-else-if="entries.length === 0"
            class="browser-empty"
          >
            {{ $t('apps.textEditor.empty') }}
          </div>

          <button
            v-for="entry in entries"
            :key="entry.path"
            class="browser-item"
            @click="openEntry(entry)"
          >
            <UIcon :name="entry.kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-file-text'" />
            <span>{{ entry.name }}</span>
          </button>
        </aside>
      </Transition>

      <div class="editor-wrap">
        <div class="editor-head">
          <span>{{ currentFilePath ?? $t('apps.textEditor.unsaved') }}</span>
        </div>
        <UEditor
          v-model="content"
          content-type="markdown"
          class="editor"
        >
          <template #default="{ editor }">
            <UEditorToolbar
              :editor="editor"
              layout="fixed"
            />
          </template>
        </UEditor>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.text-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;

    .mount-select {
      min-width: 12rem;
      max-width: 16rem;
    }

    .filename {
      margin-left: auto;
      font-size: 0.75rem;
      color: var(--ui-text-muted);
    }

    .dirty {
      color: var(--ui-warning);
    }
  }

  .state-alert {
    margin: 0.5rem;
  }

  .body {
    flex: 1 1 0%;
    min-height: 0;
    display: flex;
    overflow: hidden;
  }

  .browser {
    width: 15rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);

    &.compact {
      position: absolute;
      inset: 0 auto 0 0;
      width: min(85%, 20rem);
      z-index: 20;
      box-shadow: 0 12px 24px rgb(0 0 0 / 25%);
    }

    .browser-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: space-between;
      padding: 0.625rem;
      border-bottom: 1px solid var(--ui-border);
    }

    .browser-path {
      margin: 0;
      font-size: 0.75rem;
      color: var(--ui-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .browser-empty {
      padding: 0.75rem;
      font-size: 0.75rem;
      color: var(--ui-text-muted);
    }

    .browser-item {
      border: none;
      background: transparent;
      color: inherit;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-align: left;
      padding: 0.5rem 0.625rem;
      cursor: pointer;

      &:hover {
        background: var(--ui-bg);
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.8125rem;
      }
    }
  }

  .editor-wrap {
    flex: 1 1 0%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .editor-head {
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    color: var(--ui-text-muted);
    font-size: 0.75rem;

    span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .editor {
    flex: 1 1 0%;
    min-height: 0;
    overflow: auto;
  }

  .browser-backdrop {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 30%);
    z-index: 10;
  }
}

.browser-slide-enter-active,
.browser-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.browser-slide-enter-from,
.browser-slide-leave-to {
  transform: translateX(-8px);
  opacity: 0;
}
</style>
