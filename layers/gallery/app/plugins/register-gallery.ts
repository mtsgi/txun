export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'gallery',
    name: 'Gallery',
    nameKey: 'apps.gallery.name',
    icon: 'i-lucide-images',
    color: 'pink',
    component: 'AppsGallery',
    defaultWidth: 900,
    defaultHeight: 650,
    category: 'media'
  })
})
