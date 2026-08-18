<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import type { WindowState } from '../../stores/desktop'

const props = defineProps<{
  screenWidth: number
  screenHeight: number
  isMobile: boolean
}>()

const store = useDesktopStore()
const {
  isOverviewOpen,
  desktops,
  activeId,
  closeOverview,
  switchDesktop,
  addDesktop,
  removeDesktop,
  renameDesktop,
  moveWindowToDesktop
} = useVirtualDesktop()
const { toggleLauncher } = useLauncher()

/** 壁紙プリセット CSS マップ */
const WALLPAPER_PRESETS: Record<string, string> = {
  'gradient-default': 'linear-gradient(to bottom right, var(--ui-primary), #1a1a1a, #0a0a0a)',
  'gradient-sunset': 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)',
  'gradient-ocean': 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)',
  'gradient-midnight': 'linear-gradient(to bottom, #020617, #0f172a, #1e1b4b)',
  'gradient-forest': 'linear-gradient(135deg, #166534 0%, #065f46 50%, #0a0a0a 100%)',
  'solid-dark': '#0a0a0a',
  'solid-light': '#e5e7eb'
}

/** 現在の壁紙 CSS */
const wallpaperStyle = computed(() => {
  const w = store.wallpaper
  if (w.startsWith('http://') || w.startsWith('https://') || w.startsWith('/')) {
    return { backgroundImage: `url("${w}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: WALLPAPER_PRESETS[w] ?? WALLPAPER_PRESETS['gradient-default'] ?? '#1e1b4b' }
})

/** デスクトップ名変更の編集状態 */
const editingDesktopId = ref<string | null>(null)
const editingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(id: string, currentName: string) {
  editingDesktopId.value = id
  editingName.value = currentName
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function saveRename(id: string) {
  if (editingName.value.trim()) {
    renameDesktop(id, editingName.value.trim())
  }
  editingDesktopId.value = null
}

function cancelRename() {
  editingDesktopId.value = null
}

/** ウィンドウのドラッグ＆ドロップ状態（PC向け） */
const draggingWindowId = ref<string | null>(null)
const hoveredTargetDesktopId = ref<string | null>(null)
const isHoveringNewDesktop = ref(false)

function onWindowDragStart(e: DragEvent, win: WindowState) {
  draggingWindowId.value = win.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', win.id)
  }
}

function onWindowDragEnd() {
  draggingWindowId.value = null
  hoveredTargetDesktopId.value = null
  isHoveringNewDesktop.value = false
}

function onDesktopDragOver(e: DragEvent, desktopId: string) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  hoveredTargetDesktopId.value = desktopId
}

function onDesktopDragLeave(desktopId: string) {
  if (hoveredTargetDesktopId.value === desktopId) {
    hoveredTargetDesktopId.value = null
  }
}

function onDesktopDrop(e: DragEvent, desktopId: string) {
  e.preventDefault()
  const windowId = draggingWindowId.value || e.dataTransfer?.getData('text/plain')
  if (windowId) {
    moveWindowToDesktop(windowId, desktopId)
  }
  onWindowDragEnd()
}

function onNewDesktopDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  isHoveringNewDesktop.value = true
}

function onNewDesktopDragLeave() {
  isHoveringNewDesktop.value = false
}

function onNewDesktopDrop(e: DragEvent) {
  e.preventDefault()
  const windowId = draggingWindowId.value || e.dataTransfer?.getData('text/plain')
  if (windowId) {
    addDesktop()
    const newlyCreated = store.virtualDesktops[store.virtualDesktops.length - 1]
    if (newlyCreated) {
      moveWindowToDesktop(windowId, newlyCreated.id)
    }
  }
  onWindowDragEnd()
}

/** モバイル用タッチスワイプ状態 */
const touchStartY = ref(0)
const touchStartX = ref(0)
const touchOffsetY = ref<Record<string, number>>({})
const isClosingCard = ref<Record<string, boolean>>({})
const isSwipingCard = ref(false)

function onCardTouchStart(e: TouchEvent, winId: string) {
  const touch = e.touches[0]
  if (!touch) return
  touchStartY.value = touch.clientY
  touchStartX.value = touch.clientX
  touchOffsetY.value[winId] = 0
  isSwipingCard.value = false
}

function onCardTouchMove(e: TouchEvent, winId: string) {
  const touch = e.touches[0]
  if (!touch) return
  const deltaY = touch.clientY - touchStartY.value
  const deltaX = touch.clientX - touchStartX.value

  // 上方向のスワイプ検知
  if (deltaY < 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
    isSwipingCard.value = true
    touchOffsetY.value[winId] = deltaY
  }
}

function onCardTouchEnd(e: TouchEvent, winId: string) {
  const currentOffset = touchOffsetY.value[winId] || 0
  if (currentOffset < -70) {
    // 70px 以上上にスワイプされたら閉じるアニメーションを発火
    isClosingCard.value[winId] = true
    setTimeout(() => {
      closeWindow(winId)
      const { [winId]: _y, ...restOffsetY } = touchOffsetY.value
      touchOffsetY.value = restOffsetY
      const { [winId]: _c, ...restClosing } = isClosingCard.value
      isClosingCard.value = restClosing
    }, 220)
  } else {
    // キャンセル時は元の位置に戻す
    touchOffsetY.value[winId] = 0
  }
  setTimeout(() => {
    isSwipingCard.value = false
  }, 50)
}

function onCardClick(win: WindowState) {
  if (isSwipingCard.value) return
  selectWindow(win)
}

/** 指定デスクトップのウィンドウ一覧を取得 */
function getDesktopWindows(desktopId: string): WindowState[] {
  return store.windows.filter(w => w.virtualDesktopId === desktopId)
}

/** ミニチュアサムネイル用のウィンドウ位置計算（百分率） */
function getMiniWindowStyle(win: WindowState) {
  const w = props.screenWidth || 1280
  const h = props.screenHeight || 720
  const left = Math.max(0, Math.min(90, (win.x / w) * 100))
  const top = Math.max(0, Math.min(90, (win.y / h) * 100))
  const width = Math.max(10, Math.min(100 - left, (win.width / w) * 100))
  const height = Math.max(10, Math.min(100 - top, (win.height / h) * 100))

  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`
  }
}

/** ウィンドウ選択時：フォーカス・復元して Overview を閉じる */
function selectWindow(win: WindowState) {
  if (win.isMinimized) {
    store.restoreWindow(win.id)
  } else {
    store.focusWindow(win.id)
  }
  closeOverview()
}

/** ウィンドウを閉じる */
function closeWindow(id: string) {
  store.closeWindow(id)
}

/** デスクトップ切り替え */
function handleSelectDesktop(id: string) {
  switchDesktop(id)
}

/** 背景クリックで閉じる */
function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('overview-backdrop') || (e.target as HTMLElement).classList.contains('overview-container')) {
    closeOverview()
  }
}
const { getShortcutKeys } = useShortcuts()
const overviewShortcutKeys = computed(() => getShortcutKeys('toggleOverview'))
</script>

<template>
  <Transition name="overview-transition">
    <div
      v-if="isOverviewOpen"
      class="overview-backdrop"
      :class="{ 'is-mobile': isMobile }"
      @click="onBackdropClick"
    >
      <div class="overview-container">
        <!-- Top: Header with title, close button -->
        <header class="overview-header">
          <div class="header-left">
            <UIcon
              name="i-lucide-panels-top-left"
              class="header-icon text-primary"
            />
            <h2 class="header-title">
              {{ $t('core.desktop.virtualDesktop.overview') }}
            </h2>
            <UBadge
              color="primary"
              variant="subtle"
              size="sm"
            >
              {{ desktops.length }}
            </UBadge>
          </div>

          <div class="header-right">
            <div
              v-if="!isMobile"
              class="shortcut-tip flex items-center gap-1"
            >
              <template
                v-for="(keyName, idx) in overviewShortcutKeys"
                :key="idx"
              >
                <UKbd>{{ keyName }}</UKbd>
                <span v-if="idx < overviewShortcutKeys.length - 1">+</span>
              </template>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              class="close-overview-btn"
              :aria-label="$t('core.desktop.window.close')"
              @click="closeOverview"
            />
          </div>
        </header>

        <!-- Desktop Mode: Desktops Thumbnails Strip -->
        <section
          v-if="!isMobile"
          class="desktops-strip-wrapper"
        >
          <div class="desktops-strip">
            <UTooltip
              v-for="desktop in desktops"
              :key="desktop.id"
              :text="$t('core.desktop.virtualDesktop.switchTo', { name: desktop.name })"
            >
              <div
                class="desktop-card"
                :class="{
                  'active': desktop.id === activeId,
                  'drag-over': hoveredTargetDesktopId === desktop.id
                }"
                @click="handleSelectDesktop(desktop.id)"
                @dragover="onDesktopDragOver($event, desktop.id)"
                @dragleave="onDesktopDragLeave(desktop.id)"
                @drop="onDesktopDrop($event, desktop.id)"
              >
                <!-- Miniature screen thumbnail -->
                <div
                  class="desktop-thumbnail"
                  :style="wallpaperStyle"
                >
                  <!-- Mini windows in thumbnail -->
                  <div
                    v-for="win in getDesktopWindows(desktop.id)"
                    :key="win.id"
                    class="mini-window"
                    :style="getMiniWindowStyle(win)"
                  >
                    <UIcon
                      :name="win.icon"
                      class="mini-window-icon"
                    />
                  </div>

                  <!-- Active indicator overlay -->
                  <div
                    v-if="desktop.id === activeId"
                    class="active-glow-overlay"
                  />

                  <!-- Remove desktop button (top-right of thumbnail) -->
                  <UButton
                    v-if="desktops.length > 1"
                    size="xs"
                    color="neutral"
                    variant="solid"
                    icon="i-lucide-x"
                    class="remove-desktop-btn"
                    :aria-label="$t('core.desktop.virtualDesktop.remove')"
                    @click.stop="removeDesktop(desktop.id)"
                  />
                </div>

                <!-- Desktop Name / Inline Rename Input -->
                <div class="desktop-name-row">
                  <template v-if="editingDesktopId === desktop.id">
                    <UInput
                      ref="renameInputRef"
                      v-model="editingName"
                      size="xs"
                      :placeholder="$t('core.desktop.virtualDesktop.renamePlaceholder')"
                      @blur="saveRename(desktop.id)"
                      @keydown.enter="saveRename(desktop.id)"
                      @keydown.esc="cancelRename"
                      @click.stop
                    />
                  </template>
                  <template v-else>
                    <span
                      class="desktop-name"
                      @dblclick.stop="startRename(desktop.id, desktop.name)"
                    >
                      {{ desktop.name }}
                    </span>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      class="edit-name-btn"
                      :aria-label="$t('core.desktop.virtualDesktop.rename')"
                      @click.stop="startRename(desktop.id, desktop.name)"
                    />
                  </template>
                </div>
              </div>
            </UTooltip>

            <!-- Add new desktop button -->
            <UTooltip :text="$t('core.desktop.virtualDesktop.add')">
              <button
                class="add-desktop-card"
                :class="{ 'drag-over': isHoveringNewDesktop }"
                :aria-label="$t('core.desktop.virtualDesktop.add')"
                @click="addDesktop"
                @dragover="onNewDesktopDragOver"
                @dragleave="onNewDesktopDragLeave"
                @drop="onNewDesktopDrop"
              >
                <div class="add-desktop-thumbnail">
                  <UIcon
                    name="i-lucide-plus"
                    class="add-icon"
                  />
                </div>
                <span class="add-label">{{ $t('core.desktop.virtualDesktop.add') }}</span>
              </button>
            </UTooltip>
          </div>
        </section>

        <!-- Mobile Mode: Desktops Pills / Chips Bar -->
        <section
          v-else
          class="mobile-desktops-bar"
        >
          <div class="mobile-desktops-list">
            <UButton
              v-for="desktop in desktops"
              :key="desktop.id"
              size="xs"
              :variant="desktop.id === activeId ? 'solid' : 'soft'"
              :color="desktop.id === activeId ? 'primary' : 'neutral'"
              class="mobile-desktop-pill"
              @click="handleSelectDesktop(desktop.id)"
            >
              <span>{{ desktop.name }}</span>
              <UBadge
                v-if="getDesktopWindows(desktop.id).length > 0"
                size="xs"
                :color="desktop.id === activeId ? 'neutral' : 'neutral'"
                :variant="desktop.id === activeId ? 'solid' : 'subtle'"
                class="ml-1"
              >
                {{ getDesktopWindows(desktop.id).length }}
              </UBadge>
            </UButton>

            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-plus"
              class="mobile-add-btn"
              :aria-label="$t('core.desktop.virtualDesktop.add')"
              @click="addDesktop"
            />
          </div>
        </section>

        <USeparator class="overview-sep" />

        <!-- Main Section: Exposé (Desktop Grid) or iOS-style Carousel (Mobile) -->
        <main class="expose-section">
          <div
            v-if="!isMobile"
            class="expose-header"
          >
            <h3 class="expose-title">
              {{ desktops.find(d => d.id === activeId)?.name || 'Desktop' }}
            </h3>
            <span class="expose-hint text-muted">
              {{ $t('core.desktop.virtualDesktop.dragToMove') }}
            </span>
          </div>

          <!-- Windows Display -->
          <template v-if="store.activeWindows.length > 0">
            <!-- PC: Grid Layout -->
            <div
              v-if="!isMobile"
              class="windows-grid"
            >
              <div
                v-for="win in store.activeWindows"
                :key="win.id"
                class="window-card"
                :class="{ 'is-dragging': draggingWindowId === win.id }"
                draggable="true"
                @dragstart="onWindowDragStart($event, win)"
                @dragend="onWindowDragEnd"
                @click="selectWindow(win)"
              >
                <div class="window-card-header">
                  <div class="header-app-info">
                    <UIcon
                      :name="win.icon"
                      class="window-app-icon"
                    />
                    <span class="window-card-title">{{ win.title }}</span>
                  </div>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    class="window-card-close"
                    :aria-label="$t('core.desktop.window.close')"
                    @click.stop="closeWindow(win.id)"
                  />
                </div>

                <div class="window-card-body">
                  <div class="window-preview-mock">
                    <UIcon
                      :name="win.icon"
                      class="preview-bg-icon"
                    />
                    <UBadge
                      v-if="win.isMinimized"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                      class="minimized-tag"
                    >
                      {{ $t('core.desktop.window.minimize') }}
                    </UBadge>
                  </div>
                  <div class="drag-handle-hint">
                    <UIcon
                      name="i-lucide-grip-horizontal"
                      class="grip-icon"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile: iOS-style Horizontal Snap-Scroll Carousel -->
            <div
              v-else
              class="mobile-carousel-wrapper"
            >
              <p class="mobile-swipe-hint text-xs text-muted text-center mb-3">
                <UIcon
                  name="i-lucide-arrow-up"
                  class="inline-block mr-1"
                />
                {{ $t('core.desktop.virtualDesktop.swipeUpToClose') }}
              </p>

              <div class="mobile-carousel">
                <div
                  v-for="win in store.activeWindows"
                  :key="win.id"
                  class="mobile-window-card"
                  :class="{ 'is-closing': isClosingCard[win.id] }"
                  :style="{
                    transform: `translateY(${touchOffsetY[win.id] || 0}px)`,
                    opacity: isClosingCard[win.id] ? 0 : 1
                  }"
                  @touchstart="onCardTouchStart($event, win.id)"
                  @touchmove="onCardTouchMove($event, win.id)"
                  @touchend="onCardTouchEnd($event, win.id)"
                  @click="onCardClick(win)"
                >
                  <!-- Header -->
                  <div class="mobile-card-header">
                    <div class="header-app-info">
                      <UIcon
                        :name="win.icon"
                        class="window-app-icon text-primary"
                      />
                      <span class="window-card-title">{{ win.title }}</span>
                    </div>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-x"
                      class="window-card-close"
                      :aria-label="$t('core.desktop.window.close')"
                      @click.stop="closeWindow(win.id)"
                    />
                  </div>

                  <!-- Body Mockup -->
                  <div class="mobile-card-body">
                    <div class="mobile-preview-mock">
                      <UIcon
                        :name="win.icon"
                        class="preview-bg-icon"
                      />
                      <UBadge
                        v-if="win.isMinimized"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                        class="minimized-tag"
                      >
                        {{ $t('core.desktop.window.minimize') }}
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Empty State -->
          <div
            v-else
            class="empty-state"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="empty-icon text-muted"
            />
            <p class="empty-text">
              {{ $t('core.desktop.virtualDesktop.noWindows') }}
            </p>
            <UButton
              v-if="isMobile"
              icon="i-lucide-layout-grid"
              color="primary"
              variant="soft"
              size="sm"
              @click="closeOverview(); toggleLauncher()"
            >
              {{ $t('core.desktop.taskbar.launcher') }}
            </UButton>
          </div>
        </main>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.overview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: color-mix(in srgb, var(--ui-bg) 65%, rgba(0, 0, 0, 0.65));
  backdrop-filter: blur(28px) saturate(180%);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  user-select: none;
  overscroll-behavior: contain;

  &.is-mobile {
    background: color-mix(in srgb, var(--ui-bg) 85%, rgba(0, 0, 0, 0.85));
    backdrop-filter: blur(20px);
  }
}

.overview-container {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 1.5rem 2rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  gap: 1.25rem;

  .overview-backdrop.is-mobile & {
    padding: 0.75rem 0.75rem 1.5rem;
    gap: 0.75rem;
  }
}

/* Header */
.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 40%, transparent);

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .header-icon {
      font-size: 1.5rem;
    }

    .header-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;

    .shortcut-tip {
      font-size: 0.75rem;
      color: var(--ui-text-muted);
    }

    .close-overview-btn {
      border-radius: 9999px;
    }
  }
}

/* Desktops Strip (Top, PC) */
.desktops-strip-wrapper {
  padding: 0.5rem 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.desktops-strip {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding-bottom: 0.5rem;
}

.desktop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-2px);
  }

  &.active .desktop-thumbnail {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 2px var(--ui-primary), 0 8px 24px -4px rgba(0, 0, 0, 0.4);
  }

  &.drag-over .desktop-thumbnail {
    border-color: var(--ui-primary);
    background-color: color-mix(in srgb, var(--ui-primary) 25%, transparent) !important;
    transform: scale(1.05);
    box-shadow: 0 0 16px var(--ui-primary);
  }
}

.desktop-thumbnail {
  position: relative;
  width: 180px;
  height: 110px;
  border-radius: var(--desktop-radius, 0.75rem);
  border: 2px solid color-mix(in srgb, var(--ui-border) 60%, transparent);
  background-color: var(--ui-bg-elevated);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

  .active-glow-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  }
}

.mini-window {
  position: absolute;
  background: color-mix(in srgb, var(--ui-bg-elevated) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-border) 80%, transparent);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  pointer-events: none;

  .mini-window-icon {
    font-size: 0.75rem;
    opacity: 0.9;
  }
}

.remove-desktop-btn {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;

  &:hover {
    transform: scale(1.1);
  }
}

.desktop-card:hover .remove-desktop-btn {
  opacity: 1;
}

.desktop-name-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 180px;

  .desktop-name {
    font-size: 0.8125rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit-name-btn {
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover .edit-name-btn {
    opacity: 1;
  }
}

.add-desktop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-2px);

    .add-desktop-thumbnail {
      border-color: var(--ui-primary);
      color: var(--ui-primary);
      background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
    }
  }

  &.drag-over .add-desktop-thumbnail {
    border-color: var(--ui-primary);
    background-color: color-mix(in srgb, var(--ui-primary) 20%, transparent);
    transform: scale(1.05);
    box-shadow: 0 0 16px var(--ui-primary);
  }

  .add-desktop-thumbnail {
    width: 180px;
    height: 110px;
    border-radius: var(--desktop-radius, 0.75rem);
    border: 2px dashed color-mix(in srgb, var(--ui-border) 60%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ui-text-muted);
    transition: all 0.2s;

    .add-icon {
      font-size: 1.75rem;
    }
  }

  .add-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--ui-text-muted);
  }
}

/* Mobile Desktops Pills Bar */
.mobile-desktops-bar {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 0.25rem 0;
}

.mobile-desktops-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.mobile-desktop-pill {
  border-radius: 9999px;
  flex-shrink: 0;
}

.mobile-add-btn {
  border-radius: 9999px;
  flex-shrink: 0;
}

.overview-sep {
  opacity: 0.6;
}

/* Exposé Section (Main) */
.expose-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1rem;
  margin-top: 0.25rem;
}

.expose-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;

  .expose-title {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .expose-hint {
    font-size: 0.75rem;
  }
}

/* PC Windows Grid */
.windows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  padding-bottom: 2rem;
}

.window-card {
  position: relative;
  background: color-mix(in srgb, var(--ui-bg-elevated) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-border) 70%, transparent);
  border-radius: var(--desktop-radius, 0.75rem);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  cursor: grab;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-4px) scale(1.02);
    border-color: var(--ui-primary);
    box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--ui-primary);
  }

  &:active {
    cursor: grabbing;
  }

  &.is-dragging {
    opacity: 0.4;
    transform: scale(0.95);
  }
}

.window-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  background: color-mix(in srgb, var(--ui-bg) 50%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 40%, transparent);

  .header-app-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;

    .window-app-icon {
      font-size: 1rem;
      flex-shrink: 0;
    }

    .window-card-title {
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.window-card-body {
  height: 170px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ui-bg-elevated) 40%, transparent);

  .window-preview-mock {
    width: 85%;
    height: 80%;
    border-radius: 6px;
    border: 1px dashed color-mix(in srgb, var(--ui-border) 50%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;

    .preview-bg-icon {
      font-size: 3rem;
      opacity: 0.25;
    }

    .minimized-tag {
      position: absolute;
      bottom: 0.5rem;
    }
  }

  .drag-handle-hint {
    position: absolute;
    bottom: 0.375rem;
    right: 0.5rem;
    color: var(--ui-text-muted);
    opacity: 0.4;

    .grip-icon {
      font-size: 0.875rem;
    }
  }
}

/* Mobile Carousel (iOS App Switcher Style) */
.mobile-carousel-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

.mobile-carousel {
  display: flex;
  gap: 1.25rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 1rem 1.5rem 2rem;
  width: 100%;
  -webkit-overflow-scrolling: touch;
  align-items: center;
  justify-content: flex-start;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mobile-window-card {
  scroll-snap-align: center;
  width: 76vw;
  max-width: 320px;
  height: 52vh;
  max-height: 440px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--ui-bg-elevated) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-border) 80%, transparent);
  border-radius: var(--desktop-radius, 1rem);
  box-shadow: 0 12px 36px -6px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  touch-action: pan-x;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;

  &.is-closing {
    transform: translateY(-200px) scale(0.85) !important;
    opacity: 0 !important;
  }

  &:active {
    transform: scale(0.98);
  }
}

.mobile-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--ui-bg) 60%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 50%, transparent);

  .header-app-info {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    flex: 1;

    .window-app-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .window-card-title {
      font-size: 0.9375rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.mobile-card-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: color-mix(in srgb, var(--ui-bg-elevated) 50%, transparent);

  .mobile-preview-mock {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    border: 1px dashed color-mix(in srgb, var(--ui-border) 60%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: color-mix(in srgb, var(--ui-bg) 20%, transparent);

    .preview-bg-icon {
      font-size: 4rem;
      opacity: 0.3;
    }

    .minimized-tag {
      position: absolute;
      bottom: 0.75rem;
    }
  }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 250px;
  gap: 1rem;

  .empty-icon {
    font-size: 3.5rem;
    opacity: 0.4;
  }

  .empty-text {
    font-size: 0.9375rem;
    color: var(--ui-text-muted);
  }
}

/* Transition */
.overview-transition-enter-active,
.overview-transition-leave-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.overview-transition-enter-from,
.overview-transition-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
