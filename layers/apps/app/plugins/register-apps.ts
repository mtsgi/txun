export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  const builtinApps = [
    {
      id: 'settings',
      name: 'Settings',
      nameKey: 'apps.settings.name',
      icon: 'i-lucide-settings',
      color: 'violet',
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
      color: 'blue',
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
      color: 'amber',
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
      color: 'sky',
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
      color: 'green',
      component: 'AppsTerminalApp',
      defaultWidth: 700,
      defaultHeight: 440,
      category: 'system'
    },
    {
      id: 'task-manager',
      name: 'Task Manager',
      nameKey: 'apps.taskManager.name',
      icon: 'i-lucide-activity',
      color: 'emerald',
      component: 'AppsTaskManager',
      defaultWidth: 640,
      defaultHeight: 480,
      category: 'system'
    },
    {
      id: 'calculator',
      name: 'Calculator',
      nameKey: 'apps.calculator.name',
      icon: 'i-lucide-calculator',
      color: 'rose',
      component: 'AppsCalculatorApp',
      defaultWidth: 320,
      defaultHeight: 480,
      category: 'utility'
    },
    {
      id: 'calendar',
      name: 'Calendar',
      nameKey: 'apps.calendar.name',
      icon: 'i-lucide-calendar',
      color: 'indigo',
      component: 'AppsCalendarApp',
      defaultWidth: 700,
      defaultHeight: 550,
      category: 'productivity'
    },
    {
      id: 'clock',
      name: 'Clock',
      nameKey: 'apps.clock.name',
      icon: 'i-lucide-clock',
      color: 'teal',
      component: 'AppsClockApp',
      defaultWidth: 380,
      defaultHeight: 440,
      category: 'utility'
    },
    {
      id: 'image-viewer',
      name: 'Image Viewer',
      nameKey: 'apps.imageViewer.name',
      icon: 'i-lucide-image',
      color: 'orange',
      component: 'AppsImageViewer',
      defaultWidth: 700,
      defaultHeight: 550,
      category: 'media'
    },
    {
      id: 'sticky-notes',
      name: 'Sticky Notes',
      nameKey: 'apps.stickyNotes.name',
      icon: 'i-lucide-sticky-note',
      color: 'yellow',
      component: 'AppsStickyNotes',
      defaultWidth: 700,
      defaultHeight: 500,
      category: 'productivity'
    }
  ] as const

  for (const app of builtinApps) {
    store.registerApp(app)
  }
})
