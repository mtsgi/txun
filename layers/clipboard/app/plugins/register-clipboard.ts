export default defineNuxtPlugin(() => {
  const store = useDesktopStore()
  store.registerApp({
    id: 'clipboard',
    name: 'Clipboard',
    nameKey: 'apps.clipboard.name',
    icon: 'i-lucide-clipboard-list',
    color: 'purple',
    component: 'AppsClipboardApp',
    defaultWidth: 780,
    defaultHeight: 540,
    category: 'utilities'
  })
})
