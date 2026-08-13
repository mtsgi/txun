<script setup lang="ts">
const { locale } = useI18n()
const store = useDesktopStore()
const colorMode = useColorMode()
const appConfig = useAppConfig()

const FONT_FAMILIES: Record<string, string> = {
  'system': 'system-ui, -apple-system, sans-serif',
  'sans': '\'Public Sans\', sans-serif',
  'mono': 'ui-monospace, monospace',
  'serif': 'ui-serif, Georgia, serif',
  'inter': '\'Inter\', sans-serif',
  'poppins': '\'Poppins\', sans-serif',
  'noto-sans-jp': '\'Noto Sans JP\', system-ui, sans-serif',
  'biz-ud-gothic': '\'BIZ UDPGothic\', sans-serif',
  'zen-kaku-gothic-antique': '\'Zen Kaku Gothic Antique\', sans-serif'
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

const { app: runtimeApp } = useRuntimeConfig()
const base = runtimeApp.baseURL || '/'
const withAppBase = (path: string) => `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\//, '')}`

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#18181b' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'TxunOS' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: withAppBase('favicon.png') },
    { rel: 'apple-touch-icon', href: withAppBase('icon.png') },
    { rel: 'manifest', href: withAppBase('manifest.webmanifest'), crossorigin: 'use-credentials' }
  ],
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
