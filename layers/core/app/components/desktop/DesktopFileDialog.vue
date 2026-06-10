<script setup lang="ts">
import { useFileDialogStore } from '../../stores/file-dialog'
import type { FileSystemEntry } from '../../stores/filesystem'

const store = useFileDialogStore()
const fileSystem = useFileSystem()
const { t } = useI18n()

const {
  isOpen,
  title,
  mode,
  filters,
  multiple,
  cwd,
  selectedPaths,
  fileNameInput,
  confirm,
  cancel
} = useFileDialog()

const currentLayout = ref<'grid' | 'list'>('grid')
const entries = ref<FileSystemEntry[]>([])
const isLoading = ref(false)
const localError = ref<string | null>(null)
const favorites = ref<string[]>([])
const searchQuery = ref('')
const backStack = ref<string[]>([])

const open = computed({
  get: () => isOpen.value,
  set: (val: boolean) => {
    if (!val) {
      cancel()
    }
  }
})

const activeMountId = computed(() => fileSystem.activeMountId.value)

const breadcrumbLinks = computed(() => {
  if (cwd.value === '/') {
    return [{ label: '/', onClick: () => goTo('/') }]
  }
  const parts = cwd.value.split('/').filter(Boolean)
  return [
    { label: '/', onClick: () => goTo('/') },
    ...parts.map((part, i) => ({
      label: part,
      onClick: () => goTo('/' + parts.slice(0, i + 1).join('/'))
    }))
  ]
})

function loadFavorites() {
  const saved = localStorage.getItem('file-manager-favorites')
  if (saved) {
    favorites.value = JSON.parse(saved)
  } else {
    favorites.value = ['/']
  }
}

async function loadEntries() {
  const mountId = activeMountId.value
  if (!mountId) {
    entries.value = []
    return
  }
  isLoading.value = true
  localError.value = null
  try {
    const list = await fileSystem.listDirectory(cwd.value, mountId)
    entries.value = list
  } catch (err) {
    localError.value = err instanceof Error ? err.message : t('apps.fileManager.errorGeneric')
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

const filteredEntries = computed(() => {
  let list = entries.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e => e.name.toLowerCase().includes(q))
  }

  if (filters.value && filters.value.length > 0) {
    list = list.filter((e) => {
      if (e.kind === 'directory') return true
      const lowerPath = e.path.toLowerCase()
      return filters.value.some(ext => lowerPath.endsWith(ext.toLowerCase()))
    })
  }

  return list
})

function goTo(path: string) {
  if (cwd.value === path) return
  backStack.value.push(cwd.value)
  store.cwd = path
  store.selectedPaths = []
}

function goBack() {
  if (backStack.value.length === 0) return
  const prev = backStack.value.pop()!
  store.cwd = prev
  store.selectedPaths = []
}

function goUp() {
  if (cwd.value === '/') return
  const parts = cwd.value.split('/').filter(Boolean)
  parts.pop()
  goTo('/' + parts.join('/'))
}

function toggleSelect(entry: FileSystemEntry) {
  if (entry.kind === 'directory') {
    if (mode.value === 'open-directory') {
      store.selectedPaths = [entry.path]
    }
  } else {
    if (mode.value === 'save-file') {
      fileNameInput.value = entry.name
      store.selectedPaths = [entry.path]
    } else {
      if (multiple.value) {
        if (store.selectedPaths.includes(entry.path)) {
          store.selectedPaths = store.selectedPaths.filter(p => p !== entry.path)
        } else {
          store.selectedPaths.push(entry.path)
        }
      } else {
        store.selectedPaths = [entry.path]
      }
    }
  }
}

function handleDoubleClick(entry: FileSystemEntry) {
  if (entry.kind === 'directory') {
    goTo(entry.path)
  } else {
    if (mode.value !== 'save-file') {
      store.selectedPaths = [entry.path]
      handleConfirm()
    }
  }
}

function handleConfirm() {
  const mountId = activeMountId.value
  if (!mountId) return
  confirm(mountId)
}

function handleCancel() {
  cancel()
}

watch(cwd, async () => {
  await loadEntries()
})

watch(activeMountId, async () => {
  store.cwd = '/'
  backStack.value = []
  await loadEntries()
})

watch(isOpen, (openVal) => {
  if (openVal) {
    loadFavorites()
    void loadEntries()
    searchQuery.value = ''
    backStack.value = []
  }
})

function getFileIcon(entry: FileSystemEntry): string {
  if (entry.kind === 'directory') return 'i-lucide-folder'
  const ext = '.' + entry.path.split('.').pop()?.toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)) {
    return 'i-lucide-file-image'
  }
  if (['.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext)) {
    return 'i-lucide-file-video'
  }
  if (['.mp3', '.wav', '.m4a', '.flac'].includes(ext)) {
    return 'i-lucide-file-audio'
  }
  if (['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.scss'].includes(ext)) {
    return 'i-lucide-file-code'
  }
  return 'i-lucide-file-text'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'max-w-4xl h-[550px] p-0 overflow-hidden' }"
  >
    <template #content>
      <div class="file-dialog-modal">
        <!-- Header -->
        <div class="dialog-header">
          <span class="dialog-title">{{ title || (mode === 'save-file' ? t('apps.fileManager.newFile') : t('apps.fileManager.open')) }}</span>
          <div class="dialog-header-right">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              size="sm"
              class="search-input"
              :placeholder="t('apps.fileManager.searchPlaceholder')"
            />
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="handleCancel"
            />
          </div>
        </div>

        <!-- Navigation Bar -->
        <div class="dialog-nav">
          <div class="nav-buttons">
            <UButton
              icon="i-lucide-arrow-left"
              variant="ghost"
              color="neutral"
              size="xs"
              :disabled="backStack.length === 0"
              @click="goBack"
            />
            <UButton
              icon="i-lucide-arrow-up"
              variant="ghost"
              color="neutral"
              size="xs"
              :disabled="cwd === '/'"
              @click="goUp"
            />
          </div>
          <div class="nav-divider" />
          <div class="nav-breadcrumbs">
            <UBreadcrumb :items="breadcrumbLinks" />
          </div>
          <div class="nav-divider" />
          <div class="layout-toggle">
            <UButton
              icon="i-lucide-grid"
              size="xs"
              :variant="currentLayout === 'grid' ? 'solid' : 'ghost'"
              color="neutral"
              @click="currentLayout = 'grid'"
            />
            <UButton
              icon="i-lucide-list"
              size="xs"
              :variant="currentLayout === 'list' ? 'solid' : 'ghost'"
              color="neutral"
              @click="currentLayout = 'list'"
            />
          </div>
        </div>

        <!-- Main Workspace -->
        <div class="dialog-workspace">
          <!-- Sidebar -->
          <aside class="sidebar">
            <div class="sidebar-section">
              <p class="section-title">
                <UIcon
                  name="i-lucide-star"
                  class="section-icon"
                />
                {{ t('apps.fileManager.favorites') }}
              </p>
              <div class="section-items">
                <button
                  v-for="fav in favorites"
                  :key="fav"
                  class="sidebar-item"
                  :class="{ active: cwd === fav }"
                  @click="goTo(fav)"
                >
                  <UIcon
                    name="i-lucide-folder"
                    class="item-icon"
                  />
                  <span>{{ fav.split('/').filter(Boolean).pop() || '/' }}</span>
                </button>
              </div>
            </div>

            <div class="sidebar-section">
              <p class="section-title">
                <UIcon
                  name="i-lucide-hard-drive"
                  class="section-icon"
                />
                {{ t('apps.fileManager.mounts') }}
              </p>
              <div class="section-items">
                <button
                  v-for="m in fileSystem.mounts.value"
                  :key="m.id"
                  class="sidebar-item"
                  :class="{ active: activeMountId === m.id }"
                  @click="fileSystem.setActiveMount(m.id)"
                >
                  <UIcon
                    name="i-lucide-disk"
                    class="item-icon"
                  />
                  <span>{{ m.name }}</span>
                </button>
              </div>
            </div>
          </aside>

          <!-- Main View -->
          <main class="main-view">
            <!-- Alerts -->
            <UAlert
              v-if="!fileSystem.isSupported.value"
              icon="i-lucide-info"
              color="neutral"
              variant="soft"
              :description="t('apps.fileManager.unsupported')"
              class="state-alert"
            />
            <UAlert
              v-else-if="!activeMountId"
              icon="i-lucide-folder-search"
              color="neutral"
              variant="soft"
              :description="t('apps.fileManager.noMounts')"
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

            <!-- Loading overlay -->
            <div
              v-if="isLoading"
              class="loading-overlay"
            >
              <UIcon
                name="i-lucide-refresh-cw"
                class="spin-icon"
              />
              <span>{{ t('apps.fileManager.loading') }}</span>
            </div>

            <!-- Empty Directory -->
            <div
              v-else-if="filteredEntries.length === 0"
              class="empty-state"
            >
              <UIcon
                name="i-lucide-folder-open"
                class="empty-icon"
              />
              <p>{{ t('apps.fileManager.empty') }}</p>
            </div>

            <!-- Grid View -->
            <div
              v-else-if="currentLayout === 'grid'"
              class="grid-view"
            >
              <button
                v-for="entry in filteredEntries"
                :key="entry.path"
                class="grid-item"
                :class="{ selected: selectedPaths.includes(entry.path) || (mode === 'open-directory' && entry.kind === 'directory' && selectedPaths.includes(entry.path)) }"
                @click="toggleSelect(entry)"
                @dblclick="handleDoubleClick(entry)"
              >
                <div class="icon-container">
                  <UIcon
                    :name="getFileIcon(entry)"
                    :class="['file-icon', entry.kind === 'directory' ? 'icon-dir' : 'icon-file']"
                  />
                  <UIcon
                    v-if="selectedPaths.includes(entry.path) && multiple"
                    name="i-lucide-check-circle-2"
                    class="check-badge"
                  />
                </div>
                <span
                  class="file-name"
                  :title="entry.name"
                >{{ entry.name }}</span>
              </button>
            </div>

            <!-- List View -->
            <div
              v-else-if="currentLayout === 'list'"
              class="list-view"
            >
              <table class="file-table">
                <thead>
                  <tr>
                    <th>{{ t('apps.fileManager.headerName') }}</th>
                    <th>{{ t('apps.fileManager.headerSize') }}</th>
                    <th>{{ t('apps.fileManager.headerType') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in filteredEntries"
                    :key="entry.path"
                    :class="{ selected: selectedPaths.includes(entry.path) }"
                    @click="toggleSelect(entry)"
                    @dblclick="handleDoubleClick(entry)"
                  >
                    <td class="col-name">
                      <div class="name-cell">
                        <UIcon
                          :name="getFileIcon(entry)"
                          :class="['file-icon-mini', entry.kind === 'directory' ? 'icon-dir' : 'icon-file']"
                        />
                        <span
                          class="item-name"
                          :title="entry.name"
                        >{{ entry.name }}</span>
                      </div>
                    </td>
                    <td>{{ entry.kind === 'directory' ? '-' : formatFileSize(entry.size ?? 0) }}</td>
                    <td>{{ entry.kind === 'directory' ? t('apps.fileManager.propKindDir') : t('apps.fileManager.propKindFile') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </main>
        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <div class="dialog-footer-left">
            <span
              v-if="filters.length > 0"
              class="filter-hint"
            >
              {{ filters.join(', ') }}
            </span>
          </div>

          <div class="dialog-footer-right">
            <template v-if="mode === 'save-file'">
              <UInput
                v-model="fileNameInput"
                size="sm"
                class="filename-input"
                :placeholder="t('apps.fileManager.newFilePrompt')"
                @keydown.enter="handleConfirm"
              />
            </template>

            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              @click="handleCancel"
            >
              {{ t('apps.fileManager.cancel') }}
            </UButton>

            <UButton
              size="sm"
              variant="solid"
              color="primary"
              :disabled="!activeMountId || (mode === 'save-file' && !fileNameInput.trim()) || (mode === 'open-file' && selectedPaths.length === 0)"
              @click="handleConfirm"
            >
              {{ mode === 'save-file' ? t('apps.fileManager.ok') : t('apps.fileManager.open') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style lang="scss" scoped>
.file-dialog-modal {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
  font-family: var(--font-sans, Inter, sans-serif);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;

  .dialog-title {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .dialog-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .search-input {
      width: 12rem;
    }
  }
}

.dialog-nav {
  display: flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  gap: 0.5rem;
  flex-shrink: 0;

  .nav-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .nav-divider {
    width: 1px;
    height: 1rem;
    background: var(--ui-border);
  }

  .nav-breadcrumbs {
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
}

.dialog-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  width: 12rem;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  padding: 0.5rem;
  overflow-y: auto;
  flex-shrink: 0;

  .sidebar-section {
    margin-bottom: 1rem;

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--ui-text-muted);
      text-transform: uppercase;
      padding: 0 0.5rem;
      margin: 0 0 0.25rem 0;
    }

    .section-items {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      border: none;
      background: transparent;
      padding: 0.375rem 0.5rem;
      border-radius: 0.375rem;
      color: var(--ui-text);
      cursor: pointer;
      text-align: left;
      font-size: 0.75rem;
      transition: background-color 0.1s;

      &:hover {
        background: var(--ui-bg);
      }

      &.active {
        background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
        color: var(--ui-primary);
        font-weight: 500;
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.main-view {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  background: var(--ui-bg);
  position: relative;
}

.state-alert {
  margin-bottom: 0.5rem;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--ui-bg), 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  z-index: 10;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;

  .spin-icon {
    font-size: 1.5rem;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.5;
    margin-bottom: 0.5rem;
  }
}

// Grid layout styles
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.5rem;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid transparent;
    background: transparent;
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    text-align: center;
    width: 100%;
    transition: background-color 0.15s, border-color 0.15s;

    &:hover {
      background: var(--ui-bg-elevated);
    }

    &.selected {
      background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
      border-color: var(--ui-primary);
    }

    .icon-container {
      position: relative;
      margin-bottom: 0.25rem;
    }

    .file-icon {
      font-size: 2.25rem;
      display: block;

      &.icon-dir {
        color: var(--ui-warning);
      }

      &.icon-file {
        color: var(--ui-text-muted);
      }
    }

    .check-badge {
      position: absolute;
      top: -0.25rem;
      right: -0.25rem;
      font-size: 0.875rem;
      color: var(--ui-primary);
      background: var(--ui-bg);
      border-radius: 50%;
    }

    .file-name {
      font-size: 0.75rem;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.2;
    }
  }
}

// List layout styles
.list-view {
  .file-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;

    th, td {
      padding: 0.375rem 0.5rem;
      text-align: left;
    }

    th {
      border-bottom: 1px solid var(--ui-border);
      color: var(--ui-text-muted);
      font-weight: 600;
    }

    tr {
      border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 40%, transparent);
      cursor: pointer;

      &:hover {
        background: var(--ui-bg-elevated);
      }

      &.selected {
        background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
        color: var(--ui-primary);
      }
    }

    .col-name {
      width: 65%;
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .file-icon-mini {
      font-size: 1rem;
      flex-shrink: 0;

      &.icon-dir {
        color: var(--ui-warning);
      }

      &.icon-file {
        color: var(--ui-text-muted);
      }
    }

    .item-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;

  .dialog-footer-left {
    .filter-hint {
      font-size: 0.6875rem;
      color: var(--ui-text-muted);
    }
  }

  .dialog-footer-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .filename-input {
      width: 12rem;
    }
  }
}
</style>
