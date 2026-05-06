export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  $meta: {
    description: 'TxunOS Core Layer — desktop shell, window manager, virtual desktop',
    name: 'txunos-core',
    version: '0.1.0'
  },

  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' }
    ],
    defaultLocale: 'ja',
    langDir: 'locales',
    strategy: 'no_prefix'
  }
})
