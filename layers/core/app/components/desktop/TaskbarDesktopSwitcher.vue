<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'

defineProps<{
  btnSize?: 'xs' | 'sm' | 'md'
  isVertical?: boolean
  isMobile?: boolean
}>()

const store = useDesktopStore()
const {
  desktops,
  activeId,
  currentIndex,
  totalDesktops,
  canGoPrev,
  canGoNext,
  prevDesktop,
  nextDesktop,
  switchDesktop,
  addDesktop,
  toggleOverview,
  isOverviewOpen
} = useVirtualDesktop()

/** 壁紙プリセット CSS マップ */
const WALLPAPER_PRESETS: Record<string, string> = {
  'gradient-default': 'linear-gradient(to bottom right, var(--ui-primary), #1a1a1a, #0a0a0a)',
  'gradient-sunset': 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)',
  'gradient-ocean': 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)',
  'gradient-midnight': 'linear-gradient(to bottom, #020617, #0f172a, #1e1b4b)',
  'gradient-forest': 'linear-gradient(135deg, #166534 0%, #065f46 50%, #0a0a0a 100%)',
  'solid-dark': '#0a0a0a',
  'solid-light': '#e5e7eb'
}

const wallpaperStyle = computed(() => {
  const w = store.wallpaper
  if (w.startsWith('http://') || w.startsWith('https://') || w.startsWith('/')) {
    return { backgroundImage: `url("${w}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: WALLPAPER_PRESETS[w] ?? WALLPAPER_PRESETS['gradient-default'] ?? '#1e1b4b' }
})

/** 各デスクトップの開いているウィンドウ数を取得 */
function getDesktopWindowCount(desktopId: string): number {
  return store.windows.filter(w => w.virtualDesktopId === desktopId).length
}

const isPopoverOpen = ref(false)
</script>

<template>
  <div
    class="desktop-switcher"
    :class="{ 'is-vertical': isVertical }"
  >
    <!-- Prev Desktop Button -->
    <UTooltip
      v-if="!isMobile && totalDesktops > 1"
      :text="$t('core.desktop.virtualDesktop.prev')"
    >
      <UButton
        :icon="isVertical ? 'i-lucide-chevron-up' : 'i-lucide-chevron-left'"
        variant="ghost"
        color="neutral"
        :size="btnSize ?? 'sm'"
        :disabled="!canGoPrev"
        class="nav-btn"
        :aria-label="$t('core.desktop.virtualDesktop.prev')"
        @click="prevDesktop"
      />
    </UTooltip>

    <!-- Main Desktop Indicator / Overview Toggle Button with Popover -->
    <UPopover
      v-model:open="isPopoverOpen"
      mode="hover"
      :open-delay="150"
      :close-delay="150"
      :content="{ side: isVertical ? (store.taskbarPosition === 'left' ? 'right' : 'left') : (store.taskbarPosition === 'top' ? 'bottom' : 'top'), align: 'center', sideOffset: 8 }"
    >
      <UButton
        :variant="isOverviewOpen ? 'solid' : 'ghost'"
        :color="isOverviewOpen ? 'primary' : 'neutral'"
        :size="btnSize ?? 'sm'"
        class="switcher-main-btn"
        :class="{ 'is-active': isOverviewOpen }"
        :aria-label="$t('core.desktop.virtualDesktop.overview')"
        @click="toggleOverview(); isPopoverOpen = false"
      >
        <UIcon
          name="i-lucide-panels-top-left"
          class="switcher-icon"
        />
        <span
          v-if="!isMobile && !isVertical"
          class="switcher-label"
        >
          {{ currentIndex + 1 }}
        </span>
      </UButton>

      <!-- Hover / Click Popover: Desktops Quick Switcher Panel -->
      <template #content>
        <div class="popover-panel">
          <div class="popover-header">
            <span class="popover-title">{{ $t('core.desktop.virtualDesktop.title') }}</span>
            <UButton
              icon="i-lucide-plus"
              size="xs"
              variant="ghost"
              color="neutral"
              :aria-label="$t('core.desktop.virtualDesktop.add')"
              @click="addDesktop"
            />
          </div>

          <div class="popover-desktops-grid">
            <button
              v-for="(desktop, idx) in desktops"
              :key="desktop.id"
              class="popover-desktop-card"
              :class="{ 'is-current': desktop.id === activeId }"
              @click="switchDesktop(desktop.id); isPopoverOpen = false"
            >
              <!-- Thumbnail -->
              <div
                class="popover-thumbnail"
                :style="wallpaperStyle"
              >
                <span class="popover-thumb-num">{{ idx + 1 }}</span>
                <UBadge
                  v-if="getDesktopWindowCount(desktop.id) > 0"
                  size="xs"
                  color="neutral"
                  variant="solid"
                  class="popover-win-count"
                >
                  {{ getDesktopWindowCount(desktop.id) }}
                </UBadge>
              </div>
              <span class="popover-desktop-name">{{ desktop.name }}</span>
            </button>
          </div>

          <div class="popover-footer">
            <UButton
              icon="i-lucide-panels-top-left"
              size="xs"
              variant="soft"
              color="primary"
              block
              @click="toggleOverview(); isPopoverOpen = false"
            >
              {{ $t('core.desktop.virtualDesktop.overview') }}
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>

    <!-- Next Desktop Button -->
    <UTooltip
      v-if="!isMobile && totalDesktops > 1"
      :text="$t('core.desktop.virtualDesktop.next')"
    >
      <UButton
        :icon="isVertical ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        variant="ghost"
        color="neutral"
        :size="btnSize ?? 'sm'"
        :disabled="!canGoNext"
        class="nav-btn"
        :aria-label="$t('core.desktop.virtualDesktop.next')"
        @click="nextDesktop"
      />
    </UTooltip>
  </div>
</template>

<style lang="scss" scoped>
.desktop-switcher {
  display: flex;
  align-items: center;
  gap: 0.125rem;

  &.is-vertical {
    flex-direction: column;
    width: 100%;
  }
}

.nav-btn {
  padding: 0;
  width: 1.25rem;
  height: 1.25rem;
  opacity: 0.7;

  &:hover:not(:disabled) {
    opacity: 1;
  }
}

.switcher-main-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center !important;
  gap: 0.25rem;
  padding-inline: 0.375rem;

  .switcher-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .switcher-label {
    font-size: 0.75rem;
    font-weight: 700;
  }
}

/* Popover Panel */
.popover-panel {
  padding: 0.625rem;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--ui-border);

  .popover-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--ui-text);
  }
}

.popover-desktops-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.popover-desktop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: inherit;
  transition: all 0.15s;

  &:hover {
    background: var(--ui-bg-elevated);
    border-color: var(--ui-border);
  }

  &.is-current {
    background: color-mix(in srgb, var(--ui-primary) 15%, transparent);
    border-color: var(--ui-primary);

    .popover-thumbnail {
      border-color: var(--ui-primary);
      box-shadow: 0 0 0 1px var(--ui-primary);
    }

    .popover-desktop-name {
      color: var(--ui-primary);
      font-weight: 700;
    }
  }
}

.popover-thumbnail {
  position: relative;
  width: 100%;
  height: 52px;
  border-radius: 4px;
  border: 1px solid var(--ui-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  .popover-thumb-num {
    font-size: 0.875rem;
    font-weight: 700;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    color: #fff;
  }

  .popover-win-count {
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0 3px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
  }
}

.popover-desktop-name {
  font-size: 0.6875rem;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-footer {
  padding-top: 0.25rem;
  border-top: 1px solid var(--ui-border);
}
</style>
