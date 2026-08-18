<script setup lang="ts">
import { useClipboardStore } from '#layers/txunos-core/app/stores/clipboard'
import type { ClipboardEntry } from '#layers/txunos-core/app/stores/clipboard'
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'
import { useDesktopNotification } from '#layers/txunos-core/app/composables/useDesktopNotification'

defineProps<{ windowId?: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const clipboardStore = useClipboardStore()
const desktopStore = useDesktopStore()

const selectedEntryId = ref<string | null>(null)
const mobileActiveView = ref<'list' | 'detail'>('list')
const filterType = ref<'all' | 'text' | 'image' | 'files' | 'pinned'>('all')
const isSyncing = ref(false)

const filteredItems = computed(() => {
  let list = clipboardStore.history

  if (filterType.value === 'pinned') {
    list = list.filter(item => item.pinned)
  } else if (filterType.value !== 'all') {
    list = list.filter((item) => {
      if (filterType.value === 'text') return item.type === 'text' || item.type === 'html'
      return item.type === filterType.value
    })
  }

  const q = clipboardStore.searchQuery.trim().toLowerCase()
  if (q) {
    list = list.filter((item) => {
      if (item.textPreview.toLowerCase().includes(q)) return true
      if (item.type === 'text' && item.content.toLowerCase().includes(q)) return true
      if (item.metadata?.paths?.some(p => p.toLowerCase().includes(q))) return true
      if (item.metadata?.fileName?.toLowerCase().includes(q)) return true
      return false
    })
  }

  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.createdAt - a.createdAt
  })
})

const selectedEntry = computed(() => {
  if (!selectedEntryId.value) {
    return filteredItems.value[0] || null
  }
  return clipboardStore.history.find(item => item.id === selectedEntryId.value) || filteredItems.value[0] || null
})

function selectItem(entry: ClipboardEntry) {
  selectedEntryId.value = entry.id
  mobileActiveView.value = 'detail'
}

function handleCopy(entry: ClipboardEntry) {
  if (entry.type === 'text' || entry.type === 'html') {
    clipboardStore.copyText(entry.content, { html: entry.htmlContent })
  } else if (entry.type === 'image') {
    clipboardStore.copyImage(entry.content, {
      mimeType: entry.metadata?.mimeType,
      width: entry.metadata?.width,
      height: entry.metadata?.height,
      fileName: entry.metadata?.fileName
    })
  } else if (entry.type === 'files') {
    clipboardStore.copyFiles(entry.metadata?.paths || [], {
      mountId: entry.metadata?.mountId,
      isCut: entry.metadata?.isCut
    })
  }
  notify(t('apps.clipboard.copiedToast'), { type: 'success' })
}

function handleTogglePin(entry: ClipboardEntry) {
  clipboardStore.togglePin(entry.id)
}

function handleDelete(entry: ClipboardEntry) {
  clipboardStore.removeEntry(entry.id)
  if (selectedEntryId.value === entry.id) {
    selectedEntryId.value = filteredItems.value[0]?.id || null
    mobileActiveView.value = 'list'
  }
  notify(t('apps.clipboard.deletedToast'), { type: 'info' })
}

function handleClearAll() {
  if (confirm(t('apps.clipboard.clearConfirm'))) {
    clipboardStore.clearHistory(true)
    selectedEntryId.value = null
  }
}

async function handleSyncNative() {
  isSyncing.value = true
  try {
    const entry = await clipboardStore.syncFromNativeClipboard()
    if (entry) {
      selectedEntryId.value = entry.id
      notify(t('apps.clipboard.copiedToast'), { type: 'success' })
    }
  } finally {
    isSyncing.value = false
  }
}

function openInTextEditor(entry: ClipboardEntry) {
  const textEditorApp = desktopStore.apps.find(a => a.id === 'text-editor')
  if (textEditorApp) {
    desktopStore.openWindow(textEditorApp, {
      args: { content: entry.content, filename: `clipboard-${Date.now().toString(36)}.txt` }
    })
  }
}

function openInImageViewer(entry: ClipboardEntry) {
  const imageViewerApp = desktopStore.apps.find(a => a.id === 'image-viewer')
  if (imageViewerApp) {
    desktopStore.openWindow(imageViewerApp, {
      args: { src: entry.content }
    })
  }
}

function openInFileManager(entry: ClipboardEntry) {
  const fileManagerApp = desktopStore.apps.find(a => a.id === 'file-manager')
  if (fileManagerApp) {
    const firstPath = entry.metadata?.paths?.[0]
    desktopStore.openWindow(fileManagerApp, {
      args: { path: firstPath, mountId: entry.metadata?.mountId }
    })
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'text': return 'i-lucide-align-left'
    case 'html': return 'i-lucide-code'
    case 'image': return 'i-lucide-image'
    case 'files': return 'i-lucide-files'
    default: return 'i-lucide-clipboard'
  }
}
</script>

<template>
  <div class="clipboard-app-container">
    <!-- Top Action & Search Bar -->
    <div class="app-toolbar">
      <div class="toolbar-search">
        <UInput
          v-model="clipboardStore.searchQuery"
          icon="i-lucide-search"
          size="xs"
          class="search-input-field"
          :placeholder="$t('apps.clipboard.searchPlaceholder')"
          clearable
        />
      </div>

      <div class="filter-btn-group">
        <UButton
          size="xs"
          :variant="filterType === 'all' ? 'solid' : 'ghost'"
          :color="filterType === 'all' ? 'primary' : 'neutral'"
          :label="$t('apps.clipboard.filterAll')"
          @click="filterType = 'all'"
        />
        <UButton
          size="xs"
          :variant="filterType === 'text' ? 'solid' : 'ghost'"
          :color="filterType === 'text' ? 'primary' : 'neutral'"
          :label="$t('apps.clipboard.filterText')"
          icon="i-lucide-type"
          @click="filterType = 'text'"
        />
        <UButton
          size="xs"
          :variant="filterType === 'image' ? 'solid' : 'ghost'"
          :color="filterType === 'image' ? 'primary' : 'neutral'"
          :label="$t('apps.clipboard.filterImage')"
          icon="i-lucide-image"
          @click="filterType = 'image'"
        />
        <UButton
          size="xs"
          :variant="filterType === 'files' ? 'solid' : 'ghost'"
          :color="filterType === 'files' ? 'primary' : 'neutral'"
          :label="$t('apps.clipboard.filterFiles')"
          icon="i-lucide-folder"
          @click="filterType = 'files'"
        />
        <UButton
          size="xs"
          :variant="filterType === 'pinned' ? 'solid' : 'ghost'"
          :color="filterType === 'pinned' ? 'primary' : 'neutral'"
          :label="$t('apps.clipboard.filterPinned')"
          icon="i-lucide-pin"
          @click="filterType = 'pinned'"
        />
      </div>

      <div class="toolbar-right-actions">
        <UTooltip text="ブラウザのクリップボードから取り込む">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="isSyncing"
            @click="handleSyncNative"
          />
        </UTooltip>
        <UButton
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          :label="$t('apps.clipboard.clearAll')"
          :disabled="clipboardStore.history.length === 0"
          @click="handleClearAll"
        />
      </div>
    </div>

    <!-- Main Content (Two Columns / Master-Detail on Mobile) -->
    <div class="app-main-layout">
      <!-- Left Column: History Items List -->
      <div
        class="history-sidebar"
        :class="{ 'mobile-hidden': mobileActiveView === 'detail' }"
      >
        <div class="sidebar-header-status">
          <span class="stats-label">
            {{ $t('apps.clipboard.stats', { total: clipboardStore.totalCount, pinned: clipboardStore.pinnedEntries.length }) }}
          </span>
        </div>

        <div
          v-if="filteredItems.length === 0"
          class="list-empty-state"
        >
          <UIcon
            name="i-lucide-clipboard-x"
            class="empty-icon"
          />
          <p>{{ $t('apps.clipboard.empty') }}</p>
        </div>

        <div
          v-else
          class="history-list"
        >
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="list-card-item"
            :class="{
              selected: selectedEntry?.id === item.id,
              pinned: item.pinned
            }"
            @click="selectItem(item)"
          >
            <div class="card-top-row">
              <div class="type-badge-box">
                <UIcon
                  :name="getTypeIcon(item.type)"
                  class="type-icon"
                />
                <span class="type-text">{{ item.type }}</span>
              </div>
              <div class="card-time">
                {{ formatDateTime(item.createdAt).split(' ')[1] }}
              </div>
            </div>

            <!-- Card text preview -->
            <div
              v-if="item.type === 'text' || item.type === 'html'"
              class="card-text-snippet"
            >
              {{ item.content }}
            </div>

            <!-- Card image preview -->
            <div
              v-else-if="item.type === 'image'"
              class="card-image-snippet"
            >
              <img
                :src="item.content"
                alt="preview"
                class="thumb"
              >
              <span
                v-if="item.metadata?.width"
                class="img-dims"
              >{{ item.metadata.width }}×{{ item.metadata.height }}</span>
            </div>

            <!-- Card files preview -->
            <div
              v-else-if="item.type === 'files'"
              class="card-files-snippet"
            >
              <UIcon
                name="i-lucide-files"
                class="files-icon"
              />
              <span class="files-names">
                {{ (item.metadata?.paths || []).map(p => p.split('/').pop()).join(', ') }}
              </span>
            </div>

            <!-- Card hover buttons -->
            <div class="card-hover-actions">
              <button
                class="mini-action-btn"
                :title="$t('apps.clipboard.copy')"
                @click.stop="handleCopy(item)"
              >
                <UIcon
                  name="i-lucide-copy"
                  class="icon"
                />
              </button>
              <button
                class="mini-action-btn"
                :class="{ active: item.pinned }"
                :title="item.pinned ? $t('apps.clipboard.unpin') : $t('apps.clipboard.pin')"
                @click.stop="handleTogglePin(item)"
              >
                <UIcon
                  :name="item.pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                  class="icon"
                />
              </button>
              <button
                class="mini-action-btn"
                :title="$t('apps.clipboard.delete')"
                @click.stop="handleDelete(item)"
              >
                <UIcon
                  name="i-lucide-trash"
                  class="icon"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Detail Inspector -->
      <div
        class="detail-inspector"
        :class="{ 'mobile-hidden': mobileActiveView === 'list' }"
      >
        <div
          v-if="!selectedEntry"
          class="detail-empty"
        >
          <div class="mobile-detail-nav">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-arrow-left"
              :label="$t('apps.clipboard.backToList')"
              @click="mobileActiveView = 'list'"
            />
          </div>
          <UIcon
            name="i-lucide-mouse-pointer-click"
            class="empty-icon"
          />
          <p>{{ $t('apps.clipboard.noSelection') }}</p>
        </div>

        <div
          v-else
          class="detail-wrapper"
        >
          <!-- Mobile Navigation Bar -->
          <div class="mobile-detail-nav">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-arrow-left"
              :label="$t('apps.clipboard.backToList')"
              @click="mobileActiveView = 'list'"
            />
          </div>

          <!-- Detail Header -->
          <div class="detail-header">
            <div class="detail-header-left">
              <UIcon
                :name="getTypeIcon(selectedEntry.type)"
                class="type-hero-icon"
              />
              <div class="type-info">
                <h3 class="type-title">
                  {{ selectedEntry.type.toUpperCase() }}
                </h3>
                <span class="time-subtitle">{{ formatDateTime(selectedEntry.createdAt) }}</span>
              </div>
            </div>

            <div class="detail-header-actions">
              <UButton
                size="xs"
                variant="solid"
                color="primary"
                icon="i-lucide-copy"
                :label="$t('apps.clipboard.copy')"
                @click="handleCopy(selectedEntry)"
              />
              <UButton
                size="xs"
                :variant="selectedEntry.pinned ? 'soft' : 'outline'"
                :color="selectedEntry.pinned ? 'primary' : 'neutral'"
                :icon="selectedEntry.pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                :label="selectedEntry.pinned ? $t('apps.clipboard.unpin') : $t('apps.clipboard.pin')"
                @click="handleTogglePin(selectedEntry)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                @click="handleDelete(selectedEntry)"
              />
            </div>
          </div>

          <!-- Detail Body Preview -->
          <div class="detail-preview-area">
            <!-- Text/HTML Viewer -->
            <div
              v-if="selectedEntry.type === 'text' || selectedEntry.type === 'html'"
              class="text-preview-container"
            >
              <div class="text-preview-topbar">
                <div class="text-stats">
                  <span>{{ selectedEntry.content.length }} 文字</span>
                  <span>{{ selectedEntry.content.split(/\r\n|\r|\n/).length }} 行</span>
                  <span>{{ formatBytes(selectedEntry.metadata?.sizeBytes) }}</span>
                </div>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-file-text"
                  :label="$t('apps.clipboard.openInTextEditor')"
                  @click="openInTextEditor(selectedEntry)"
                />
              </div>
              <pre class="formatted-text-content"><code>{{ selectedEntry.content }}</code></pre>
            </div>

            <!-- Image Viewer -->
            <div
              v-else-if="selectedEntry.type === 'image'"
              class="image-preview-container"
            >
              <div class="image-preview-topbar">
                <div class="image-stats">
                  <span>{{ selectedEntry.metadata?.mimeType || 'image/png' }}</span>
                  <span v-if="selectedEntry.metadata?.width">{{ selectedEntry.metadata.width }} × {{ selectedEntry.metadata.height }} px</span>
                  <span>{{ formatBytes(selectedEntry.metadata?.sizeBytes) }}</span>
                </div>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-image"
                  :label="$t('apps.clipboard.openInImageViewer')"
                  @click="openInImageViewer(selectedEntry)"
                />
              </div>
              <div class="image-stage">
                <img
                  :src="selectedEntry.content"
                  alt="Full preview"
                  class="full-image-preview"
                >
              </div>
            </div>

            <!-- Files Viewer -->
            <div
              v-else-if="selectedEntry.type === 'files'"
              class="files-preview-container"
            >
              <div class="files-preview-topbar">
                <div class="files-stats">
                  <span>{{ selectedEntry.metadata?.paths?.length || 0 }} ファイル</span>
                  <span v-if="selectedEntry.metadata?.mountId">Mount: {{ selectedEntry.metadata.mountId }}</span>
                </div>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-folder"
                  :label="$t('apps.clipboard.openInFileManager')"
                  @click="openInFileManager(selectedEntry)"
                />
              </div>
              <div class="files-list-box">
                <div
                  v-for="(path, idx) in selectedEntry.metadata?.paths || []"
                  :key="idx"
                  class="file-item-row"
                >
                  <UIcon
                    name="i-lucide-file"
                    class="row-icon"
                  />
                  <span class="file-path-text">{{ path }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Metadata Breakdown Footer -->
          <div class="detail-metadata-card">
            <h4 class="meta-section-title">
              {{ $t('apps.clipboard.metadata') }}
            </h4>
            <div class="meta-grid">
              <div class="meta-field">
                <span class="field-label">ID</span>
                <span class="field-value mono">{{ selectedEntry.id }}</span>
              </div>
              <div class="meta-field">
                <span class="field-label">{{ $t('apps.clipboard.createdAt') }}</span>
                <span class="field-value">{{ formatDateTime(selectedEntry.createdAt) }}</span>
              </div>
              <div class="meta-field">
                <span class="field-label">{{ $t('apps.clipboard.type') }}</span>
                <span class="field-value">{{ selectedEntry.type }}</span>
              </div>
              <div class="meta-field">
                <span class="field-label">{{ $t('apps.clipboard.size') }}</span>
                <span class="field-value">{{ formatBytes(selectedEntry.metadata?.sizeBytes) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.clipboard-app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--ui-bg, #09090b);
  color: var(--ui-text, #f4f4f5);
  font-family: inherit;
  overflow: hidden;
}

.app-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--ui-border, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.02);
  flex-wrap: wrap;
}

.toolbar-search {
  width: 220px;
}

.filter-btn-group {
  display: flex;
  gap: 0.25rem;
}

.toolbar-right-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.app-main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.history-sidebar {
  width: 280px;
  min-width: 240px;
  max-width: 340px;
  border-right: 1px solid var(--ui-border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.15);
}

.sidebar-header-status {
  padding: 0.375rem 0.75rem;
  font-size: 0.6875rem;
  color: var(--ui-text-muted, #71717a);
  border-bottom: 1px solid var(--ui-border, rgba(255, 255, 255, 0.05));
}

.list-empty-state {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--ui-text-muted, #71717a);
  font-size: 0.8125rem;
  padding: 2rem;

  .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    opacity: 0.4;
  }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
  }
}

.list-card-item {
  position: relative;
  padding: 0.5rem 0.625rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.06));
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);

    .card-hover-actions {
      opacity: 1;
    }
  }

  &.selected {
    background: rgba(168, 85, 247, 0.1);
    border-color: var(--ui-primary, #a855f7);
  }

  &.pinned {
    border-left: 3px solid var(--ui-primary, #a855f7);
  }
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.type-badge-box {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--ui-primary, #c084fc);
  text-transform: uppercase;

  .type-icon {
    font-size: 0.75rem;
  }
}

.card-time {
  font-size: 0.6875rem;
  color: var(--ui-text-muted, #71717a);
}

.card-text-snippet {
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--ui-text, #e4e4e7);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.card-image-snippet {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .thumb {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
    background: #000;
  }

  .img-dims {
    font-size: 0.6875rem;
    color: var(--ui-text-muted, #a1a1aa);
  }
}

.card-files-snippet {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #e4e4e7;

  .files-icon {
    font-size: 0.875rem;
    color: var(--ui-primary, #a855f7);
  }

  .files-names {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.card-hover-actions {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  gap: 0.125rem;
  background: rgba(24, 24, 27, 0.9);
  padding: 0.125rem;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.mini-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background: transparent;
  border: none;
  color: var(--ui-text-muted, #a1a1aa);
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  &.active {
    color: var(--ui-primary, #c084fc);
  }

  .icon {
    font-size: 0.75rem;
  }
}

.detail-inspector {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
}

.detail-empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--ui-text-muted, #71717a);
  font-size: 0.875rem;

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    opacity: 0.3;
  }
}

.detail-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.875rem 1rem;
  gap: 0.75rem;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--ui-border, rgba(255, 255, 255, 0.08));
}

.detail-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .type-hero-icon {
    font-size: 1.75rem;
    color: var(--ui-primary, #a855f7);
  }

  .type-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .time-subtitle {
    font-size: 0.6875rem;
    color: var(--ui-text-muted, #71717a);
  }
}

.detail-header-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.detail-preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.08));
  border-radius: 0.5rem;
  overflow: hidden;
  min-height: 200px;
}

.text-preview-container,
.image-preview-container,
.files-preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.text-preview-topbar,
.image-preview-topbar,
.files-preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--ui-border, rgba(255, 255, 255, 0.06));
  font-size: 0.75rem;
  color: var(--ui-text-muted, #a1a1aa);

  .text-stats, .image-stats, .files-stats {
    display: flex;
    gap: 0.75rem;
  }
}

.formatted-text-content {
  margin: 0;
  padding: 0.75rem;
  flex: 1;
  overflow-y: auto;
  font-family: 'Fira Code', monospace, Consolas;
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: #f4f4f5;
}

.image-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: auto;
  background-image: linear-gradient(45deg, #18181b 25%, transparent 25%),
                    linear-gradient(-45deg, #18181b 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #18181b 75%),
                    linear-gradient(-45deg, transparent 75%, #18181b 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;

  .full-image-preview {
    max-width: 100%;
    max-height: 280px;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
}

.files-list-box {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
}

.file-item-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.375rem;
  font-size: 0.8125rem;

  .row-icon {
    font-size: 1rem;
    color: var(--ui-primary, #a855f7);
  }

  .file-path-text {
    font-family: monospace;
  }
}

.detail-metadata-card {
  padding: 0.625rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.06));
  border-radius: 0.5rem;

  .meta-section-title {
    margin: 0 0 0.375rem 0;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--ui-text-muted, #71717a);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .meta-field {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;

    .field-label {
      font-size: 0.625rem;
      color: var(--ui-text-muted, #71717a);
    }

    .field-value {
      font-size: 0.75rem;
      color: var(--ui-text, #e4e4e7);

      &.mono {
        font-family: monospace;
        font-size: 0.6875rem;
      }
    }
  }
}

.mobile-detail-nav {
  display: none;

  @media (max-width: 640px) {
    display: flex;
    align-items: center;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--ui-border, rgba(255, 255, 255, 0.08));
    background: rgba(0, 0, 0, 0.2);
    margin-bottom: 0.5rem;
  }
}

@media (max-width: 640px) {
  .app-toolbar {
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
  }

  .toolbar-search {
    width: 100%;
    order: 1;
  }

  .filter-btn-group {
    order: 2;
    overflow-x: auto;
    width: 100%;
    padding-bottom: 0.125rem;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .toolbar-right-actions {
    order: 3;
    width: 100%;
    justify-content: flex-end;
    margin-left: 0;
  }

  .app-main-layout {
    position: relative;
  }

  .history-sidebar {
    width: 100%;
    max-width: 100%;
    min-width: 100%;
    border-right: none;

    &.mobile-hidden {
      display: none;
    }
  }

  .detail-inspector {
    width: 100%;
    min-width: 100%;

    &.mobile-hidden {
      display: none;
    }
  }
}
</style>
