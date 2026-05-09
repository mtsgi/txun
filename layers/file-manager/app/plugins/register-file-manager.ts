export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'file-manager',
    name: 'Files',
    nameKey: 'apps.fileManager.name',
    icon: 'i-lucide-folder',
    color: 'amber',
    component: 'AppsFileManager',
    defaultWidth: 640,
    defaultHeight: 480,
    category: 'system'
  })
})
