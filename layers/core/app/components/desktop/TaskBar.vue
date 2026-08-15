<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import { useClipboardStore } from '../../stores/clipboard'
import type { WindowState, AppIconColor } from '../../stores/desktop'
import type { CSSProperties } from 'vue'

const store = useDesktopStore()
const clipboardStore = useClipboardStore()
const { t } = useI18n()
const { toggleLauncher, isOpen: launcherOpen } = useLauncher()
const { toggleSpotlight } = useSpotlight()
const { toggleOverview } = useVirtualDesktop()

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
const isClockFlyoutOpen = ref(false)

onMounted(() => {
  const timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
  onUnmounted(() => clearInterval(timer))
})

const timeLabel = computed(() => {
  const is12h = store.timeFormat === '12h'
  return now.value.toLocaleTimeString(store.locale === 'ja' ? 'ja-JP' : 'en-US', {
    hour12: is12h,
    hour: is12h ? 'numeric' : '2-digit',
    minute: '2-digit',
    ...(store.showSeconds ? { second: '2-digit' } : {})
  })
})
const dateLabel = computed(() =>
  now.value.toLocaleDateString(store.locale === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' })
)

/** アクティブな仮想デスクトップに最小化されていないウィンドウが存在するかどうか */
const hasVisibleWindows = computed(() =>
  store.windows.some(w => w.virtualDesktopId === store.activeVirtualDesktopId && !w.isMinimized)
)

/** タスクバー背景のコンテキストメニュー */
const taskbarContextMenuItems = computed(() => {
  const taskManagerApp = store.apps.find(a => a.id === 'task-manager')
  const settingsApp = store.apps.find(a => a.id === 'settings')

  const positionItems = [
    {
      label: t('core.desktop.contextMenu.positionBottom'),
      icon: store.taskbarPosition === 'bottom' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarPosition('bottom')
    },
    {
      label: t('core.desktop.contextMenu.positionTop'),
      icon: store.taskbarPosition === 'top' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarPosition('top')
    },
    {
      label: t('core.desktop.contextMenu.positionLeft'),
      icon: store.taskbarPosition === 'left' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarPosition('left')
    },
    {
      label: t('core.desktop.contextMenu.positionRight'),
      icon: store.taskbarPosition === 'right' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarPosition('right')
    }
  ]

  const sizeItems = [
    {
      label: t('core.desktop.contextMenu.sizeSm'),
      icon: store.taskbarSize === 'sm' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarSize('sm')
    },
    {
      label: t('core.desktop.contextMenu.sizeMd'),
      icon: store.taskbarSize === 'md' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarSize('md')
    },
    {
      label: t('core.desktop.contextMenu.sizeLg'),
      icon: store.taskbarSize === 'lg' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarSize('lg')
    }
  ]

  const alignItems = [
    {
      label: t('core.desktop.contextMenu.alignStart'),
      icon: store.taskbarTaskAlign === 'start' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarTaskAlign('start')
    },
    {
      label: t('core.desktop.contextMenu.alignCenter'),
      icon: store.taskbarTaskAlign === 'center' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarTaskAlign('center')
    },
    {
      label: t('core.desktop.contextMenu.alignEnd'),
      icon: store.taskbarTaskAlign === 'end' ? 'i-lucide-check' : undefined,
      onSelect: () => store.setTaskbarTaskAlign('end')
    }
  ]

  return [
    [
      {
        label: hasVisibleWindows.value
          ? t('core.desktop.contextMenu.showDesktop')
          : t('core.desktop.contextMenu.restoreAll'),
        icon: 'i-lucide-panel-bottom-dashed',
        onSelect: () => store.toggleShowDesktop()
      },
      {
        label: t('core.desktop.virtualDesktop.overview'),
        icon: 'i-lucide-layers',
        onSelect: () => toggleOverview()
      }
    ],
    ...(taskManagerApp
      ? [[
          {
            label: t('core.desktop.taskManager.open'),
            icon: 'i-lucide-activity',
            onSelect: () => store.openWindow(taskManagerApp)
          }
        ]]
      : []),
    [
      {
        label: t('core.desktop.contextMenu.taskbarSettings'),
        icon: 'i-lucide-sliders',
        children: [
          {
            label: t('core.desktop.contextMenu.taskbarPosition'),
            icon: 'i-lucide-move',
            children: positionItems
          },
          {
            label: t('core.desktop.contextMenu.taskbarSize'),
            icon: 'i-lucide-scaling',
            children: sizeItems
          },
          {
            label: t('core.desktop.contextMenu.taskbarAlignment'),
            icon: 'i-lucide-align-center',
            children: alignItems
          },
          ...(settingsApp
            ? [{
                label: t('core.desktop.settings.open'),
                icon: 'i-lucide-settings',
                onSelect: () => store.openWindow(settingsApp, { args: { tab: 'taskbar' } })
              }]
            : [])
        ]
      }
    ]
  ]
})

/** ランチャー（スタート）ボタンのコンテキストメニュー（Win+X風クイックリンク） */
const launcherContextMenuItems = computed(() => {
  const settingsApp = store.apps.find(a => a.id === 'settings')
  const taskManagerApp = store.apps.find(a => a.id === 'task-manager')
  const fileManagerApp = store.apps.find(a => a.id === 'file-manager')
  const terminalApp = store.apps.find(a => a.id === 'terminal')

  return [
    [
      ...(settingsApp
        ? [{
            label: t('core.desktop.settings.open'),
            icon: 'i-lucide-settings',
            onSelect: () => store.openWindow(settingsApp)
          }]
        : []),
      ...(taskManagerApp
        ? [{
            label: t('core.desktop.taskManager.open'),
            icon: 'i-lucide-activity',
            onSelect: () => store.openWindow(taskManagerApp)
          }]
        : []),
      ...(fileManagerApp
        ? [{
            label: fileManagerApp.nameKey ? t(fileManagerApp.nameKey) : fileManagerApp.name,
            icon: 'i-lucide-folder',
            onSelect: () => store.openWindow(fileManagerApp)
          }]
        : []),
      ...(terminalApp
        ? [{
            label: terminalApp.nameKey ? t(terminalApp.nameKey) : terminalApp.name,
            icon: 'i-lucide-terminal',
            onSelect: () => store.openWindow(terminalApp)
          }]
        : [])
    ],
    [
      {
        label: t('core.desktop.clipboard.title'),
        icon: 'i-lucide-clipboard-list',
        onSelect: () => clipboardStore.toggleQuickHistory()
      },
      {
        label: t('core.desktop.virtualDesktop.overview'),
        icon: 'i-lucide-layers',
        onSelect: () => toggleOverview()
      },
      {
        label: hasVisibleWindows.value
          ? t('core.desktop.contextMenu.showDesktop')
          : t('core.desktop.contextMenu.restoreAll'),
        icon: 'i-lucide-panel-bottom-dashed',
        onSelect: () => store.toggleShowDesktop()
      }
    ]
  ]
})

/** タスクボタン（各ウィンドウ）のコンテキストメニュー */
const taskContextMenuItems = computed(() => (win: WindowState) => {
  const app = store.apps.find(a => a.id === win.appId)

  const desktopItems = store.virtualDesktops.map(d => ({
    label: d.name,
    icon: d.id === win.virtualDesktopId ? 'i-lucide-check' : 'i-lucide-monitor',
    disabled: d.id === win.virtualDesktopId,
    onSelect: () => store.moveWindowToDesktop(win.id, d.id)
  }))

  desktopItems.push({
    label: t('core.desktop.contextMenu.moveToNewDesktop'),
    icon: 'i-lucide-plus',
    disabled: false,
    onSelect: () => {
      const newId = `desktop-${Date.now()}`
      store.virtualDesktops.push({ id: newId, name: `Desktop ${store.virtualDesktops.length + 1}` })
      store.moveWindowToDesktop(win.id, newId)
    }
  })

  return [
    [
      {
        label: win.isMinimized
          ? t('core.desktop.contextMenu.restore')
          : t('core.desktop.contextMenu.bringToFront'),
        icon: win.isMinimized ? 'i-lucide-copy' : 'i-lucide-arrow-up-to-line',
        onSelect: () => {
          if (win.isMinimized) {
            store.restoreWindow(win.id)
          } else {
            store.focusWindow(win.id)
          }
        }
      },
      {
        label: t('core.desktop.contextMenu.minimize'),
        icon: 'i-lucide-minus',
        disabled: win.isMinimized,
        onSelect: () => store.minimizeWindow(win.id)
      },
      {
        label: win.isMaximized
          ? t('core.desktop.contextMenu.restore')
          : t('core.desktop.contextMenu.maximize'),
        icon: win.isMaximized ? 'i-lucide-minimize-2' : 'i-lucide-square',
        onSelect: () => {
          store.toggleMaximize(win.id)
        }
      }
    ],
    [
      ...(app
        ? [{
            label: t('core.desktop.contextMenu.openNewWindow'),
            icon: 'i-lucide-plus',
            onSelect: () => store.openWindow(app)
          }]
        : []),
      {
        label: t('core.desktop.contextMenu.moveToDesktop'),
        icon: 'i-lucide-arrow-right-left',
        children: desktopItems
      }
    ],
    [
      {
        label: t('core.desktop.contextMenu.close'),
        icon: 'i-lucide-x',
        color: 'error' as const,
        onSelect: () => store.closeWindow(win.id)
      }
    ]
  ]
})

/** 時計ウィジェットのコンテキストメニュー */
const clockContextMenuItems = computed(() => {
  const calendarApp = store.apps.find(a => a.id === 'calendar')
  const settingsApp = store.apps.find(a => a.id === 'settings')

  return [
    ...(calendarApp
      ? [[
          {
            label: t('core.desktop.clock.openCalendar'),
            icon: 'i-lucide-calendar',
            onSelect: () => store.openWindow(calendarApp)
          }
        ]]
      : []),
    [
      {
        label: store.timeFormat === '12h'
          ? t('core.desktop.contextMenu.toggle24h')
          : t('core.desktop.contextMenu.toggle12h'),
        icon: 'i-lucide-clock',
        onSelect: () => store.setTimeFormat(store.timeFormat === '12h' ? '24h' : '12h')
      },
      {
        label: t('core.desktop.contextMenu.toggleSeconds'),
        icon: store.showSeconds ? 'i-lucide-check' : 'i-lucide-timer',
        onSelect: () => store.setShowSeconds(!store.showSeconds)
      }
    ],
    ...(settingsApp
      ? [[
          {
            label: t('core.desktop.contextMenu.timeSettings'),
            icon: 'i-lucide-settings',
            onSelect: () => store.openWindow(settingsApp, { args: { tab: 'language' } })
          }
        ]]
      : [])
  ]
})
</script>

<template>
  <UContextMenu :items="taskbarContextMenuItems">
    <div
      class="taskbar"
      :style="taskbarStyle"
    >
      <!-- App launcher with Quick Links Context Menu -->
      <UContextMenu :items="launcherContextMenuItems">
        <UButton
          icon="i-lucide-layout-grid"
          :variant="launcherOpen ? 'soft' : 'ghost'"
          :color="launcherOpen ? 'primary' : 'neutral'"
          :size="btnSize"
          :aria-label="$t('core.desktop.taskbar.launcher')"
          :aria-expanded="launcherOpen"
          @click="toggleLauncher"
        />
      </UContextMenu>

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

      <!-- Virtual Desktop switcher widget -->
      <DesktopTaskbarDesktopSwitcher
        :btn-size="btnSize"
        :is-vertical="isVertical"
        :is-mobile="isMobile"
      />

      <USeparator
        :orientation="isVertical ? 'horizontal' : 'vertical'"
        class="sep"
      />

      <!-- Open windows -->
      <div
        class="task-list"
        :style="taskListStyle"
      >
        <UContextMenu
          v-for="win in store.activeWindows"
          :key="win.id"
          :items="taskContextMenuItems(win)"
        >
          <UTooltip :text="win.title">
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
        </UContextMenu>
      </div>

      <!-- Clipboard History trigger -->
      <UTooltip :text="$t('core.desktop.clipboard.title')">
        <UButton
          icon="i-lucide-clipboard-list"
          :variant="clipboardStore.isQuickHistoryOpen ? 'soft' : 'ghost'"
          :color="clipboardStore.isQuickHistoryOpen ? 'primary' : 'neutral'"
          :size="btnSize"
          :aria-label="$t('core.desktop.clipboard.title')"
          @click="clipboardStore.toggleQuickHistory"
        />
      </UTooltip>

      <!-- Clock Widget with Flyout Popover and Context Menu -->
      <UPopover
        v-model:open="isClockFlyoutOpen"
        :content="{
          side: isVertical ? (store.taskbarPosition === 'left' ? 'right' : 'left') : (store.taskbarPosition === 'top' ? 'bottom' : 'top'),
          align: 'end',
          sideOffset: 8
        }"
        :style="clockStyle"
      >
        <UContextMenu :items="clockContextMenuItems">
          <button
            type="button"
            class="clock-btn"
            :class="{ 'is-open': isClockFlyoutOpen }"
            :aria-label="$t('core.desktop.clock.title')"
            :aria-expanded="isClockFlyoutOpen"
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
          </button>
        </UContextMenu>

        <template #content>
          <DesktopTaskbarClockFlyout @close="isClockFlyoutOpen = false" />
        </template>
      </UPopover>
    </div>
  </UContextMenu>
</template>

<style lang="scss" scoped>
.taskbar {
  position: absolute;
  z-index: 10000;
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
    padding: 0 !important;
    justify-content: center !important;
    align-items: center !important;
    text-align: center;
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

.clock-btn {
  border: none;
  background: transparent;
  padding: 2px 6px;
  border-radius: var(--ui-radius, 6px);
  cursor: pointer;
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.25;
  transition: all 0.15s ease;

  &:hover {
    background: var(--ui-bg-elevated);
  }

  &.is-open {
    background: color-mix(in srgb, var(--ui-primary) 18%, transparent);
    color: var(--ui-primary);
  }

  .clock-time {
    font-size: 0.8125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .clock-date {
    font-size: 0.6875rem;
    color: var(--ui-text-muted);
  }
}
</style>
