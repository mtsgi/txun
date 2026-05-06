<script setup lang="ts">
import { detectSnapZone, applySnapZone, clampPosition } from '../../utils/window-manager'
import { useDesktopStore } from '../../stores/desktop'
import type { WindowState } from '../../stores/desktop'

const props = defineProps<{
  window: WindowState
  screenWidth: number
  screenHeight: number
  taskbarHeight?: number
  isMobile: boolean
}>()

const store = useDesktopStore()
const taskbarH = computed(() => props.taskbarHeight ?? 48)
const MIN_WIDTH = 240
const MIN_HEIGHT = 140

defineOptions({ inheritAttrs: false })

const isDragging = ref(false)
const isResizing = ref(false)
const snapZone = ref<ReturnType<typeof detectSnapZone>>(null)

const windowStyle = computed(() => {
  if (props.isMobile || props.window.isMaximized) {
    return {
      left: '0',
      top: '0',
      width: `${props.screenWidth}px`,
      height: `${props.screenHeight - taskbarH.value}px`,
      borderRadius: '0',
      boxShadow: 'none',
      zIndex: props.window.zIndex
    }
  }
  return {
    left: `${props.window.x}px`,
    top: `${props.window.y}px`,
    width: `${props.window.width}px`,
    height: `${props.window.height}px`,
    zIndex: props.window.zIndex
  }
})

const snapPreviewStyle = computed(() => {
  if (!snapZone.value) return null
  const b = applySnapZone(snapZone.value, props.screenWidth, props.screenHeight, taskbarH.value)
  return {
    left: `${b.x}px`,
    top: `${b.y}px`,
    width: `${b.width}px`,
    height: `${b.height}px`
  }
})

function onFocus() {
  store.focusWindow(props.window.id)
}

function onTitlebarMouseDown(e: MouseEvent) {
  if (props.isMobile || props.window.isMaximized) return
  e.preventDefault()
  isDragging.value = true
  store.focusWindow(props.window.id)

  const startX = e.clientX - props.window.x
  const startY = e.clientY - props.window.y

  const onMove = (ev: MouseEvent) => {
    if (!isDragging.value) return
    store.updateWindowBounds(props.window.id, {
      x: ev.clientX - startX,
      y: ev.clientY - startY
    })
    snapZone.value = detectSnapZone(ev.clientX, ev.clientY, props.screenWidth, props.screenHeight)
  }

  const onUp = (ev: MouseEvent) => {
    isDragging.value = false
    const zone = !props.isMobile
      ? detectSnapZone(ev.clientX, ev.clientY, props.screenWidth, props.screenHeight)
      : null
    if (zone) {
      store.updateWindowBounds(props.window.id, applySnapZone(zone, props.screenWidth, props.screenHeight, taskbarH.value))
    } else {
      const clamped = clampPosition(
        { x: props.window.x, y: props.window.y, width: props.window.width, height: props.window.height },
        props.screenWidth, props.screenHeight, taskbarH.value
      )
      store.updateWindowBounds(props.window.id, { x: clamped.x, y: clamped.y })
    }
    snapZone.value = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onTitlebarDblClick() {
  store.toggleMaximize(props.window.id)
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function onResizeStart(e: MouseEvent, dir: ResizeDir) {
  if (props.window.isMaximized) return
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  store.focusWindow(props.window.id)

  const start = {
    x: e.clientX,
    y: e.clientY,
    wx: props.window.x,
    wy: props.window.y,
    w: props.window.width,
    h: props.window.height
  }

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - start.x
    const dy = ev.clientY - start.y
    let { wx: x, wy: y, w: width, h: height } = start

    if (dir.includes('e')) width = Math.max(MIN_WIDTH, start.w + dx)
    if (dir.includes('s')) height = Math.max(MIN_HEIGHT, start.h + dy)
    if (dir.includes('w')) {
      const newW = Math.max(MIN_WIDTH, start.w - dx)
      x = start.wx + (start.w - newW)
      width = newW
    }
    if (dir.includes('n')) {
      const newH = Math.max(MIN_HEIGHT, start.h - dy)
      y = start.wy + (start.h - newH)
      height = newH
    }
    store.updateWindowBounds(props.window.id, { x, y, width, height })
  }

  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<template>
  <div
    class="app-window"
    :class="{ 'is-animated': !isDragging && !isResizing }"
    :style="windowStyle"
    v-bind="$attrs"
    @mousedown.capture="onFocus"
  >
    <Teleport to="body">
      <!-- Snap zone preview overlay -->
      <Transition name="snap-preview">
        <div
          v-if="snapPreviewStyle"
          class="snap-preview"
          :style="snapPreviewStyle"
        />
      </Transition>
    </Teleport>
    <!-- Title bar -->
    <div
      class="titlebar"
      @mousedown.self="onTitlebarMouseDown"
      @dblclick="onTitlebarDblClick"
    >
      <UIcon
        :name="window.icon"
        class="titlebar-icon"
      />
      <span class="titlebar-title">
        {{ window.title }}
      </span>
      <div class="titlebar-controls">
        <UButton
          v-if="!isMobile"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-minus"
          :aria-label="$t('core.desktop.window.minimize')"
          @click="store.minimizeWindow(window.id)"
        />
        <UButton
          v-if="!isMobile"
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="window.isMaximized ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          :aria-label="$t('core.desktop.window.maximize')"
          @click="store.toggleMaximize(window.id)"
        />
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-x"
          :aria-label="$t('core.desktop.window.close')"
          @click="store.closeWindow(window.id)"
        />
      </div>
    </div>

    <!-- Window content -->
    <div class="window-content">
      <slot />
    </div>

    <!-- Resize handles (hidden when maximized or on mobile) -->
    <template v-if="!window.isMaximized && !isMobile">
      <div
        class="resize-handle rh-n"
        @mousedown.prevent="e => onResizeStart(e, 'n')"
      />
      <div
        class="resize-handle rh-s"
        @mousedown.prevent="e => onResizeStart(e, 's')"
      />
      <div
        class="resize-handle rh-w"
        @mousedown.prevent="e => onResizeStart(e, 'w')"
      />
      <div
        class="resize-handle rh-e"
        @mousedown.prevent="e => onResizeStart(e, 'e')"
      />
      <div
        class="resize-handle rh-nw"
        @mousedown.prevent="e => onResizeStart(e, 'nw')"
      />
      <div
        class="resize-handle rh-ne"
        @mousedown.prevent="e => onResizeStart(e, 'ne')"
      />
      <div
        class="resize-handle rh-sw"
        @mousedown.prevent="e => onResizeStart(e, 'sw')"
      />
      <div
        class="resize-handle rh-se"
        @mousedown.prevent="e => onResizeStart(e, 'se')"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.app-window {
  position: absolute;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  user-select: none;

  &.is-animated {
    transition: all 0.2s ease;
  }
}

.snap-preview {
  pointer-events: none;
  position: fixed;
  z-index: 9998;
  border-radius: 0.5rem;
  border: 2px solid var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
  transition: all 0.1s ease;
}

.titlebar {
  display: flex;
  height: 2.5rem;
  flex-shrink: 0;
  cursor: default;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  padding: 0 0.75rem;
}

.titlebar-icon {
  pointer-events: none;
  flex-shrink: 0;
  font-size: 1rem;
}

.titlebar-title {
  pointer-events: none;
  min-width: 0;
  flex: 1 1 0%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.titlebar-controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
}

.window-content {
  min-height: 0;
  flex: 1 1 0%;
  overflow: auto;
  container-type: inline-size;
}

.resize-handle {
  position: absolute;
}

.rh-n { left: 0; right: 0; top: 0; height: 0.25rem; cursor: n-resize; }
.rh-s { left: 0; right: 0; bottom: 0; height: 0.25rem; cursor: s-resize; }
.rh-w { top: 0; bottom: 0; left: 0; width: 0.25rem; cursor: w-resize; }
.rh-e { top: 0; bottom: 0; right: 0; width: 0.25rem; cursor: e-resize; }
.rh-nw { left: 0; top: 0; width: 0.75rem; height: 0.75rem; cursor: nw-resize; }
.rh-ne { right: 0; top: 0; width: 0.75rem; height: 0.75rem; cursor: ne-resize; }
.rh-sw { left: 0; bottom: 0; width: 0.75rem; height: 0.75rem; cursor: sw-resize; }
.rh-se { right: 0; bottom: 0; width: 0.75rem; height: 0.75rem; cursor: se-resize; }

.window-enter-active,
.window-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.window-enter-from,
.window-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.snap-preview-enter-active,
.snap-preview-leave-active {
  transition: opacity 0.1s ease;
}
.snap-preview-enter-from,
.snap-preview-leave-to {
  opacity: 0;
}
</style>
