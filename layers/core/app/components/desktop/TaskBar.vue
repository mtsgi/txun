<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import type { WindowState, AppIconColor } from '../../stores/desktop'
import type { CSSProperties } from 'vue'

const store = useDesktopStore()
const { toggleLauncher, isOpen: launcherOpen } = useLauncher()
const { toggleSpotlight } = useSpotlight()

defineProps<{ screenWidth: number, isMobile: boolean }>()

/** タスクバーサイズ設定値 → px 変換マップ */
const TASKBAR_SIZE_PX = { sm: 36, md: 48, lg: 64 } as const

/** タスクバーのサイズ（px） */
const sizePx = computed(() => TASKBAR_SIZE_PX[store.taskbarSize] ?? 48)

/** タスクバーが縦方向（左/右）かどうか */
const isVertical = computed(() =>
  store.taskbarPosition === 'left' || store.taskbarPosition === 'right'
)

/** タスクバーのインラインスタイル */
const taskbarStyle = computed<CSSProperties>(() => {
  const size = `${sizePx.value}px`
  const borderColor = 'var(--ui-border)'
  const base: CSSProperties = { position: 'absolute', display: 'flex', alignItems: 'center', gap: '0.25rem' }
  const iconSize = store.taskbarSize === 'sm' ? '1.75rem' : store.taskbarSize === 'lg' ? '3rem' : '2.5rem'
  const vars: CSSProperties = { '--taskbar-btn-icon-size': iconSize }
  switch (store.taskbarPosition) {
    case 'top':
      return { ...vars, ...base, top: '0', left: '0', right: '0', height: size, flexDirection: 'row', borderTop: 'none', borderBottom: `1px solid ${borderColor}` }
    case 'left':
      return { ...vars, ...base, left: '0', top: '0', bottom: '0', width: size, flexDirection: 'column', justifyContent: 'flex-start', padding: '0.5rem 0', borderRight: `1px solid ${borderColor}`, borderTop: 'none' }
    case 'right':
      return { ...vars, ...base, right: '0', top: '0', bottom: '0', width: size, flexDirection: 'column', justifyContent: 'flex-start', padding: '0.5rem 0', borderLeft: `1px solid ${borderColor}`, borderTop: 'none' }
    default:
      return { ...vars, ...base, bottom: '0', left: '0', right: '0', height: size, flexDirection: 'row', borderTop: `1px solid ${borderColor}` }
  }
})

/** タスクバーサイズ → UButton size マッピング */
const btnSize = computed(() => {
  switch (store.taskbarSize) {
    case 'sm': return 'xs' as const
    case 'lg': return 'md' as const
    default: return 'sm' as const
  }
})

/** task-list の justify-content（並び位置設定から）/ 縦向き時はカラム方向に変更 */
const taskListStyle = computed<CSSProperties>(() => {
  if (isVertical.value) {
    return {
      flexDirection: 'column',
      justifyContent: 'flex-start',
      overflowY: 'auto',
      overflowX: 'hidden'
    }
  }
  return { justifyContent: store.taskbarTaskAlign === 'start' ? 'flex-start' : store.taskbarTaskAlign === 'end' ? 'flex-end' : 'center' }
})

/** 時計マージン：縦向き時は上方向 auto、横向き時は左 auto */
const clockStyle = computed<CSSProperties>(() =>
  isVertical.value ? { marginBlockStart: 'auto' } : { marginLeft: 'auto' }
)

/** タスクボタン内アイコンのフォントサイズ（タスクバーサイズに連動） */
const taskIconSize = computed(() => {
  switch (store.taskbarSize) {
    case 'sm': return '16' as const
    case 'lg': return '24' as const
    default: return '20' as const
  }
})

/** Click a task button: restore if minimized, else minimize */
function onTaskClick(win: WindowState) {
  if (win.isMinimized) {
    store.restoreWindow(win.id)
  } else if (store.topWindow?.id === win.id) {
    store.minimizeWindow(win.id)
  } else {
    store.focusWindow(win.id)
  }
}

/** UButton が受け入れる color 型 */
type UButtonColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

/** アプリの AppIconColor を UButton の color 型にマッピングする */
const COLOR_MAP: Partial<Record<AppIconColor, UButtonColor>> = {
  violet: 'primary', purple: 'primary', fuchsia: 'primary',
  blue: 'info', sky: 'info', indigo: 'info', cyan: 'info',
  green: 'success', emerald: 'success', teal: 'success', lime: 'success',
  amber: 'warning', yellow: 'warning', orange: 'warning',
  red: 'error', rose: 'error', pink: 'error'
}

/** ウィンドウに対応するアプリの UButton 互換 color を返す */
function getWindowAppColor(win: WindowState): UButtonColor {
  const color = store.apps.find(a => a.id === win.appId)?.color
  return (color != null ? (COLOR_MAP[color] ?? 'primary') : 'primary')
}

const now = ref(new Date())
onMounted(() => {
  const timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
  onUnmounted(() => clearInterval(timer))
})

const timeLabel = computed(() =>
  now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
)
const dateLabel = computed(() =>
  now.value.toLocaleDateString([], { month: 'short', day: 'numeric' })
)
</script>

<template>
  <div
    class="taskbar"
    :style="taskbarStyle"
  >
    <!-- App launcher -->
    <UButton
      icon="i-lucide-layout-grid"
      :variant="launcherOpen ? 'soft' : 'ghost'"
      :color="launcherOpen ? 'primary' : 'neutral'"
      :size="btnSize"
      :aria-label="$t('core.desktop.taskbar.launcher')"
      :aria-expanded="launcherOpen"
      @click="toggleLauncher"
    />

    <USeparator
      :orientation="isVertical ? 'horizontal' : 'vertical'"
      class="sep"
    />

    <!-- Spotlight search button -->
    <UTooltip :text="$t('core.desktop.spotlight.open')">
      <UButton
        icon="i-lucide-search"
        variant="ghost"
        color="neutral"
        :size="btnSize"
        :aria-label="$t('core.desktop.spotlight.open')"
        @click="toggleSpotlight"
      />
    </UTooltip>

    <USeparator
      :orientation="isVertical ? 'horizontal' : 'vertical'"
      class="sep"
    />

    <!-- Open windows -->
    <div
      class="task-list"
      :style="taskListStyle"
    >
      <UTooltip
        v-for="win in store.activeWindows"
        :key="win.id"
        :text="win.title"
      >
        <UButton
          :size="btnSize"
          :variant="win.isMinimized ? 'ghost' : 'soft'"
          :color="store.topWindow?.id === win.id ? getWindowAppColor(win) : 'neutral'"
          :class="['task-btn', {
            'task-btn-icon': !isVertical && (isMobile || store.taskbarTaskDisplay === 'icon'),
            'task-btn-vertical': isVertical
          }]"
          @click="onTaskClick(win)"
        >
          <UIcon
            :name="win.icon"
            class="task-icon"
            :size="taskIconSize"
          />
          <span
            v-if="!isMobile && store.taskbarTaskDisplay !== 'icon'"
            :class="['task-label', { 'task-label-vertical': isVertical }]"
          >{{ win.title }}</span>
        </UButton>
      </UTooltip>
    </div>

    <!-- Clock -->
    <div
      class="clock"
      :style="clockStyle"
    >
      <div class="clock-time">
        {{ timeLabel }}
      </div>
      <div
        v-if="!isMobile && !isVertical"
        class="clock-date"
      >
        {{ dateLabel }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.taskbar {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: color-mix(in srgb, var(--ui-bg-elevated) var(--desktop-bg-opacity), transparent);
  padding: 0 0.5rem;
  backdrop-filter: blur(var(--desktop-blur));
}

.sep {
  margin-inline: 0.25rem;
}

.task-list {
  display: flex;
  min-width: 0;
  flex: 1 1 0%;
  align-items: center;
  gap: 0.25rem;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
}

.task-btn {
  max-width: 9rem;
  flex-shrink: 0;

  &.task-btn-icon {
    max-width: var(--taskbar-btn-icon-size, 2.5rem);
    min-width: var(--taskbar-btn-icon-size, 2.5rem);
    padding-inline: 0;
    justify-content: center;
  }

  &.task-btn-vertical {
    width: 100%;
    flex-direction: column;
    justify-content: center;
  }
}

.task-icon {
  flex-shrink: 0;
}

.task-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;

  &.task-label-vertical {
    writing-mode: vertical-lr;
    max-height: 5rem;
    white-space: normal;
    overflow: hidden;
    text-overflow: clip;
  }
}

.clock {
  flex-shrink: 0;
  text-align: center;
  line-height: 1.25;

  .clock-time {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .clock-date {
    font-size: 0.6875rem;
    color: var(--ui-text-muted);
  }
}
</style>
