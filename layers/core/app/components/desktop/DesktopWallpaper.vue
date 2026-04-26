<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'

const store = useDesktopStore()

const contextMenuItems = computed(() => [
  [
    {
      label: store.theme === 'dark' ? 'ライトモード' : 'ダークモード',
      icon: store.theme === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: () => {
        const newTheme = store.theme === 'dark' ? 'light' : 'dark'
        store.setTheme(newTheme)
        useColorMode().preference = newTheme
      }
    }
  ]
])
</script>

<template>
  <UContextMenu :items="contextMenuItems">
    <div class="wallpaper" />
  </UContextMenu>
</template>

<style lang="scss" scoped>
.wallpaper {
  position: absolute;
  inset: 0;
  z-index: -10;
  background: linear-gradient(to bottom right, var(--ui-primary), #1a1a1a, #0a0a0a);
}
</style>
