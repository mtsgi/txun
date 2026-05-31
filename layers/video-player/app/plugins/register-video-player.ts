export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'video-player',
    name: 'Video',
    nameKey: 'apps.videoPlayer.name',
    icon: 'i-lucide-video',
    color: 'purple',
    component: 'AppsVideoPlayer',
    defaultWidth: 800,
    defaultHeight: 560,
    category: 'media'
  })
})
