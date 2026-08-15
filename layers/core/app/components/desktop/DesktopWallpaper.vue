<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'

const store = useDesktopStore()
const isMobile = computed(() => window.innerWidth < 768)

/** 壁紙プリセット ID から CSS 背景値へのマッピング */
const WALLPAPER_PRESETS: Record<string, string> = {
  'gradient-default': 'linear-gradient(to bottom right, var(--ui-primary), #1a1a1a, #0a0a0a)',
  'gradient-sunset': 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)',
  'gradient-ocean': 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)',
  'gradient-midnight': 'linear-gradient(to bottom, #020617, #0f172a, #1e1b4b)',
  'gradient-forest': 'linear-gradient(135deg, #166534 0%, #065f46 50%, #0a0a0a 100%)',
  'solid-dark': '#0a0a0a',
  'solid-light': '#e5e7eb'
}

const isImageUrl = computed(() => {
  const w = store.wallpaper
  return (
    w.startsWith('http://')
    || w.startsWith('https://')
    || w.startsWith('/')
    || w.startsWith('data:')
    || w.startsWith('blob:')
  )
})

const wallpaperStyle = computed(() => {
  const w = store.wallpaper
  const fit = store.wallpaperFit || 'cover'
  const brightness = store.wallpaperBrightness ?? 100
  const blur = store.wallpaperBlur ?? 0

  const filterParts: string[] = []
  if (brightness !== 100) {
    filterParts.push(`brightness(${brightness}%)`)
  }
  if (blur > 0) {
    filterParts.push(`blur(${blur}px)`)
  }
  const filter = filterParts.length > 0 ? filterParts.join(' ') : 'none'

  if (isImageUrl.value) {
    let backgroundSize = 'cover'
    const backgroundRepeat = 'no-repeat'
    const backgroundPosition = 'center'

    if (fit === 'contain') {
      backgroundSize = 'contain'
    } else if (fit === 'center') {
      backgroundSize = 'auto'
    } else if (fit === 'fill') {
      backgroundSize = '100% 100%'
    }

    return {
      backgroundImage: `url("${w}")`,
      backgroundSize,
      backgroundRepeat,
      backgroundPosition,
      filter,
      transform: blur > 0 ? 'scale(1.06)' : 'none',
      transition: 'filter 0.2s ease, transform 0.2s ease'
    }
  }

  return {
    background: WALLPAPER_PRESETS[w] ?? WALLPAPER_PRESETS['gradient-default'] ?? '',
    filter,
    transition: 'filter 0.2s ease'
  }
})
const { openSpotlight } = useSpotlight()
const { addDesktop } = useVirtualDesktop()
const { t } = useI18n()

const contextMenuItems = computed(() => {
  const systemGroup = [
    ...(store.apps.some(a => a.id === 'task-manager')
      ? [{
          label: t('core.desktop.taskManager.open'),
          icon: 'i-lucide-activity',
          onSelect: () => {
            const app = store.apps.find(a => a.id === 'task-manager')
            if (app) store.openWindow(app)
          }
        }]
      : []),
    ...(store.apps.some(a => a.id === 'settings')
      ? [{
          label: t('core.desktop.settings.open'),
          icon: 'i-lucide-settings',
          onSelect: () => {
            const app = store.apps.find(a => a.id === 'settings')
            if (app) store.openWindow(app)
          }
        }]
      : [])
  ]

  return [
    [
      {
        label: store.theme === 'dark' ? t('core.desktop.window.theme.light') : t('core.desktop.window.theme.dark'),
        icon: store.theme === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
        onSelect: () => {
          const newTheme = store.theme === 'dark' ? 'light' : 'dark'
          store.setTheme(newTheme)
          useColorMode().preference = newTheme
        }
      }
    ],
    [
      ...(!isMobile.value
        ? [{
            label: t('core.desktop.virtualDesktop.add'),
            icon: 'i-lucide-plus',
            onSelect: () => addDesktop()
          }]
        : []),
      {
        label: t('core.desktop.spotlight.open'),
        icon: 'i-lucide-search',
        onSelect: () => openSpotlight()
      }
    ],
    ...(systemGroup.length > 0 ? [systemGroup] : [])
  ]
})
</script>

<template>
  <UContextMenu :items="contextMenuItems">
    <div class="wallpaper-container">
      <div
        class="wallpaper"
        :style="wallpaperStyle"
      />
    </div>
  </UContextMenu>
</template>

<style lang="scss" scoped>
.wallpaper-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: auto;
}

.wallpaper {
  position: absolute;
  inset: 0;
}
</style>
