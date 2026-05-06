// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [
    'layers/core',
    'layers/apps'
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

  i18n: {

    defaultLocale: 'ja',
    detectBrowserLanguage: {
      useCookie: true
    },
    strategy: 'no_prefix'
  }
})
