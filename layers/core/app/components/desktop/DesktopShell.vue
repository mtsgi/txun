<script setup lang="ts">
import type { AppFont, AppRadius, AppUIScale, AppFontSize } from '../../stores/desktop'

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
const TASKBAR_HEIGHT = 48
const vDesktopVisible = ref(false)

const isMobile = computed(() => screenWidth.value < MOBILE_BREAKPOINT)

const store = useDesktopStore()
const { isOpen: launcherOpen, initLauncher } = useLauncher()
const { openSpotlight } = useSpotlight()
const { setTheme, setLocale } = useWindowManager()
const { saveState, loadState } = useDesktopStorage()

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
    () => store.fontSize
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
      fontSize: store.fontSize
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
      @mouseenter="vDesktopVisible = true"
      @mouseleave="vDesktopVisible = false"
    >
      <Transition name="vdesktop-slide">
        <DesktopVirtualDesktopBar v-if="vDesktopVisible" />
      </Transition>
    </div>

    <!-- Window layer -->
    <DesktopWindowContainer
      :screen-width="screenWidth"
      :screen-height="screenHeight"
      :taskbar-height="TASKBAR_HEIGHT"
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
    <Transition :name="isMobile ? 'launcher-slide' : 'launcher-fade'">
      <DesktopAppLauncher
        v-if="launcherOpen"
        :is-mobile="isMobile"
        :screen-width="screenWidth"
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

// PC: パネルフェード
.launcher-fade-enter-active,
.launcher-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.launcher-fade-enter-from,
.launcher-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  z-index: 20;
  display: flex;
  justify-content: center;
}

.vdesktop-slide-enter-active,
.vdesktop-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.vdesktop-slide-enter-from,
.vdesktop-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-50%);
}
</style>
