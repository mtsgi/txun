<script setup lang="ts">
const MOBILE_BREAKPOINT = 768
const shellRef = ref<HTMLElement | null>(null)
const screenWidth = ref(0)
const screenHeight = ref(0)
const TASKBAR_HEIGHT = 48

const isMobile = computed(() => screenWidth.value < MOBILE_BREAKPOINT)

function updateSize() {
  if (!shellRef.value) return
  screenWidth.value = shellRef.value.clientWidth
  screenHeight.value = shellRef.value.clientHeight
}

onMounted(() => {
  updateSize()
  window.addEventListener('resize', updateSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
})
</script>

<template>
  <div
    ref="shellRef"
    class="desktop-shell"
  >
    <!-- Wallpaper -->
    <DesktopWallpaper />

    <!-- Virtual desktop indicator (hidden on mobile) -->
    <DesktopVirtualDesktopBar v-if="!isMobile" />

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
  </div>
</template>

<style lang="scss" scoped>
.desktop-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #0a0a0a;
}
</style>
