export default defineNuxtConfig({
  $meta: {
    description: 'TxunOS Built-in App Layer - screen-time',
    name: 'txunos-screen-time',
    version: '1.0.0'
  },

  components: [
    {
      path: './components/apps',
      global: true,
      prefix: 'Apps'
    },
    {
      path: './components/screen-time',
      global: true,
      prefix: 'ScreenTime'
    }
  ],

  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' }
    ]
  }
})
