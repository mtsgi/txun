import { useDesktopStore } from '../stores/desktop'
import type { AppMeta } from '../stores/desktop'

/**
 * ウィンドウ操作のコンポーザブル。
 * Pinia ストアのアクションに、カラーモード同期・ i18n ロケール同期のサイドエフェクトを加えたラッパー。
 */
export function useWindowManager() {
  const store = useDesktopStore()
  const colorMode = useColorMode()
  const i18n = useI18n()

  /**
   * アプリ ID を指定してアプリを開く。
   * @param appId - 開くアプリの ID
   * @returns 生成したウィンドウの ID、アプリが見つからなければ undefined
   */
  function openApp(appId: string): string | undefined {
    const app = store.apps.find(a => a.id === appId)
    if (!app) return undefined
    return store.openWindow(app)
  }

  /**
   * テーマを切り替える。Pinia ストアと Nuxt UI カラーモードの両方を同期する。
   * @param theme - 切り替え先のテーマ
   */
  function setTheme(theme: 'light' | 'dark'): void {
    store.setTheme(theme)
    colorMode.preference = theme
  }

  /**
   * 表示言語を切り替える。Pinia ストアと useI18n の locale の両方を同期する。
   * @param loc - 切り替え先のロケール
   */
  function setLocale(loc: 'ja' | 'en'): void {
    store.setLocale(loc)
    i18n.setLocale(loc)
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
