<script setup lang="ts">
import { useClipboardStore } from '../../stores/clipboard'
import type { ClipboardEntry } from '../../stores/clipboard'
import { useClipboard } from '../../composables/useClipboard'
import { useDesktopStore } from '../../stores/desktop'

const store = useClipboardStore()
const desktopStore = useDesktopStore()
const { pasteEntry, togglePin, removeEntry, clearHistory, closeQuickHistory } = useClipboard()
const { t } = useI18n()

const selectedIndex = ref(0)
const searchInputRef = ref<{ inputRef?: HTMLInputElement } | null>(null)
const listContainerRef = ref<HTMLElement | null>(null)

const entries = computed(() => store.filteredHistory)

// 開いたときのフォーカス・初期化・ホストOS同期
watch(
  () => store.isQuickHistoryOpen,
  (open) => {
    if (open) {
      selectedIndex.value = 0
      store.searchQuery = ''
      store.activeFilter = 'all'
      // ホストOS側で新しくコピーされたテキストを即座に取り込み
      store.syncFromNativeClipboard().catch(() => {})
      nextTick(() => {
        const el = searchInputRef.value?.inputRef || (document.querySelector('.clipboard-search-input input') as HTMLInputElement | null)
        el?.focus()
      })
    }
  }
)

// 検索やフィルター変更時に選択インデックスを安全な範囲に保つ
watch(
  () => entries.value.length,
  (len) => {
    if (selectedIndex.value >= len) {
      selectedIndex.value = Math.max(0, len - 1)
    }
  }
)

function handleItemClick(entry: ClipboardEntry) {
  closeQuickHistory()
  nextTick(() => {
    pasteEntry(entry)
  })
}

function handleClearAll() {
  if (confirm(t('core.desktop.clipboard.clearConfirm'))) {
    clearHistory(true)
  }
}

function openFullClipboardApp() {
  closeQuickHistory()
  const app = desktopStore.apps.find(a => a.id === 'clipboard')
  if (app) {
    desktopStore.openWindow(app)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!store.isQuickHistoryOpen) return

  if (e.key === 'Escape') {
    e.preventDefault()
    closeQuickHistory()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < entries.value.length - 1) {
      selectedIndex.value++
      scrollToSelected()
    }
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
      scrollToSelected()
    }
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    const target = entries.value[selectedIndex.value]
    if (target) {
      handleItemClick(target)
    }
    return
  }

  if (e.key === 'Delete' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    const target = entries.value[selectedIndex.value]
    if (target) {
      removeEntry(target.id)
    }
  }
}

function scrollToSelected() {
  nextTick(() => {
    if (!listContainerRef.value) return
    const el = listContainerRef.value.querySelector<HTMLElement>(`[data-index="${selectedIndex.value}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'たった今'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`
  const date = new Date(ts)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
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

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="clip-overlay">
      <div
        v-if="store.isQuickHistoryOpen"
        class="clipboard-history-backdrop"
        @click.self="closeQuickHistory"
      >
        <UCard
          class="clipboard-history-panel"
          :ui="{
            root: 'overflow-hidden flex flex-col',
            header: 'p-3 pb-2 border-b border-[var(--ui-border)]',
            body: 'p-0 flex-1 overflow-hidden flex flex-col',
            footer: 'p-2.5 px-3 border-t border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/40'
          }"
        >
          <template #header>
            <div class="panel-header-content">
              <div class="mobile-drag-handle" />
              <div class="header-title-row">
                <div class="title-with-icon">
                  <UIcon
                    name="i-lucide-clipboard-list"
                    class="title-icon"
                  />
                  <span class="panel-title">{{ $t('core.desktop.clipboard.title') }}</span>
                  <UBadge
                    size="xs"
                    variant="subtle"
                    color="neutral"
                  >
                    {{ entries.length }}
                  </UBadge>
                </div>
                <div class="header-actions">
                  <UTooltip :text="$t('core.desktop.clipboard.openApp')">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-external-link"
                      @click="openFullClipboardApp"
                    />
                  </UTooltip>
                  <UTooltip :text="$t('core.desktop.clipboard.clearAll')">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-trash-2"
                      :disabled="entries.length === 0"
                      @click="handleClearAll"
                    />
                  </UTooltip>
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-x"
                    @click="closeQuickHistory"
                  />
                </div>
              </div>

              <!-- Search Box -->
              <UInput
                ref="searchInputRef"
                v-model="store.searchQuery"
                icon="i-lucide-search"
                size="xs"
                class="clipboard-search-input"
                :placeholder="$t('core.desktop.clipboard.searchPlaceholder')"
                clearable
              />

              <!-- Type Filter Tabs -->
              <div class="filter-btn-group">
                <UButton
                  size="xs"
                  :variant="store.activeFilter === 'all' ? 'solid' : 'ghost'"
                  :color="store.activeFilter === 'all' ? 'primary' : 'neutral'"
                  :label="$t('core.desktop.clipboard.filterAll')"
                  icon="i-lucide-layers"
                  @click="store.activeFilter = 'all'"
                />
                <UButton
                  size="xs"
                  :variant="store.activeFilter === 'text' ? 'solid' : 'ghost'"
                  :color="store.activeFilter === 'text' ? 'primary' : 'neutral'"
                  :label="$t('core.desktop.clipboard.filterText')"
                  icon="i-lucide-type"
                  @click="store.activeFilter = 'text'"
                />
                <UButton
                  size="xs"
                  :variant="store.activeFilter === 'image' ? 'solid' : 'ghost'"
                  :color="store.activeFilter === 'image' ? 'primary' : 'neutral'"
                  :label="$t('core.desktop.clipboard.filterImage')"
                  icon="i-lucide-image"
                  @click="store.activeFilter = 'image'"
                />
                <UButton
                  size="xs"
                  :variant="store.activeFilter === 'files' ? 'solid' : 'ghost'"
                  :color="store.activeFilter === 'files' ? 'primary' : 'neutral'"
                  :label="$t('core.desktop.clipboard.filterFiles')"
                  icon="i-lucide-folder"
                  @click="store.activeFilter = 'files'"
                />
              </div>
            </div>
          </template>

          <!-- List Items -->
          <div
            ref="listContainerRef"
            class="panel-scroll-content"
          >
            <div
              v-if="entries.length === 0"
              class="empty-state"
            >
              <UIcon
                name="i-lucide-clipboard-x"
                class="empty-icon"
              />
              <p class="empty-text">
                {{ $t('core.desktop.clipboard.empty') }}
              </p>
            </div>

            <div
              v-else
              class="items-list"
            >
              <div
                v-for="(item, index) in entries"
                :key="item.id"
                :data-index="index"
                class="clipboard-item-card"
                :class="{
                  selected: selectedIndex === index,
                  pinned: item.pinned
                }"
                @click="handleItemClick(item)"
                @mouseenter="selectedIndex = index"
              >
                <!-- Card Header info -->
                <div class="card-meta-row">
                  <div class="meta-left">
                    <UIcon
                      :name="getTypeIcon(item.type)"
                      class="type-indicator-icon"
                    />
                    <UBadge
                      size="xs"
                      variant="subtle"
                      :color="item.pinned ? 'primary' : 'neutral'"
                      class="type-badge"
                    >
                      {{ item.type }}
                    </UBadge>
                    <span class="time-label">{{ formatTime(item.createdAt) }}</span>
                  </div>
                  <div class="meta-right">
                    <!-- Pin button -->
                    <UButton
                      size="xs"
                      variant="ghost"
                      :color="item.pinned ? 'primary' : 'neutral'"
                      :icon="item.pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                      :title="item.pinned ? $t('core.desktop.clipboard.unpin') : $t('core.desktop.clipboard.pin')"
                      @click.stop="togglePin(item.id)"
                    />
                    <!-- Delete button -->
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-x"
                      :title="$t('core.desktop.clipboard.delete')"
                      @click.stop="removeEntry(item.id)"
                    />
                  </div>
                </div>

                <!-- Text Content Preview -->
                <div
                  v-if="item.type === 'text' || item.type === 'html'"
                  class="card-body text-body"
                >
                  <p class="text-snippet">
                    {{ item.content }}
                  </p>
                </div>

                <!-- Image Content Preview -->
                <div
                  v-else-if="item.type === 'image'"
                  class="card-body image-body"
                >
                  <img
                    :src="item.content"
                    alt="Clipboard image preview"
                    class="image-thumb"
                    loading="lazy"
                  >
                  <UBadge
                    v-if="item.metadata?.width && item.metadata?.height"
                    size="xs"
                    variant="solid"
                    color="neutral"
                    class="image-info-badge"
                  >
                    {{ item.metadata.width }} × {{ item.metadata.height }}
                  </UBadge>
                </div>

                <!-- Files Content Preview -->
                <div
                  v-else-if="item.type === 'files'"
                  class="card-body files-body"
                >
                  <div class="files-preview-list">
                    <UBadge
                      v-for="(path, pIdx) in (item.metadata?.paths || []).slice(0, 3)"
                      :key="pIdx"
                      size="xs"
                      variant="subtle"
                      color="neutral"
                      icon="i-lucide-file"
                    >
                      {{ path.split('/').pop() }}
                    </UBadge>
                    <span
                      v-if="(item.metadata?.paths?.length || 0) > 3"
                      class="files-more-tag"
                    >
                      +{{ (item.metadata?.paths?.length || 0) - 3 }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer with Hints -->
          <template #footer>
            <div class="panel-footer-content">
              <div class="shortcut-hints">
                <span class="hint-item"><UKbd size="sm">Enter</UKbd> {{ $t('core.desktop.clipboard.paste') }}</span>
                <span class="hint-item"><UKbd size="sm">↑/↓</UKbd> 選択</span>
                <span class="hint-item"><UKbd size="sm">Esc</UKbd> 閉じる</span>
              </div>
              <div class="footer-app-link">
                <UButton
                  size="xs"
                  variant="link"
                  color="primary"
                  trailing-icon="i-lucide-arrow-right"
                  :label="$t('core.desktop.clipboard.openApp')"
                  @click="openFullClipboardApp"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.clipboard-history-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: transparent;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  padding: 1rem 1.5rem 4.5rem;
  pointer-events: auto;
  transition: background-color 0.2s ease;

  @media (max-width: 767px) {
    justify-content: center;
    align-items: flex-end;
    padding: 0;
    background-color: rgba(0, 0, 0, 0.45);
  }
}

.clipboard-history-panel {
  width: 380px;
  max-width: calc(100vw - 2rem);
  height: 520px;
  max-height: calc(100vh - 6rem);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: var(--desktop-radius, 1rem);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);

  @media (max-width: 767px) {
    width: 100%;
    max-width: 100%;
    height: 75vh;
    max-height: 75vh;
    border-radius: 1.25rem 1.25rem 0 0;
    border-bottom: none;
    border-left: none;
    border-right: none;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
}

.mobile-drag-handle {
  display: none;

  @media (max-width: 767px) {
    display: block;
    width: 36px;
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 9999px;
    margin: 0 auto 0.375rem;
    flex-shrink: 0;
  }
}

.panel-header-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .title-icon {
    font-size: 1.125rem;
    color: var(--ui-primary, #a855f7);
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.filter-btn-group {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  padding-bottom: 0.125rem;

  &::-webkit-scrollbar {
    display: none;
  }
}

.panel-scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
  }
}

.empty-state {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ui-text-muted, #71717a);

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 0.8125rem;
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.clipboard-item-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.07));
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;

  &:hover, &.selected {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--ui-primary, rgba(168, 85, 247, 0.5));
    transform: translateY(-1px);
  }

  &.pinned {
    border-left: 3px solid var(--ui-primary, #a855f7);
    background: rgba(168, 85, 247, 0.05);
  }
}

.card-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--ui-text-muted, #a1a1aa);

  .type-indicator-icon {
    font-size: 0.8125rem;
    color: var(--ui-primary, #a855f7);
  }

  .type-badge {
    text-transform: uppercase;
    font-size: 0.625rem;
    letter-spacing: 0.05em;
  }

  .time-label {
    opacity: 0.7;
  }
}

.meta-right {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.card-body {
  font-size: 0.8125rem;
}

.text-snippet {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
  word-break: break-word;
  color: var(--ui-text, #f4f4f5);
  font-family: inherit;
  white-space: pre-wrap;
}

.image-body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.375rem;
  overflow: hidden;
  max-height: 120px;

  .image-thumb {
    max-height: 120px;
    width: auto;
    object-fit: contain;
  }

  .image-info-badge {
    position: absolute;
    bottom: 0.25rem;
    right: 0.25rem;
  }
}

.files-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;

  .files-more-tag {
    font-size: 0.6875rem;
    color: var(--ui-text-muted, #a1a1aa);
    padding: 0.25rem;
  }
}

.panel-footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--ui-text-muted, #71717a);
}

.shortcut-hints {
  display: flex;
  gap: 0.625rem;
  align-items: center;
}

/* Animations */
.clip-overlay-enter-active,
.clip-overlay-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);

  .clipboard-history-panel {
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.clip-overlay-enter-from,
.clip-overlay-leave-to {
  opacity: 0;

  .clipboard-history-panel {
    transform: translateY(12px) scale(0.97);

    @media (max-width: 767px) {
      transform: translateY(100%);
    }
  }
}
</style>
