<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import type { WindowState } from '../../stores/desktop'

const store = useDesktopStore()

defineProps<{ screenWidth: number, isMobile: boolean }>()

const TASKBAR_HEIGHT = 48

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

const launcherItems = computed(() =>
  store.apps.map(app => ({
    label: app.name,
    icon: app.icon,
    onSelect: () => store.openWindow(app)
  }))
)

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
    :style="{ height: `${TASKBAR_HEIGHT}px` }"
  >
    <!-- App launcher -->
    <UDropdownMenu
      :items="[launcherItems]"
      :popper="{ placement: 'top-start' }"
    >
      <UButton
        icon="i-lucide-layout-grid"
        variant="ghost"
        color="neutral"
        size="sm"
        :aria-label="$t('desktop.taskbar.launcher')"
      />
    </UDropdownMenu>

    <USeparator
      orientation="vertical"
      class="sep"
    />

    <!-- Open windows -->
    <div class="task-list">
      <UButton
        v-for="win in store.activeWindows"
        :key="win.id"
        size="sm"
        :variant="win.isMinimized ? 'ghost' : 'soft'"
        :color="store.topWindow?.id === win.id ? 'primary' : 'neutral'"
        :class="['task-btn', { 'task-btn-icon': isMobile }]"
        @click="onTaskClick(win)"
      >
        <UIcon
          :name="win.icon"
          class="task-icon"
        />
        <span
          v-if="!isMobile"
          class="task-label"
        >{{ win.title }}</span>
      </UButton>
    </div>

    <!-- Clock -->
    <div class="clock">
      <div class="clock-time">
        {{ timeLabel }}
      </div>
      <div
        v-if="!isMobile"
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
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border-top: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg-elevated) 90%, transparent);
  padding: 0 0.5rem;
  backdrop-filter: blur(12px);
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
}

.task-btn {
  max-width: 9rem;
  flex-shrink: 0;

  &.task-btn-icon {
    max-width: 2.5rem;
    min-width: 2.5rem;
    padding-inline: 0;
    justify-content: center;
  }
}

.task-icon {
  flex-shrink: 0;
  font-size: 0.875rem;
}

.task-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

.clock {
  margin-left: auto;
  flex-shrink: 0;
  text-align: right;
  line-height: 1.25;

  .clock-time {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .clock-date {
    font-size: 0.75rem;
    color: var(--ui-text-muted);
  }
}
</style>
