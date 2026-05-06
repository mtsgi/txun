<script setup lang="ts">
const MOBILE_BREAKPOINT = 768
const shellRef = ref<HTMLElement | null>(null)
const screenWidth = ref(0)
const screenHeight = ref(0)
const TASKBAR_HEIGHT = 48
const vDesktopVisible = ref(false)

const isMobile = computed(() => screenWidth.value < MOBILE_BREAKPOINT)

const { isOpen: launcherOpen, initLauncher } = useLauncher()
const { openSpotlight } = useSpotlight()

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

onMounted(() => {
  updateSize()
  window.addEventListener('resize', updateSize)
  window.addEventListener('keydown', onKeydown)
  initLauncher()
})

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
