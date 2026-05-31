// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [
    'layers/core',
    'layers/settings',
    'layers/text-editor',
    'layers/file-manager',
    'layers/browser',
    'layers/terminal',
    'layers/task-manager',
    'layers/calculator',
    'layers/calendar',
    'layers/clock',
    'layers/dev-tools',
    'layers/image-viewer',
    'layers/sticky-notes',
    'layers/camera',
    'layers/music-player',
    'layers/video-player'
  ],

  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxt/test-utils',
    '@nuxt/eslint',
    '@pinia/nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  vite: {
    optimizeDeps: {
      include: [
        '@nuxt/ui > prosemirror-state',
        '@nuxt/ui > prosemirror-transform',
        '@nuxt/ui > prosemirror-model',
        '@nuxt/ui > prosemirror-view',
        '@nuxt/ui > prosemirror-gapcursor'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
      { name: 'Poppins', provider: 'google' },
      { name: 'Noto Sans JP', provider: 'google' },
      { name: 'BIZ UDPGothic', provider: 'google' },
      { name: 'Zen Kaku Gothic Antique', provider: 'google' }
    ]
  },

  i18n: {

    defaultLocale: 'ja',
    detectBrowserLanguage: {
      useCookie: true
    },
    strategy: 'no_prefix'
  }
})
