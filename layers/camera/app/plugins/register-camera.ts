export default defineNuxtPlugin(() => {
  useDesktopStore().registerApp({
    id: 'camera',
    name: 'Camera',
    nameKey: 'apps.camera.name',
    icon: 'i-lucide-camera',
    color: 'red',
    component: 'AppsCameraApp',
    defaultWidth: 720,
    defaultHeight: 540,
    category: 'utility'
  })
})
