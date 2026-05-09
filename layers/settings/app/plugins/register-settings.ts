export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'settings',
    name: 'Settings',
    nameKey: 'apps.settings.name',
    icon: 'i-lucide-settings',
    color: 'violet',
    component: 'AppsSettingsApp',
    defaultWidth: 560,
    defaultHeight: 480,
    category: 'system'
  })
})
