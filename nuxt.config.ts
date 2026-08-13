const appBaseURL = process.env.NUXT_APP_BASE_URL || '/'
const withBase = (path: string) => `${appBaseURL.endsWith('/') ? appBaseURL : `${appBaseURL}/`}${path.replace(/^\//, '')}`

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
    'layers/minesweeper',
    'layers/sticky-notes',
    'layers/camera',
    'layers/music-player',
    'layers/video-player',
    'layers/whiteboard',
    'layers/screen-time',
    'layers/git-viewer'
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
    baseURL: appBaseURL,
    head: {
      title: 'TxunOS',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#18181b' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'TxunOS' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: withBase('favicon.png') },
        { rel: 'apple-touch-icon', href: withBase('icon.png') },
        { rel: 'manifest', href: withBase('manifest.webmanifest'), crossorigin: 'use-credentials' }
      ]
    }
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
