export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'minesweeper',
    name: 'Minesweeper',
    nameKey: 'apps.minesweeper.name',
    icon: 'i-lucide-bomb',
    color: 'red',
    component: 'AppsMinesweeper',
    defaultWidth: 400,
    defaultHeight: 500,
    category: 'game'
  })
})
