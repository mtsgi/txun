<script setup lang="ts">
import type { FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'

defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()
const desktopStore = useDesktopStore()
const { openApp } = useWindowManager()

// Interfaces
interface FileManagerTab {
  id: string
  currentPath: string
  backStack: string[]
  forwardStack: string[]
  searchQuery: string
  recursiveSearch: boolean
}

interface ClipboardState {
  type: 'copy' | 'cut'
  paths: string[]
  mountId: string
}

// Persistent / Shared States
const favorites = ref<string[]>([])
const clipboard = useState<ClipboardState | null>('file-manager-clipboard', () => null)

// UI States
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(800)
const isCompact = computed(() => containerWidth.value < 640)

const tabs = ref<FileManagerTab[]>([])
const activeTabId = ref<string>('')
const currentLayout = ref<'grid' | 'list'>('grid')
const selectedItemPath = ref<string | null>(null)
const showSidebar = ref(true)
const isLoading = ref(false)
const localError = ref<string | null>(null)

// Search states
const searchResults = ref<FileSystemEntry[]>([])
const isSearching = ref(false)

// Modals
const appChooserOpen = ref(false)
const targetFileForChooser = ref<FileSystemEntry | null>(null)
const propertiesOpen = ref(false)
const propertiesEntry = ref<FileSystemEntry | null>(null)

// Default App Associations
const DEFAULT_ASSOCIATIONS: Record<string, string> = {
  '.txt': 'text-editor',
  '.md': 'text-editor',
  '.json': 'text-editor',
  '.js': 'text-editor',
  '.ts': 'text-editor',
  '.html': 'text-editor',
  '.css': 'text-editor',
  '.scss': 'text-editor',
  '.png': 'image-viewer',
  '.jpg': 'image-viewer',
  '.jpeg': 'image-viewer',
  '.gif': 'image-viewer',
  '.webp': 'image-viewer',
  '.svg': 'image-viewer',
  '.bmp': 'image-viewer',
  '.ico': 'image-viewer',
  '.mp4': 'video-player',
  '.webm': 'video-player',
  '.ogg': 'video-player',
  '.mp3': 'music-player',
  '.wav': 'music-player',
  '.m4a': 'music-player'
}

// Computed Active Tab
const activeTab = computed(() => {
  return tabs.value.find(t => t.id === activeTabId.value) || tabs.value[0]
})

// Breadcrumbs
const breadcrumbLinks = computed(() => {
  const tab = activeTab.value
  if (!tab) return []
  if (tab.currentPath === '/') {
    return [{ label: '/', onClick: () => goTo('/') }]
  }
  const parts = tab.currentPath.split('/').filter(Boolean)
  return [
    { label: '/', onClick: () => goTo('/') },
    ...parts.map((part, i) => ({
      label: part,
      onClick: () => goTo('/' + parts.slice(0, i + 1).join('/'))
    }))
  ]
})

// Current folder entries
const entries = ref<FileSystemEntry[]>([])

const displayedEntries = computed(() => {
  const tab = activeTab.value
  if (!tab) return []
  if (tab.searchQuery) {
    return searchResults.value
  }
  return entries.value
})

// Methods
function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

function loadFavorites() {
  const saved = localStorage.getItem('file-manager-favorites')
  if (saved) {
    favorites.value = JSON.parse(saved)
  } else {
    favorites.value = ['/']
  }
}

function toggleFavorite(path: string) {
  if (favorites.value.includes(path)) {
    favorites.value = favorites.value.filter(p => p !== path)
    notify(t('apps.fileManager.unpinFromFavorites'), { type: 'success' })
  } else {
    favorites.value.push(path)
    notify(t('apps.fileManager.pinToFavorites'), { type: 'success' })
  }
  localStorage.setItem('file-manager-favorites', JSON.stringify(favorites.value))
}

function createTab(path = '/') {
  const newTab: FileManagerTab = {
    id: generateId(),
    currentPath: path,
    backStack: [],
    forwardStack: [],
    searchQuery: '',
    recursiveSearch: false
  }
  tabs.value.push(newTab)
  activeTabId.value = newTab.id
}

function closeTab(id: string) {
  if (tabs.value.length <= 1) return
  const idx = tabs.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    tabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      const nextTab = tabs.value[Math.max(0, idx - 1)]
      if (nextTab) {
        activeTabId.value = nextTab.id
      }
    }
  }
}

function duplicateTab(tab: FileManagerTab) {
  const newTab: FileManagerTab = {
    id: generateId(),
    currentPath: tab.currentPath,
    backStack: [...tab.backStack],
    forwardStack: [...tab.forwardStack],
    searchQuery: tab.searchQuery,
    recursiveSearch: tab.recursiveSearch
  }
  tabs.value.push(newTab)
  activeTabId.value = newTab.id
}

async function loadEntries() {
  const mountId = fileSystem.activeMountId.value
  const tab = activeTab.value
  if (!mountId || !tab) {
    entries.value = []
    return
  }

  isLoading.value = true
  localError.value = null
  try {
    entries.value = await fileSystem.listDirectory(tab.currentPath, mountId)
  } catch (error) {
    localError.value = toErrorMessage(error)
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

async function searchRecursive(startPath: string, query: string, mountId: string, maxDepth = 5): Promise<FileSystemEntry[]> {
  const results: FileSystemEntry[] = []
  const q = query.toLowerCase()

  async function traverse(currentPath: string, depth: number) {
    if (depth > maxDepth) return
    try {
      const list = await fileSystem.listDirectory(currentPath, mountId)
      for (const entry of list) {
        if (entry.name.toLowerCase().includes(q)) {
          results.push(entry)
        }
        if (entry.kind === 'directory') {
          await traverse(entry.path, depth + 1)
        }
      }
    } catch {
      // Ignore reading errors on specific folders
    }
  }

  await traverse(startPath, 1)
  return results
}

async function performSearch() {
  const tab = activeTab.value
  const mountId = fileSystem.activeMountId.value
  if (!tab || !tab.searchQuery || !mountId) {
    searchResults.value = []
    return
  }

  if (tab.recursiveSearch) {
    isSearching.value = true
    try {
      searchResults.value = await searchRecursive(tab.currentPath, tab.searchQuery, mountId)
    } finally {
      isSearching.value = false
    }
  } else {
    searchResults.value = entries.value.filter(e => e.name.toLowerCase().includes(tab.searchQuery.toLowerCase()))
  }
}

function navigateTo(path: string) {
  const tab = activeTab.value
  if (!tab || tab.currentPath === path) return

  tab.backStack.push(tab.currentPath)
  tab.forwardStack = []
  tab.currentPath = path
  tab.searchQuery = ''
  selectedItemPath.value = null
}

function goTo(path: string) {
  navigateTo(path)
}

function goBack() {
  const tab = activeTab.value
  if (!tab || tab.backStack.length === 0) return
  const prev = tab.backStack.pop()!
  tab.forwardStack.push(tab.currentPath)
  tab.currentPath = prev
  tab.searchQuery = ''
  selectedItemPath.value = null
}

function goForward() {
  const tab = activeTab.value
  if (!tab || tab.forwardStack.length === 0) return
  const next = tab.forwardStack.pop()!
  tab.backStack.push(tab.currentPath)
  tab.currentPath = next
  tab.searchQuery = ''
  selectedItemPath.value = null
}

function goUp() {
  const tab = activeTab.value
  if (!tab || tab.currentPath === '/') return
  const parts = tab.currentPath.split('/').filter(Boolean)
  parts.pop()
  navigateTo('/' + parts.join('/'))
}

// File Launcher helper
function getAssociatedApp(path: string): string | null {
  const ext = '.' + path.split('.').pop()?.toLowerCase()
  return DEFAULT_ASSOCIATIONS[ext] || null
}

async function openFile(entry: FileSystemEntry, forceAppId?: string) {
  const appId = forceAppId || getAssociatedApp(entry.path)
  if (appId) {
    openApp(appId, { args: { path: entry.path } })
  } else {
    showAppChooserModal(entry)
  }
}

async function handleDoubleClick(entry: FileSystemEntry) {
  if (entry.kind === 'directory') {
    navigateTo(entry.path)
  } else {
    await openFile(entry)
  }
}

// Clipboard Methods
function handleCopy(entry: FileSystemEntry) {
  if (!fileSystem.activeMountId.value) return
  clipboard.value = {
    type: 'copy',
    paths: [entry.path],
    mountId: fileSystem.activeMountId.value
  }
  notify(t('apps.fileManager.copy'), { type: 'success' })
}

function handleCut(entry: FileSystemEntry) {
  if (!fileSystem.activeMountId.value) return
  clipboard.value = {
    type: 'cut',
    paths: [entry.path],
    mountId: fileSystem.activeMountId.value
  }
  notify(t('apps.fileManager.cut'), { type: 'success' })
}

async function handlePaste() {
  const clip = clipboard.value
  const tab = activeTab.value
  if (!clip || !tab || !fileSystem.activeMountId.value) return

  isLoading.value = true
  try {
    for (const srcPath of clip.paths) {
      const filename = srcPath.split('/').filter(Boolean).pop()!
      const destPath = fileSystem.resolvePath(tab.currentPath, filename)
      if (clip.type === 'copy') {
        await fileSystem.copy(srcPath, destPath, clip.mountId)
      } else {
        await fileSystem.move(srcPath, destPath, clip.mountId)
      }
    }
    if (clip.type === 'cut') {
      clipboard.value = null
    }
    await loadEntries()
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    isLoading.value = false
  }
}

// File actions
async function createFolder() {
  const tab = activeTab.value
  if (!tab || !fileSystem.activeMountId.value) return
  const name = window.prompt(t('apps.fileManager.newFolderPrompt'))?.trim()
  if (!name) return

  try {
    const targetPath = fileSystem.resolvePath(tab.currentPath, name)
    await fileSystem.mkdir(targetPath, fileSystem.activeMountId.value, false)
    await loadEntries()
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function createFile() {
  const tab = activeTab.value
  if (!tab || !fileSystem.activeMountId.value) return
  const name = window.prompt(t('apps.fileManager.newFilePrompt'))?.trim()
  if (!name) return

  try {
    const targetPath = fileSystem.resolvePath(tab.currentPath, name)
    await fileSystem.touch(targetPath, fileSystem.activeMountId.value)
    await loadEntries()
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function renameEntry(entry: FileSystemEntry) {
  if (!fileSystem.activeMountId.value) return
  const nextName = window.prompt(t('apps.fileManager.renamePrompt'), entry.name)?.trim()
  if (!nextName || nextName === entry.name) return

  try {
    await fileSystem.rename(entry.path, nextName, fileSystem.activeMountId.value)
    await loadEntries()
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function deleteEntry(entry: FileSystemEntry) {
  if (!fileSystem.activeMountId.value) return
  const accepted = window.confirm(t('apps.fileManager.deleteConfirm', { name: entry.name }))
  if (!accepted) return

  try {
    await fileSystem.deleteEntry(entry.path, fileSystem.activeMountId.value, entry.kind === 'directory')
    await loadEntries()
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

// Modals trigger
function showAppChooserModal(entry: FileSystemEntry) {
  targetFileForChooser.value = entry
  appChooserOpen.value = true
}

function selectAppForChooser(appId: string) {
  if (targetFileForChooser.value) {
    void openFile(targetFileForChooser.value, appId)
  }
  appChooserOpen.value = false
  targetFileForChooser.value = null
}

function showProperties(entry: FileSystemEntry) {
  propertiesEntry.value = entry
  propertiesOpen.value = true
}

// Helpers
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.fileManager.errorGeneric')
}

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

function getFileTypeName(path: string): string {
  const ext = '.' + path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case '.md': return 'Markdown'
    case '.txt': return 'Text Document'
    case '.json': return 'JSON Document'
    case '.js': return 'JavaScript'
    case '.ts': return 'TypeScript'
    case '.html': return 'HTML Document'
    case '.css': return 'CSS Style Sheet'
    case '.png': return 'PNG Image'
    case '.jpg':
    case '.jpeg': return 'JPEG Image'
    case '.gif': return 'GIF Image'
    case '.webp': return 'WebP Image'
    case '.mp4': return 'MP4 Video'
    case '.mp3': return 'MP3 Audio'
    default: return ext.toUpperCase().slice(1) + ' File'
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Menus and context items mapping
const contextMenuItems = computed(() => (entry: FileSystemEntry) => {
  const isDir = entry.kind === 'directory'
  const isPinned = favorites.value.includes(entry.path)
  const menu: { label: string, icon: string, onSelect: () => void, color?: 'error' }[][] = [
    [
      {
        label: t('apps.fileManager.open'),
        icon: isDir ? 'i-lucide-folder-open' : 'i-lucide-external-link',
        onSelect: () => handleDoubleClick(entry)
      },
      {
        label: t('apps.fileManager.openInNewTab'),
        icon: 'i-lucide-plus',
        onSelect: () => createTab(entry.path)
      }
    ],
    [
      {
        label: t('apps.fileManager.cut'),
        icon: 'i-lucide-scissors',
        onSelect: () => handleCut(entry)
      },
      {
        label: t('apps.fileManager.copy'),
        icon: 'i-lucide-copy',
        onSelect: () => handleCopy(entry)
      }
    ],
    [
      {
        label: isPinned ? t('apps.fileManager.unpinFromFavorites') : t('apps.fileManager.pinToFavorites'),
        icon: 'i-lucide-pin',
        onSelect: () => toggleFavorite(entry.path)
      }
    ],
    [
      {
        label: t('apps.fileManager.rename'),
        icon: 'i-lucide-pencil',
        onSelect: () => renameEntry(entry)
      },
      {
        label: t('apps.fileManager.delete'),
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteEntry(entry)
      }
    ],
    [
      {
        label: t('apps.fileManager.properties'),
        icon: 'i-lucide-info',
        onSelect: () => showProperties(entry)
      }
    ]
  ]

  if (!isDir && menu[0]) {
    // Add Open With options
    menu[0].push({
      label: t('apps.fileManager.openWith'),
      icon: 'i-lucide-settings-2',
      onSelect: () => showAppChooserModal(entry)
    })
  }
  return menu
})

const searchDropdownItems = computed(() => {
  const tab = activeTab.value
  if (!tab) return []
  return [
    [
      {
        label: t('apps.fileManager.recursiveSearch'),
        icon: tab.recursiveSearch ? 'i-lucide-check-square' : 'i-lucide-square',
        onSelect: () => {
          tab.recursiveSearch = !tab.recursiveSearch
        }
      }
    ]
  ]
})

const backgroundContextMenuItems = computed(() => [
  [
    {
      label: t('apps.fileManager.newFolder'),
      icon: 'i-lucide-folder-plus',
      onSelect: () => createFolder()
    },
    {
      label: t('apps.fileManager.newFile'),
      icon: 'i-lucide-file-plus',
      onSelect: () => createFile()
    }
  ],
  [
    {
      label: t('apps.fileManager.paste'),
      icon: 'i-lucide-clipboard-paste',
      disabled: !clipboard.value,
      onSelect: () => handlePaste()
    }
  ],
  [
    {
      label: t('apps.fileManager.refresh'),
      icon: 'i-lucide-refresh-cw',
      onSelect: () => loadEntries()
    }
  ]
])

// Tab context menu
const tabContextMenuItems = computed(() => (tab: FileManagerTab) => [
  [
    {
      label: t('apps.fileManager.duplicateTab'),
      icon: 'i-lucide-copy',
      onSelect: () => duplicateTab(tab)
    },
    {
      label: t('apps.fileManager.closeTab'),
      icon: 'i-lucide-x',
      disabled: tabs.value.length <= 1,
      onSelect: () => closeTab(tab.id)
    }
  ]
])

// Watchers and Lifecycle
watch(() => fileSystem.activeMountId.value, async () => {
  if (tabs.value.length === 0) {
    createTab('/')
  } else {
    tabs.value.forEach((tab) => {
      tab.currentPath = '/'
      tab.backStack = []
      tab.forwardStack = []
      tab.searchQuery = ''
    })
  }
  await loadEntries()
})

watch([activeTabId, () => activeTab.value?.currentPath], async () => {
  await loadEntries()
})

watch(() => activeTab.value?.searchQuery, async (q) => {
  if (!q) {
    searchResults.value = []
  } else {
    await performSearch()
  }
})

watch(() => activeTab.value?.recursiveSearch, async () => {
  await performSearch()
})

watch(isCompact, (compact) => {
  if (compact) {
    showSidebar.value = false
  } else {
    showSidebar.value = true
  }
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
  loadFavorites()
  if (tabs.value.length === 0) {
    createTab('/')
  }
  await loadEntries()
})
</script>

<template>
  <div
    ref="containerRef"
    class="file-manager"
  >
    <!-- Tabs Header -->
    <div class="tab-header">
      <div class="tabs-list">
        <UContextMenu
          v-for="tab in tabs"
          :key="tab.id"
          :items="tabContextMenuItems(tab)"
        >
          <div
            class="tab-item"
            :class="{ active: tab.id === activeTabId }"
            @click="activeTabId = tab.id"
          >
            <UIcon
              name="i-lucide-folder"
              class="tab-folder-icon"
            />
            <span class="tab-label">{{ tab.currentPath.split('/').filter(Boolean).pop() || '/' }}</span>
            <UButton
              v-if="tabs.length > 1"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              class="tab-close-btn"
              @click.stop="closeTab(tab.id)"
            />
          </div>
        </UContextMenu>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-plus"
          class="tab-add-btn"
          @click="createTab('/')"
        />
      </div>
    </div>

    <!-- Navigation / Toolbar -->
    <div class="toolbar">
      <div class="navigation-buttons">
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
          :disabled="!activeTab || activeTab.backStack.length === 0"
          @click="goBack"
        />
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-right"
          :disabled="!activeTab || activeTab.forwardStack.length === 0"
          @click="goForward"
        />
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-up"
          :disabled="!activeTab || activeTab.currentPath === '/'"
          @click="goUp"
        />
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="isLoading"
          @click="loadEntries"
        />
      </div>

      <!-- Path input/breadcrumbs container -->
      <div class="breadcrumb-container">
        <UBreadcrumb
          :items="breadcrumbLinks"
          class="breadcrumb"
        />
      </div>

      <!-- Search & Layout Toggle -->
      <div
        v-if="activeTab"
        class="toolbar-actions"
      >
        <div class="search-box">
          <UInput
            v-model="activeTab.searchQuery"
            icon="i-lucide-search"
            :placeholder="t('apps.fileManager.searchPlaceholder')"
            class="search-input"
          />
          <UDropdownMenu :items="searchDropdownItems">
            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              icon="i-lucide-sliders-horizontal"
            />
          </UDropdownMenu>
        </div>

        <div class="layout-toggle">
          <UButton
            size="sm"
            :variant="currentLayout === 'grid' ? 'solid' : 'ghost'"
            color="neutral"
            icon="i-lucide-grid"
            @click="currentLayout = 'grid'"
          />
          <UButton
            size="sm"
            :variant="currentLayout === 'list' ? 'solid' : 'ghost'"
            color="neutral"
            icon="i-lucide-list"
            @click="currentLayout = 'list'"
          />
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="workspace-area">
      <!-- Sidebar -->
      <div
        v-if="showSidebar && isCompact"
        class="sidebar-backdrop"
        @click="showSidebar = false"
      />
      <Transition name="sidebar-slide">
        <aside
          v-if="showSidebar"
          class="sidebar"
          :class="{ compact: isCompact }"
        >
          <!-- Favorites Pinned Section -->
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
                v-for="favPath in favorites"
                :key="favPath"
                class="sidebar-item"
                :class="{ active: activeTab?.currentPath === favPath }"
                @click="goTo(favPath)"
              >
                <UIcon
                  name="i-lucide-folder-heart"
                  class="item-icon"
                />
                <span>{{ favPath.split('/').filter(Boolean).pop() || '/' }}</span>
              </button>
              <div
                v-if="favorites.length === 0"
                class="sidebar-empty"
              >
                {{ t('apps.fileManager.empty') }}
              </div>
            </div>
          </div>

          <!-- Mounts Directories Section -->
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
                v-for="mount in fileSystem.mounts.value"
                :key="mount.id"
                class="sidebar-item"
                :class="{ active: fileSystem.activeMountId.value === mount.id }"
                @click="fileSystem.setActiveMount(mount.id)"
              >
                <UIcon
                  name="i-lucide-disk"
                  class="item-icon"
                />
                <span>{{ mount.name }}</span>
              </button>
              <div
                v-if="fileSystem.mounts.value.length === 0"
                class="sidebar-empty"
              >
                {{ t('apps.fileManager.empty') }}
              </div>
            </div>
          </div>
        </aside>
      </Transition>

      <!-- Main Directory View -->
      <UContextMenu
        :items="backgroundContextMenuItems"
        class="content-wrapper"
      >
        <div class="main-content">
          <!-- State alerts -->
          <UAlert
            v-if="!fileSystem.isSupported.value"
            icon="i-lucide-info"
            color="neutral"
            variant="soft"
            :description="t('apps.fileManager.unsupported')"
            class="state-alert"
          />

          <UAlert
            v-else-if="!fileSystem.activeMountId.value"
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

          <!-- Loading state -->
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
            v-else-if="displayedEntries.length === 0"
            class="empty-state"
          >
            <UIcon
              name="i-lucide-folder-open"
              class="empty-icon"
            />
            <p>{{ t('apps.fileManager.empty') }}</p>
          </div>

          <!-- Grid layout -->
          <div
            v-else-if="currentLayout === 'grid'"
            class="grid-view"
          >
            <UContextMenu
              v-for="entry in displayedEntries"
              :key="entry.name"
              :items="contextMenuItems(entry)"
            >
              <button
                class="grid-item"
                :class="{ selected: selectedItemPath === entry.path }"
                @click="selectedItemPath = entry.path"
                @dblclick="handleDoubleClick(entry)"
              >
                <div class="icon-container">
                  <UIcon
                    :name="getFileIcon(entry)"
                    :class="['file-icon', entry.kind === 'directory' ? 'icon-dir' : 'icon-file']"
                  />
                  <UIcon
                    v-if="favorites.includes(entry.path)"
                    name="i-lucide-star"
                    class="fav-badge"
                  />
                </div>
                <span
                  class="file-name"
                  :title="entry.name"
                >{{ entry.name }}</span>
              </button>
            </UContextMenu>
          </div>

          <!-- List layout -->
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
                  <th>{{ t('apps.fileManager.headerModified') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in displayedEntries"
                  :key="entry.name"
                  :class="{ selected: selectedItemPath === entry.path }"
                  @click="selectedItemPath = entry.path"
                  @dblclick="handleDoubleClick(entry)"
                >
                  <td class="col-name">
                    <UContextMenu :items="contextMenuItems(entry)">
                      <div class="name-cell">
                        <UIcon
                          :name="getFileIcon(entry)"
                          :class="['file-icon-mini', entry.kind === 'directory' ? 'icon-dir' : 'icon-file']"
                        />
                        <span
                          class="item-name"
                          :title="entry.name"
                        >{{ entry.name }}</span>
                        <UIcon
                          v-if="favorites.includes(entry.path)"
                          name="i-lucide-star"
                          class="fav-mini-badge"
                        />
                      </div>
                    </UContextMenu>
                  </td>
                  <td>{{ entry.kind === 'directory' ? '-' : formatFileSize(entry.size ?? 0) }}</td>
                  <td>{{ entry.kind === 'directory' ? t('apps.fileManager.propKindDir') : getFileTypeName(entry.path) }}</td>
                  <td>{{ entry.lastModified ? new Date(entry.lastModified).toLocaleString() : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </UContextMenu>
    </div>

    <!-- Status Bar -->
    <div
      v-if="activeTab"
      class="status-bar"
    >
      <div class="status-left">
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-panel-left"
          @click="showSidebar = !showSidebar"
        />
        <span>{{ activeTab.currentPath }}</span>
      </div>
      <div class="status-right">
        <span>{{ displayedEntries.length }} {{ t('apps.fileManager.items') }}</span>
        <span
          v-if="clipboard"
          class="clipboard-indicator"
        >
          <UIcon
            name="i-lucide-clipboard"
            class="clipboard-icon"
          />
          {{ clipboard.type === 'copy' ? 'Copied' : 'Cut' }} ({{ clipboard.paths.length }} item)
        </span>
      </div>
    </div>

    <!-- Properties Modal -->
    <UModal
      v-model:open="propertiesOpen"
      :ui="{ content: 'max-w-md' }"
    >
      <template #content>
        <div
          v-if="propertiesEntry"
          class="modal-container"
        >
          <div class="modal-header">
            <h3 class="modal-title">
              <UIcon
                :name="getFileIcon(propertiesEntry)"
                class="modal-title-icon"
              />
              {{ t('apps.fileManager.propertiesTitle', { name: propertiesEntry.name }) }}
            </h3>
          </div>
          <div class="modal-body properties-details">
            <div class="prop-row">
              <span class="prop-label">{{ t('apps.fileManager.headerName') }}:</span>
              <span class="prop-value">{{ propertiesEntry.name }}</span>
            </div>
            <div class="prop-row">
              <span class="prop-label">{{ t('apps.fileManager.propPath') }}:</span>
              <span class="prop-value path-value">{{ propertiesEntry.path }}</span>
            </div>
            <div class="prop-row">
              <span class="prop-label">{{ t('apps.fileManager.propKind') }}:</span>
              <span class="prop-value">
                {{ propertiesEntry.kind === 'directory' ? t('apps.fileManager.propKindDir') : getFileTypeName(propertiesEntry.path) }}
              </span>
            </div>
            <div
              v-if="propertiesEntry.kind !== 'directory'"
              class="prop-row"
            >
              <span class="prop-label">{{ t('apps.fileManager.propSize') }}:</span>
              <span class="prop-value">{{ formatFileSize(propertiesEntry.size ?? 0) }} ({{ propertiesEntry.size }} bytes)</span>
            </div>
            <div
              v-if="propertiesEntry.lastModified"
              class="prop-row"
            >
              <span class="prop-label">{{ t('apps.fileManager.propLastModified') }}:</span>
              <span class="prop-value">{{ new Date(propertiesEntry.lastModified).toLocaleString() }}</span>
            </div>
          </div>
          <div class="modal-footer">
            <UButton
              color="neutral"
              variant="solid"
              @click="propertiesOpen = false"
            >
              {{ t('apps.fileManager.ok') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- App Chooser Modal -->
    <UModal
      v-model:open="appChooserOpen"
      :ui="{ content: 'max-w-md' }"
    >
      <template #content>
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">
              <UIcon
                name="i-lucide-settings"
                class="modal-title-icon"
              />
              {{ t('apps.fileManager.selectApp') }}
            </h3>
          </div>
          <div class="modal-body app-list">
            <p class="modal-desc">
              {{ t('apps.fileManager.selectAppDesc') }}
            </p>
            <button
              v-for="app in desktopStore.apps"
              :key="app.id"
              class="app-chooser-item"
              @click="selectAppForChooser(app.id)"
            >
              <UIcon
                :name="app.icon"
                class="app-icon"
              />
              <span>{{ t(app.nameKey) }}</span>
            </button>
          </div>
          <div class="modal-footer">
            <UButton
              color="neutral"
              variant="ghost"
              @click="appChooserOpen = false"
            >
              {{ t('apps.fileManager.cancel') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style lang="scss" scoped>
.file-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
  font-family: var(--font-sans, Inter, sans-serif);
}

// Tab Header Styling (Explorer Style)
.tab-header {
  display: flex;
  align-items: center;
  background: var(--ui-bg-elevated);
  border-bottom: 1px solid var(--ui-border);
  padding: 0.25rem 0.5rem 0;
  flex-shrink: 0;

  .tabs-list {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }

    .tab-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem 0.375rem 0 0;
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.75rem;
      border: 1px solid transparent;
      border-bottom: none;
      transition: all 0.15s ease;
      min-width: 6rem;
      max-width: 12rem;
      position: relative;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ui-text);
      }

      &.active {
        background: var(--ui-bg);
        color: var(--ui-text);
        border-color: var(--ui-border);
        border-bottom: 1px solid var(--ui-bg);
        z-index: 2;

        &::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--ui-primary);
        }
      }

      .tab-folder-icon {
        color: var(--ui-primary);
        font-size: 0.875rem;
      }

      .tab-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tab-close-btn {
        padding: 0;
        margin-left: 0.25rem;
        opacity: 0.5;
        &:hover {
          opacity: 1;
          color: var(--ui-error);
        }
      }
    }
  }

  .tab-add-btn {
    border-radius: 0.25rem;
    padding: 0.25rem;
  }
}

// Toolbar
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--ui-bg);
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
  flex-wrap: wrap;

  .navigation-buttons {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .breadcrumb-container {
    flex: 1;
    min-width: 10rem;
    background: var(--ui-bg-elevated);
    border: 1px solid var(--ui-border);
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    display: flex;
    align-items: center;
    overflow-x: auto;
    font-size: 0.75rem;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .search-input {
        width: 10rem;
      }
    }

    .layout-toggle {
      display: flex;
      border: 1px solid var(--ui-border);
      border-radius: 0.375rem;
      overflow: hidden;
    }
  }
}

// Workspace Area
.workspace-area {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

// Sidebar (macOS Finder / Windows 11 Explorer Sidebar)
.sidebar {
  width: 13rem;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  padding: 0.75rem 0.5rem;
  overflow-y: auto;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .section-title {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--ui-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0.5rem 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.375rem;

      .section-icon {
        font-size: 0.75rem;
      }
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
      padding: 0.375rem 0.5rem;
      border-radius: 0.375rem;
      background: transparent;
      border: none;
      color: var(--ui-text);
      cursor: pointer;
      text-align: left;
      font-size: 0.75rem;
      transition: background-color 0.1s ease;
      width: 100%;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      &.active {
        background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
        color: var(--ui-primary);
        font-weight: 600;

        .item-icon {
          color: var(--ui-primary);
        }
      }

      .item-icon {
        color: var(--ui-text-muted);
        font-size: 0.875rem;
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .sidebar-empty {
      font-size: 0.7rem;
      color: var(--ui-text-muted);
      padding: 0.5rem;
      text-align: center;
    }
  }

  &.compact {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(80%, 15rem);
    z-index: 20;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    height: 100%;
  }
}

.sidebar-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

// Content Wrapper & Main Content View
.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  position: relative;
  height: 100%;
}

// State alerts
.state-alert {
  margin-bottom: 0.75rem;
}

// Loading Spinner overlay
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 10;
  gap: 0.5rem;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;

  .spin-icon {
    font-size: 1.5rem;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

// Empty State
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70%;
  color: var(--ui-text-muted);
  font-size: 0.875rem;
  gap: 0.5rem;

  .empty-icon {
    font-size: 3rem;
    opacity: 0.3;
    color: var(--ui-primary);
  }
}

// Grid View (Standard Icon Mode)
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.75rem;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.25rem;
    border-radius: 0.375rem;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    text-align: center;
    transition: all 0.1s ease;
    width: 100%;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--ui-border);
    }

    &.selected {
      background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 1px var(--ui-primary);
    }

    .icon-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      .file-icon {
        font-size: 2.25rem;
      }

      .icon-dir {
        color: var(--ui-primary);
      }

      .icon-file {
        color: var(--ui-text-muted);
      }

      .fav-badge {
        position: absolute;
        bottom: -2px;
        right: -2px;
        font-size: 0.65rem;
        color: var(--ui-warning);
        background: var(--ui-bg);
        border-radius: 50%;
        padding: 1px;
      }
    }

    .file-name {
      font-size: 0.725rem;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: inherit;
    }
  }
}

// List View (Explorer Detail View)
.list-view {
  border: 1px solid var(--ui-border);
  border-radius: 0.375rem;
  background: var(--ui-bg);
  overflow: hidden;

  .file-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
    text-align: left;

    th, td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--ui-border);
    }

    th {
      background: var(--ui-bg-elevated);
      font-weight: 600;
      color: var(--ui-text-muted);
      user-select: none;
    }

    tr {
      cursor: pointer;
      transition: background-color 0.1s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      &.selected {
        background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
        td {
          border-bottom-color: var(--ui-primary);
        }
      }
    }

    .col-name {
      max-width: 18rem;
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .file-icon-mini {
        font-size: 1.125rem;
      }

      .icon-dir {
        color: var(--ui-primary);
      }

      .icon-file {
        color: var(--ui-text-muted);
      }

      .item-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .fav-mini-badge {
        font-size: 0.7rem;
        color: var(--ui-warning);
        margin-left: 0.25rem;
      }
    }
  }
}

// Status Bar
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem;
  background: var(--ui-bg-elevated);
  border-top: 1px solid var(--ui-border);
  font-size: 0.7rem;
  color: var(--ui-text-muted);
  flex-shrink: 0;

  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .clipboard-indicator {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--ui-primary);
    background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
    padding: 0.0625rem 0.375rem;
    border-radius: 0.25rem;

    .clipboard-icon {
      font-size: 0.75rem;
    }
  }
}

// Modal Containers (Nuxt UI modal wraps)
.modal-container {
  display: flex;
  flex-direction: column;
  background: var(--ui-bg);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  border: 1px solid var(--ui-border);

  .modal-header {
    padding: 1rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);

    .modal-title {
      font-size: 0.875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .modal-title-icon {
        color: var(--ui-primary);
        font-size: 1.125rem;
      }
    }
  }

  .modal-body {
    padding: 1rem;

    .modal-desc {
      font-size: 0.75rem;
      color: var(--ui-text-muted);
      margin-bottom: 0.75rem;
    }
  }

  .modal-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  // Properties details specific
  .properties-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 0.75rem;

    .prop-row {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;

      .prop-label {
        font-weight: 600;
        color: var(--ui-text-muted);
        width: 6rem;
        flex-shrink: 0;
      }

      .prop-value {
        color: var(--ui-text);
        word-break: break-all;
      }

      .path-value {
        font-family: monospace;
      }
    }
  }

  // Application List chooser specific
  .app-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 16rem;
    overflow-y: auto;

    .app-chooser-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--ui-border);
      border-radius: 0.375rem;
      background: transparent;
      color: var(--ui-text);
      cursor: pointer;
      text-align: left;
      font-size: 0.75rem;
      transition: background-color 0.1s ease;
      width: 100%;

      &:hover {
        background: var(--ui-bg-elevated);
        border-color: var(--ui-primary);
      }

      .app-icon {
        color: var(--ui-primary);
        font-size: 1.125rem;
      }
    }
  }
}
</style>
