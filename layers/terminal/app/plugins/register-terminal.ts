export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'terminal',
    name: 'Terminal',
    nameKey: 'apps.terminal.name',
    icon: 'i-lucide-terminal',
    color: 'green',
    component: 'AppsTerminalApp',
    defaultWidth: 700,
    defaultHeight: 440,
    category: 'system'
  })
})
