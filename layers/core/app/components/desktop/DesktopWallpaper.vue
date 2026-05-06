<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'

const store = useDesktopStore()

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

const wallpaperCss = computed(() =>
  WALLPAPER_PRESETS[store.wallpaper] ?? WALLPAPER_PRESETS['gradient-default'] ?? ''
)
const { openSpotlight } = useSpotlight()
const { addDesktop } = useVirtualDesktop()
const { t } = useI18n()

const contextMenuItems = computed(() => [
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
    {
      label: t('core.desktop.virtualDesktop.add'),
      icon: 'i-lucide-plus',
      onSelect: () => addDesktop()
    },
    {
      label: t('core.desktop.spotlight.open'),
      icon: 'i-lucide-search',
      onSelect: () => openSpotlight()
    }
  ]
])
</script>

<template>
  <UContextMenu :items="contextMenuItems">
    <div class="wallpaper" :style="{ background: wallpaperCss }" />
  </UContextMenu>
</template>

<style lang="scss" scoped>
.wallpaper {
  position: absolute;
  inset: 0;
}
</style>
