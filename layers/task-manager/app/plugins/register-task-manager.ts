export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'task-manager',
    name: 'Task Manager',
    nameKey: 'apps.taskManager.name',
    icon: 'i-lucide-activity',
    color: 'emerald',
    component: 'AppsTaskManager',
    defaultWidth: 640,
    defaultHeight: 480,
    category: 'system'
  })
})
