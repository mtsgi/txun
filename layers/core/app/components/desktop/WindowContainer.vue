<script setup lang="ts">
import { resolveComponent } from 'vue'
import { useDesktopStore } from '../../stores/desktop'
import type { WindowState } from '../../stores/desktop'
import type { TaskbarInsets } from '../../utils/window-manager'

const props = defineProps<{
  screenWidth: number
  screenHeight: number
  taskbarHeight?: number
  taskbarInsets?: TaskbarInsets
  isMobile: boolean
}>()

const store = useDesktopStore()

/** Map AppMeta.component name → resolved Vue component (or fallback div) */
function getAppComponent(win: WindowState) {
  const appMeta = store.apps.find(a => a.id === win.appId)
  if (!appMeta) return 'div'
  return resolveComponent(appMeta.component)
}

/** 仮想デスクトップ切り替え方向に応じたトランジション名 */
const desktopSlideTransition = computed(() => {
  if (store.slideDirection === 'right') return 'vdesktop-slide-right'
  if (store.slideDirection === 'left') return 'vdesktop-slide-left'
  return 'vdesktop-fade'
})
</script>

<template>
  <div class="window-container">
    <Transition :name="desktopSlideTransition">
      <div
        :key="store.activeVirtualDesktopId"
        class="vdesktop-window-layer"
      >
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
            :taskbar-insets="taskbarInsets"
            :is-mobile="props.isMobile"
          >
            <component
              :is="getAppComponent(win)"
              :window-id="win.id"
            />
          </DesktopAppWindow>
        </TransitionGroup>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.window-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.vdesktop-window-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.window-layer {
  pointer-events: none;
  width: 100%;
  height: 100%;
}

:deep(.window-pointer) {
  pointer-events: auto;
}

/* 仮想デスクトップ切り替えアニメーション（右移動時） */
.vdesktop-slide-right-enter-active,
.vdesktop-slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.vdesktop-slide-right-enter-from {
  opacity: 0;
  transform: translateX(80px);
}
.vdesktop-slide-right-leave-to {
  opacity: 0;
  transform: translateX(-80px);
}

/* 仮想デスクトップ切り替えアニメーション（左移動時） */
.vdesktop-slide-left-enter-active,
.vdesktop-slide-left-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.vdesktop-slide-left-enter-from {
  opacity: 0;
  transform: translateX(-80px);
}
.vdesktop-slide-left-leave-to {
  opacity: 0;
  transform: translateX(80px);
}

/* フェードフォールバック */
.vdesktop-fade-enter-active,
.vdesktop-fade-leave-active {
  transition: opacity 0.2s ease;
}
.vdesktop-fade-enter-from,
.vdesktop-fade-leave-to {
  opacity: 0;
}
</style>
