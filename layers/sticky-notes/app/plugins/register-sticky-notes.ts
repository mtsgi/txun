export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'sticky-notes',
    name: 'Sticky Notes',
    nameKey: 'apps.stickyNotes.name',
    icon: 'i-lucide-sticky-note',
    color: 'yellow',
    component: 'AppsStickyNotes',
    defaultWidth: 700,
    defaultHeight: 500,
    category: 'productivity'
  })
})
