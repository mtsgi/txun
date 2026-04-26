<script setup lang="ts">
import { resolveComponent } from 'vue'
import { useDesktopStore } from '../../stores/desktop'
import type { WindowState } from '../../stores/desktop'

const props = defineProps<{
  screenWidth: number
  screenHeight: number
  taskbarHeight?: number
  isMobile: boolean
}>()

const store = useDesktopStore()

/** Map AppMeta.component name → resolved Vue component (or fallback div) */
function getAppComponent(win: WindowState) {
  const appMeta = store.apps.find(a => a.id === win.appId)
  if (!appMeta) return 'div'
  return resolveComponent(appMeta.component)
}
</script>

<template>
  <div class="window-container">
    <TransitionGroup
      name="window"
      tag="div"
      class="window-layer"
    >
      <DesktopAppWindow
        v-for="win in store.visibleWindows"
        :key="win.id"
        class="window-pointer"
        :window="win"
        :screen-width="screenWidth"
        :screen-height="screenHeight"
        :taskbar-height="taskbarHeight"
        :is-mobile="props.isMobile"
      >
        <component
          :is="getAppComponent(win)"
          :window-id="win.id"
        />
      </DesktopAppWindow>
    </TransitionGroup>
  </div>
</template>

<style lang="scss" scoped>
.window-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.window-layer {
  pointer-events: none;
  width: 100%;
  height: 100%;
}

:deep(.window-pointer) {
  pointer-events: auto;
}
</style>
