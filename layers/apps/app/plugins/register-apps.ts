export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  const builtinApps = [
    {
      id: 'settings',
      name: 'Settings',
      nameKey: 'apps.settings.name',
      icon: 'i-lucide-settings',
      component: 'AppsSettingsApp',
      defaultWidth: 560,
      defaultHeight: 480,
      category: 'system'
    },
    {
      id: 'text-editor',
      name: 'Text Editor',
      nameKey: 'apps.textEditor.name',
      icon: 'i-lucide-file-text',
      component: 'AppsTextEditor',
      defaultWidth: 700,
      defaultHeight: 520,
      category: 'productivity'
    },
    {
      id: 'file-manager',
      name: 'Files',
      nameKey: 'apps.fileManager.name',
      icon: 'i-lucide-folder',
      component: 'AppsFileManager',
      defaultWidth: 640,
      defaultHeight: 480,
      category: 'system'
    },
    {
      id: 'browser',
      name: 'Browser',
      nameKey: 'apps.browser.name',
      icon: 'i-lucide-globe',
      component: 'AppsBrowserApp',
      defaultWidth: 900,
      defaultHeight: 600,
      category: 'internet'
    },
    {
      id: 'terminal',
      name: 'Terminal',
      nameKey: 'apps.terminal.name',
      icon: 'i-lucide-terminal',
      component: 'AppsTerminalApp',
      defaultWidth: 700,
      defaultHeight: 440,
      category: 'system'
    }
  ] as const

  for (const app of builtinApps) {
    store.registerApp(app)
  }
})
