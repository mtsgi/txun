export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'clock',
    name: 'Clock',
    nameKey: 'apps.clock.name',
    icon: 'i-lucide-clock',
    color: 'teal',
    component: 'AppsClockApp',
    defaultWidth: 380,
    defaultHeight: 440,
    category: 'utility'
  })
})
