export default defineNuxtConfig({
  // modules: ['@nuxtjs/i18n'],
  $meta: {
    description: 'TxunOS Built-in Applications Layer — settings, text editor, file manager, browser, terminal',
    name: 'txunos-apps',
    version: '0.1.0'
  },
  components: [
    {
      path: './components/apps',
      global: true,
      prefix: 'Apps'
    }
  ],

  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' }
    ]
  }
})
