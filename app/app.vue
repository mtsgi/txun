<script setup lang="ts">
const { locale } = useI18n()
const store = useDesktopStore()
const colorMode = useColorMode()
const appConfig = useAppConfig()

const FONT_FAMILIES: Record<string, string> = {
  system: 'system-ui, -apple-system, sans-serif',
  sans: '\'Public Sans\', sans-serif',
  mono: 'ui-monospace, monospace',
  serif: 'ui-serif, Georgia, serif'
}

function applyFont(font: string) {
  document.documentElement.style.setProperty('--app-font', FONT_FAMILIES[font] ?? FONT_FAMILIES['system']!)
}

function applyPrimaryColor(color: string) {
  (appConfig.ui as Record<string, unknown>).colors = { ...(appConfig.ui as unknown as Record<string, Record<string, string>>).colors, primary: color }
}

// Sync store → runtime on initial load
onMounted(() => {
  colorMode.preference = store.theme
  locale.value = store.locale
  applyFont(store.font)
  applyPrimaryColor(store.primaryColor)
})

watch(() => store.font, applyFont)
watch(() => store.primaryColor, applyPrimaryColor)

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: locale }
})

useSeoMeta({
  title: 'TxunOS',
  description: 'A web desktop environment built with Nuxt UI'
})
</script>

<template>
  <UApp :class="colorMode.value === 'dark' ? 'dark' : ''">
    <NuxtPage />
  </UApp>
</template>
