export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'text-editor',
    name: 'Text Editor',
    nameKey: 'apps.textEditor.name',
    icon: 'i-lucide-file-text',
    color: 'blue',
    component: 'AppsTextEditor',
    defaultWidth: 700,
    defaultHeight: 520,
    category: 'productivity'
  })
})
