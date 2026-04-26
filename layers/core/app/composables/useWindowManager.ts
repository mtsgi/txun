import { useDesktopStore } from '../stores/desktop'
import type { AppMeta } from '../stores/desktop'

export function useWindowManager() {
  const store = useDesktopStore()
  const colorMode = useColorMode()
  const { locale } = useI18n()

  function openApp(appId: string): string | undefined {
    const app = store.apps.find(a => a.id === appId)
    if (!app) return undefined
    return store.openWindow(app)
  }

  function setTheme(theme: 'light' | 'dark'): void {
    store.setTheme(theme)
    colorMode.preference = theme
  }

  function setLocale(loc: 'ja' | 'en'): void {
    store.setLocale(loc)
    locale.value = loc
  }

  return {
    windows: computed(() => store.activeWindows),
    visibleWindows: computed(() => store.visibleWindows),
    apps: computed(() => store.apps),
    openApp,
    openWindow: (app: AppMeta) => store.openWindow(app),
    closeWindow: (id: string) => store.closeWindow(id),
    minimizeWindow: (id: string) => store.minimizeWindow(id),
    restoreWindow: (id: string) => store.restoreWindow(id),
    toggleMaximize: (id: string) => store.toggleMaximize(id),
    focusWindow: (id: string) => store.focusWindow(id),
    updateWindowBounds: store.updateWindowBounds.bind(store),
    setTheme,
    setLocale
  }
}
