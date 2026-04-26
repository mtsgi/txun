export default defineNuxtConfig({
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
  ]
})
