export default defineNuxtPlugin(() => {
  const desktopStore = useDesktopStore()

  desktopStore.registerApp({
    id: 'git-viewer',
    name: 'Git Viewer',
    nameKey: 'apps.gitViewer.name',
    icon: 'i-lucide-git-branch',
    color: 'orange',
    component: 'AppsGitViewer',
    defaultWidth: 960,
    defaultHeight: 640,
    category: 'development'
  })
})
