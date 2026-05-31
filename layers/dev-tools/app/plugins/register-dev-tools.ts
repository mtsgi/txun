export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'dev-tools',
    name: 'DevTools',
    nameKey: 'apps.devTools.name',
    icon: 'i-lucide-wrench',
    color: 'orange',
    component: 'AppsDevToolsApp',
    defaultWidth: 640,
    defaultHeight: 500,
    category: 'utility'
  })
})
