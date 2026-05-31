<script setup lang="ts">
import type { AppFont, AppRadius, AppUIScale, AppFontSize, TaskbarPosition, TaskbarSize, TaskbarTaskAlign, TaskbarTaskDisplay } from '../../stores/desktop'
import type { TaskbarInsets } from '../../utils/window-manager'

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
const { isOpen: launcherOpen, initLauncher } = useLauncher()
const { openSpotlight } = useSpotlight()
const { setTheme, setLocale } = useWindowManager()
const { saveState, loadState } = useDesktopStorage()
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

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault()
    openSpotlight()
  }
}

function updateSize() {
  if (!shellRef.value) return
  screenWidth.value = shellRef.value.clientWidth
  screenHeight.value = shellRef.value.clientHeight
}

onMounted(async () => {
  updateSize()
  window.addEventListener('resize', updateSize)
  window.addEventListener('keydown', onKeydown)
  initLauncher()
  await fileSystemStore.restoreMounts()

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
    () => store.taskbarTaskDisplay
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
      taskbarTaskDisplay: store.taskbarTaskDisplay
    })
  }
)

watch(() => store.uiScale, scale => applyUIScale(scale))
watch(() => store.backgroundOpacity, opacity => applyBackgroundOpacity(opacity))
watch(() => store.backgroundBlur, enabled => applyBackgroundBlur(enabled))
watch(() => store.fontSize, size => applyFontSize(size))
watch(() => store.radius, radius => applyRadius(radius))

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
  window.removeEventListener('keydown', onKeydown)
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
      v-if="!isMobile"
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
