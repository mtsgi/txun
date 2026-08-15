<script setup lang="ts">
import type { AppFont, AppRadius, AppUIScale, AppFontSize, TaskbarPosition, TaskbarSize, TaskbarTaskAlign, TaskbarTaskDisplay } from '../../stores/desktop'
import type { TaskbarInsets } from '../../utils/window-manager'
import { useClipboardStore } from '../../stores/clipboard'

/** 永続化する設定データの型 */
type UserSettings = {
  theme: 'light' | 'dark'
  locale: 'ja' | 'en'
  font: AppFont
  primaryColor: string
  wallpaper: string
  radius: AppRadius
  uiScale?: AppUIScale
  safeArea?: boolean
  backgroundOpacity?: number
  backgroundBlur?: boolean
  fontSize?: AppFontSize
  taskbarPosition?: TaskbarPosition
  taskbarSize?: TaskbarSize
  taskbarTaskAlign?: TaskbarTaskAlign
  taskbarTaskDisplay?: TaskbarTaskDisplay
  showTopVDesktopBar?: boolean
  shortcuts?: Record<string, string>
}

/** CSS 変数 --ui-radius / --desktop-radius に設定する値のマッピング */
const RADIUS_CSS: Record<AppRadius, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem'
}

/** --desktop-radius（ウィンドウ・ランチャーなどカスタムコンポーネント用）のマッピング */
const DESKTOP_RADIUS_CSS: Record<AppRadius, string> = {
  none: '0',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem'
}

/** UI スケール → CSS zoom 数値のマッピング */
const UI_SCALE_ZOOM: Record<AppUIScale, string> = {
  sm: '0.9',
  md: '1',
  lg: '1.1'
}

/** フォントサイズ → px 値のマッピング */
const FONT_SIZE_PX: Record<AppFontSize, string> = {
  sm: '14px',
  md: '16px',
  lg: '17px',
  xl: '18px'
}

function applyRadius(radius: AppRadius): void {
  const uiCss = RADIUS_CSS[radius]
  const desktopCss = DESKTOP_RADIUS_CSS[radius]
  if (uiCss) document.documentElement.style.setProperty('--ui-radius', uiCss)
  if (desktopCss) document.documentElement.style.setProperty('--desktop-radius', desktopCss)
}

function applyUIScale(scale: AppUIScale): void {
  const zoom = UI_SCALE_ZOOM[scale] ?? '1'
  document.documentElement.style.setProperty('--desktop-zoom-num', zoom)
}

function applyBackgroundOpacity(opacity: number): void {
  document.documentElement.style.setProperty('--desktop-bg-opacity', `${opacity}%`)
}

function applyBackgroundBlur(enabled: boolean): void {
  document.documentElement.style.setProperty('--desktop-blur', enabled ? '12px' : '0px')
}

function applyFontSize(size: AppFontSize): void {
  const px = FONT_SIZE_PX[size]
  if (px) document.documentElement.style.fontSize = px
}

const SETTINGS_KEY = 'user-settings'
const MOBILE_BREAKPOINT = 768
const shellRef = ref<HTMLElement | null>(null)
const screenWidth = ref(0)
const screenHeight = ref(0)
const vDesktopVisible = ref(false)

const store = useDesktopStore()
const clipboardStore = useClipboardStore()
const editableContextMenuRef = ref<{ openMenu: (e: MouseEvent, target: HTMLElement) => void, closeMenu: () => void } | null>(null)
const { isOpen: launcherOpen, initLauncher } = useLauncher()
const { openSpotlight } = useSpotlight()
const { setTheme, setLocale } = useWindowManager()
const { saveState, loadState } = useDesktopStorage()
const {
  toggleOverview,
  closeOverview,
  isOverviewOpen,
  nextDesktop,
  prevDesktop,
  switchDesktop,
  desktops
} = useVirtualDesktop()
const fileSystemStore = useFileSystemStore()

const isMobile = computed(() => screenWidth.value < MOBILE_BREAKPOINT)

/** タスクバーサイズ設定値 → px 変換マップ */
const TASKBAR_SIZE_PX: Record<TaskbarSize, number> = { sm: 36, md: 48, lg: 64 }

/** タスクバービューポートサイズ（px） */
const taskbarSizePx = computed(() => TASKBAR_SIZE_PX[store.taskbarSize] ?? 48)

/** タスクバー位置・サイズから計算したウィンドウ領域の四辺インセット */
const taskbarInsets = computed<TaskbarInsets>(() => {
  const s = taskbarSizePx.value
  switch (store.taskbarPosition) {
    case 'top': return { top: s, bottom: 0, left: 0, right: 0 }
    case 'left': return { top: 0, bottom: 0, left: s, right: 0 }
    case 'right': return { top: 0, bottom: 0, left: 0, right: s }
    default: return { top: 0, bottom: s, left: 0, right: 0 }
  }
})

/** ランチャーを開いたときの Transition 名（タスクバー位置に応じて変更） */
const launcherTransitionName = computed(() => {
  if (isMobile.value) return 'launcher-slide'
  switch (store.taskbarPosition) {
    case 'top': return 'launcher-fade-down'
    case 'left': return 'launcher-fade-right'
    case 'right': return 'launcher-fade-left'
    default: return 'launcher-fade-up'
  }
})

/** 仮想デスクトップバーのホバー判定領域スタイル（タスクバー位置に応じて競合を回避） */
const vdesktopTriggerStyle = computed<import('vue').CSSProperties>(() => {
  const size = `${taskbarSizePx.value}px`
  switch (store.taskbarPosition) {
    case 'top':
      return { bottom: '0', left: '0', right: '0', height: size }
    case 'left':
      return { top: '0', left: size, right: '0', height: size }
    case 'right':
      return { top: '0', left: '0', right: size, height: size }
    default:
      return { top: '0', left: '0', right: '0', height: size }
  }
})

/** 仮想デスクトップバーのスライドトランジション名（タスクバー位置に応じて方向変更） */
const vdesktopTransitionName = computed(() =>
  store.taskbarPosition === 'top' ? 'vdesktop-slide-up' : 'vdesktop-slide-down'
)

const { toDefineShortcutKey } = useShortcuts()

const shellShortcuts = computed(() => {
  const config: Record<string, { handler: () => void, usingInput?: boolean }> = {}

  // Escape で Overview を閉じる
  config['escape'] = {
    handler: () => {
      if (isOverviewOpen.value) closeOverview()
    },
    usingInput: true
  }

  // スポットライト検索トグル
  const spotlightKey = toDefineShortcutKey(store.shortcuts?.toggleSpotlight || 'Ctrl+k')
  if (spotlightKey) {
    config[spotlightKey] = {
      handler: () => openSpotlight(),
      usingInput: false
    }
  }

  // アプリランチャートグル
  const launcherKey = toDefineShortcutKey(store.shortcuts?.toggleLauncher || 'Alt+Space')
  if (launcherKey) {
    config[launcherKey] = {
      handler: () => initLauncher(),
      usingInput: false
    }
  }

  // タスクビュー / Overview トグル
  const overviewKey = toDefineShortcutKey(store.shortcuts?.toggleOverview || 'Ctrl+Alt+ArrowUp')
  if (overviewKey) {
    config[overviewKey] = {
      handler: () => toggleOverview(),
      usingInput: false
    }
  }
  // 予備ショートカット（Win+Tab, Ctrl+Shift+Tab, Ctrl+` 等）
  config['ctrl_shift_tab'] = { handler: () => toggleOverview(), usingInput: false }
  config['ctrl_`'] = { handler: () => toggleOverview(), usingInput: false }
  config['meta_arrowup'] = { handler: () => toggleOverview(), usingInput: false }

  // 前の仮想デスクトップへ移動
  const prevKey = toDefineShortcutKey(store.shortcuts?.prevDesktop || 'Ctrl+Alt+ArrowLeft')
  if (prevKey) {
    config[prevKey] = {
      handler: () => prevDesktop(),
      usingInput: false
    }
  }
  config['meta_ctrl_arrowleft'] = { handler: () => prevDesktop(), usingInput: false }

  // 次の仮想デスクトップへ移動
  const nextKey = toDefineShortcutKey(store.shortcuts?.nextDesktop || 'Ctrl+Alt+ArrowRight')
  if (nextKey) {
    config[nextKey] = {
      handler: () => nextDesktop(),
      usingInput: false
    }
  }
  config['meta_ctrl_arrowright'] = { handler: () => nextDesktop(), usingInput: false }

  // アクティブウィンドウを閉じる
  const closeWindowKey = toDefineShortcutKey(store.shortcuts?.closeWindow || 'Alt+w')
  if (closeWindowKey) {
    config[closeWindowKey] = {
      handler: () => {
        if (store.topWindow) store.closeWindow(store.topWindow.id)
      },
      usingInput: false
    }
  }

  // アクティブウィンドウを最小化
  const minWindowKey = toDefineShortcutKey(store.shortcuts?.minimizeWindow || 'Alt+m')
  if (minWindowKey) {
    config[minWindowKey] = {
      handler: () => {
        if (store.topWindow) store.minimizeWindow(store.topWindow.id)
      },
      usingInput: false
    }
  }

  // アクティブウィンドウを最大化/元に戻す
  const maxWindowKey = toDefineShortcutKey(store.shortcuts?.maximizeWindow || 'Alt+Enter')
  if (maxWindowKey) {
    config[maxWindowKey] = {
      handler: () => {
        if (store.topWindow) store.toggleMaximize(store.topWindow.id)
      },
      usingInput: false
    }
  }

  // クリップボード履歴トグル
  const clipKey = toDefineShortcutKey(store.shortcuts?.toggleClipboardHistory || 'Meta+v')
  if (clipKey) {
    config[clipKey] = {
      handler: () => clipboardStore.toggleQuickHistory(),
      usingInput: true
    }
  }
  config['ctrl_shift_v'] = { handler: () => clipboardStore.toggleQuickHistory(), usingInput: true }
  config['meta_v'] = { handler: () => clipboardStore.toggleQuickHistory(), usingInput: true }

  // Alt + 1..9 で対応するデスクトップへジャンプ
  for (let i = 1; i <= 9; i++) {
    config[`alt_${i}`] = {
      handler: () => {
        const target = desktops.value[i - 1]
        if (target) switchDesktop(target.id)
      },
      usingInput: false
    }
  }

  return config
})

defineShortcuts(shellShortcuts)

function updateSize() {
  if (!shellRef.value) return
  screenWidth.value = shellRef.value.clientWidth
  screenHeight.value = shellRef.value.clientHeight
}

function onGlobalContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return

  // 明示的な除外属性があればスキップ
  if (target.closest('[data-no-txun-contextmenu]')) return

  // 入力要素（input, textarea, contenteditable, [data-txun-editable]）の判定
  const editableTarget = target.closest('input, textarea, [contenteditable="true"], [data-txun-editable]') as HTMLElement | null
  if (editableTarget && editableContextMenuRef.value) {
    clipboardStore.setLastEditableTarget(editableTarget)
    e.preventDefault()
    e.stopPropagation()
    editableContextMenuRef.value.openMenu(e, editableTarget)
  }
}

function onGlobalFocusIn(e: FocusEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  if (target.closest('.clipboard-history-panel, .editable-context-menu-container')) return

  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target.isContentEditable
    || target.hasAttribute('data-txun-editable')
  ) {
    clipboardStore.setLastEditableTarget(target)
  }
}

function onGlobalSelectionChange() {
  if (typeof document === 'undefined') return
  const active = document.activeElement as HTMLElement | null
  if (!active) return
  if (active.closest('.clipboard-history-panel, .editable-context-menu-container')) return

  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    clipboardStore.setLastEditableTarget(active, active.selectionStart ?? undefined, active.selectionEnd ?? undefined)
  }
}

function onGlobalCopy(_e: ClipboardEvent) {
  const sel = window.getSelection()?.toString()
  if (sel && sel.trim()) {
    clipboardStore.copyText(sel, { syncNative: false })
  }
}

function onGlobalCut(_e: ClipboardEvent) {
  const sel = window.getSelection()?.toString()
  if (sel && sel.trim()) {
    clipboardStore.copyText(sel, { syncNative: false })
  }
}

function onGlobalPaste(e: ClipboardEvent) {
  if (e.clipboardData) {
    const text = e.clipboardData.getData('text/plain')
    const html = e.clipboardData.getData('text/html')
    const files = e.clipboardData.files

    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              clipboardStore.copyImage(reader.result, {
                mimeType: file.type,
                fileName: file.name,
                syncNative: false
              })
            }
          }
          reader.readAsDataURL(file)
        }
      }
    } else if (text && text.trim()) {
      clipboardStore.copyText(text, { html: html || undefined, syncNative: false })
    }
  }
}

function onWindowFocus() {
  clipboardStore.syncFromNativeClipboard().catch(() => {})
}

onMounted(async () => {
  updateSize()
  window.addEventListener('resize', updateSize)
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('focusin', onGlobalFocusIn)
  document.addEventListener('selectionchange', onGlobalSelectionChange)
  window.addEventListener('contextmenu', onGlobalContextMenu, true)
  window.addEventListener('copy', onGlobalCopy)
  window.addEventListener('cut', onGlobalCut)
  window.addEventListener('paste', onGlobalPaste)
  initLauncher()
  await fileSystemStore.restoreMounts()
  await clipboardStore.restoreFromStorage()

  const saved = await loadState<UserSettings>(SETTINGS_KEY)
  if (saved) {
    if (saved.theme) setTheme(saved.theme)
    if (saved.locale) setLocale(saved.locale)
    if (saved.font) store.setFont(saved.font)
    if (saved.primaryColor) store.setPrimaryColor(saved.primaryColor)
    if (saved.wallpaper) store.setWallpaper(saved.wallpaper)
    if (saved.radius) {
      store.setRadius(saved.radius)
      applyRadius(saved.radius)
    }
    const uiScale = saved.uiScale ?? store.uiScale
    store.setUIScale(uiScale)
    applyUIScale(uiScale)
    const safeArea = saved.safeArea ?? store.safeArea
    store.setSafeArea(safeArea)
    const bgOpacity = saved.backgroundOpacity ?? store.backgroundOpacity
    store.setBackgroundOpacity(bgOpacity)
    applyBackgroundOpacity(bgOpacity)
    const bgBlur = saved.backgroundBlur ?? store.backgroundBlur
    store.setBackgroundBlur(bgBlur)
    applyBackgroundBlur(bgBlur)
    const fontSize = saved.fontSize ?? store.fontSize
    store.setFontSize(fontSize)
    applyFontSize(fontSize)
    if (saved.taskbarPosition) store.setTaskbarPosition(saved.taskbarPosition)
    if (saved.taskbarSize) store.setTaskbarSize(saved.taskbarSize)
    if (saved.taskbarTaskAlign) store.setTaskbarTaskAlign(saved.taskbarTaskAlign)
    if (saved.taskbarTaskDisplay) store.setTaskbarTaskDisplay(saved.taskbarTaskDisplay)
    if (saved.showTopVDesktopBar !== undefined) store.setShowTopVDesktopBar(saved.showTopVDesktopBar)
    if (saved.shortcuts) store.setShortcuts(saved.shortcuts)
  } else {
    // 初回起動時もデフォルト値を CSS に反映
    applyRadius(store.radius)
    applyUIScale(store.uiScale)
    applyBackgroundOpacity(store.backgroundOpacity)
    applyBackgroundBlur(store.backgroundBlur)
    applyFontSize(store.fontSize)
  }
})

watch(
  [
    () => store.theme,
    () => store.locale,
    () => store.font,
    () => store.primaryColor,
    () => store.wallpaper,
    () => store.radius,
    () => store.uiScale,
    () => store.safeArea,
    () => store.backgroundOpacity,
    () => store.backgroundBlur,
    () => store.fontSize,
    () => store.taskbarPosition,
    () => store.taskbarSize,
    () => store.taskbarTaskAlign,
    () => store.taskbarTaskDisplay,
    () => store.showTopVDesktopBar,
    () => store.shortcuts
  ],
  async () => {
    await saveState(SETTINGS_KEY, {
      theme: store.theme,
      locale: store.locale,
      font: store.font,
      primaryColor: store.primaryColor,
      wallpaper: store.wallpaper,
      radius: store.radius,
      uiScale: store.uiScale,
      safeArea: store.safeArea,
      backgroundOpacity: store.backgroundOpacity,
      backgroundBlur: store.backgroundBlur,
      fontSize: store.fontSize,
      taskbarPosition: store.taskbarPosition,
      taskbarSize: store.taskbarSize,
      taskbarTaskAlign: store.taskbarTaskAlign,
      taskbarTaskDisplay: store.taskbarTaskDisplay,
      showTopVDesktopBar: store.showTopVDesktopBar,
      shortcuts: store.shortcuts
    })
  },
  { deep: true }
)

watch(() => store.uiScale, scale => applyUIScale(scale))
watch(() => store.backgroundOpacity, opacity => applyBackgroundOpacity(opacity))
watch(() => store.backgroundBlur, enabled => applyBackgroundBlur(enabled))
watch(() => store.fontSize, size => applyFontSize(size))
watch(() => store.radius, radius => applyRadius(radius))

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('focusin', onGlobalFocusIn)
  document.removeEventListener('selectionchange', onGlobalSelectionChange)
  window.removeEventListener('contextmenu', onGlobalContextMenu, true)
  window.removeEventListener('copy', onGlobalCopy)
  window.removeEventListener('cut', onGlobalCut)
  window.removeEventListener('paste', onGlobalPaste)
})
</script>

<template>
  <div
    ref="shellRef"
    class="desktop-shell"
    :class="{ 'safe-area': store.safeArea }"
  >
    <!-- Wallpaper -->
    <DesktopWallpaper />

    <!-- Virtual desktop indicator (hover zone, PC only) -->
    <div
      v-if="!isMobile && store.showTopVDesktopBar"
      class="vdesktop-trigger"
      :style="vdesktopTriggerStyle"
      @mouseenter="vDesktopVisible = true"
      @mouseleave="vDesktopVisible = false"
    >
      <Transition :name="vdesktopTransitionName">
        <DesktopVirtualDesktopBar
          v-if="vDesktopVisible"
          :taskbar-position="store.taskbarPosition"
        />
      </Transition>
    </div>

    <!-- Window layer -->
    <DesktopWindowContainer
      :screen-width="screenWidth"
      :screen-height="screenHeight"
      :taskbar-insets="taskbarInsets"
      :is-mobile="isMobile"
    />

    <!-- Taskbar -->
    <DesktopTaskBar
      :screen-width="screenWidth"
      :is-mobile="isMobile"
    />

    <!-- Spotlight -->
    <DesktopSpotlight />

    <!-- File Dialog -->
    <DesktopFileDialog />

    <!-- Clipboard History Popup -->
    <DesktopClipboardHistory />

    <!-- Editable Context Menu -->
    <DesktopEditableContextMenu ref="editableContextMenuRef" />

    <!-- App Launcher -->
    <Transition :name="launcherTransitionName">
      <DesktopAppLauncher
        v-if="launcherOpen"
        :is-mobile="isMobile"
        :screen-width="screenWidth"
        :taskbar-position="store.taskbarPosition"
        :taskbar-size-px="taskbarSizePx"
      />
    </Transition>

    <!-- Virtual Desktop Overview (Mission Control / Task View) -->
    <DesktopVirtualDesktopOverview
      :screen-width="screenWidth"
      :screen-height="screenHeight"
      :is-mobile="isMobile"
    />
  </div>
</template>

<style lang="scss" scoped>
.desktop-shell {
  position: relative;
  // zoom で縮小拡大した際もビューポートをはみ出さないよう、zoom の逆数でサイズを補正する
  width: calc(100vw / var(--desktop-zoom-num, 1));
  height: calc(100vh / var(--desktop-zoom-num, 1));
  overflow: hidden;
  zoom: var(--desktop-zoom-num, 1);
}

// PC: 下から上にフェード（タスクバーは下配置）
.launcher-fade-up-enter-active,
.launcher-fade-up-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.launcher-fade-up-enter-from,
.launcher-fade-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

// PC: 上から下にフェード（タスクバーは上配置）
.launcher-fade-down-enter-active,
.launcher-fade-down-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.launcher-fade-down-enter-from,
.launcher-fade-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// PC: 左から右にフェード（タスクバーは左配置）
.launcher-fade-right-enter-active,
.launcher-fade-right-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.launcher-fade-right-enter-from,
.launcher-fade-right-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

// PC: 右から左にフェード（タスクバーは右配置）
.launcher-fade-left-enter-active,
.launcher-fade-left-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.launcher-fade-left-enter-from,
.launcher-fade-left-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

// SP: ボトムシートスライド
.launcher-slide-enter-active,
.launcher-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.launcher-slide-enter-from,
.launcher-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.desktop-shell.safe-area {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.vdesktop-trigger {
  position: absolute;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
}

// 上から下にスライド（タスクバー下/左/右の場合: バーは上端に表示）
.vdesktop-slide-down-enter-active,
.vdesktop-slide-down-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.vdesktop-slide-down-enter-from,
.vdesktop-slide-down-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

// 下から上にスライド（タスクバー上の場合: バーは下端に表示）
.vdesktop-slide-up-enter-active,
.vdesktop-slide-up-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.vdesktop-slide-up-enter-from,
.vdesktop-slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
