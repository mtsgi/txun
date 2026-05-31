export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'music-player',
    name: 'Music',
    nameKey: 'apps.musicPlayer.name',
    icon: 'i-lucide-music',
    color: 'violet',
    component: 'AppsMusicPlayer',
    defaultWidth: 480,
    defaultHeight: 560,
    category: 'media'
  })
})
