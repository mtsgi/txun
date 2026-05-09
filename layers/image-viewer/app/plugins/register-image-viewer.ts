export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'image-viewer',
    name: 'Image Viewer',
    nameKey: 'apps.imageViewer.name',
    icon: 'i-lucide-image',
    color: 'orange',
    component: 'AppsImageViewer',
    defaultWidth: 700,
    defaultHeight: 550,
    category: 'media'
  })
})
