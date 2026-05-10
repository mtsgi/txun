<script setup lang="ts">
import type { AppFont, AppRadius } from '../../stores/desktop'

/** 永続化する設定データの型 */
type UserSettings = {
  theme: 'light' | 'dark'
  locale: 'ja' | 'en'
  font: AppFont
  primaryColor: string
  wallpaper: string
  radius: AppRadius
}

/** CSS 変数 --ui-radius に設定する値のマッピング */
const RADIUS_CSS: Record<AppRadius, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem'
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
      const radiusCss = RADIUS_CSS[saved.radius]
      if (radiusCss) {
        document.documentElement.style.setProperty('--ui-radius', radiusCss)
      }
    }
  }
})

watch(
  [
    () => store.theme,
    () => store.locale,
    () => store.font,
    () => store.primaryColor,
    () => store.wallpaper,
    () => store.radius
  ],
  async () => {
    await saveState(SETTINGS_KEY, {
      theme: store.theme,
      locale: store.locale,
      font: store.font,
      primaryColor: store.primaryColor,
      wallpaper: store.wallpaper,
      radius: store.radius
    })
  }
)

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="shellRef"
    class="desktop-shell"
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
  width: 100vw;
  height: 100vh;
  overflow: hidden;
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
