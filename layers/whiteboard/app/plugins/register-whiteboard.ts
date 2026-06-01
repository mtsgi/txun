export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'whiteboard',
    name: 'Whiteboard',
    nameKey: 'apps.whiteboard.name',
    icon: 'i-lucide-palette',
    color: 'sky',
    component: 'AppsWhiteboardApp',
    defaultWidth: 960,
    defaultHeight: 680,
    category: 'productivity'
  })
})
