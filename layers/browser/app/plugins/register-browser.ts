export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'browser',
    name: 'Browser',
    nameKey: 'apps.browser.name',
    icon: 'i-lucide-globe',
    color: 'sky',
    component: 'AppsBrowserApp',
    defaultWidth: 900,
    defaultHeight: 600,
    category: 'internet'
  })
})
