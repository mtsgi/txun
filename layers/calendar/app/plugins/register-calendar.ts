export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'calendar',
    name: 'Calendar',
    nameKey: 'apps.calendar.name',
    icon: 'i-lucide-calendar',
    color: 'indigo',
    component: 'AppsCalendarApp',
    defaultWidth: 700,
    defaultHeight: 550,
    category: 'productivity'
  })
})
