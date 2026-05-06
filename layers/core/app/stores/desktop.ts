import { defineStore } from 'pinia'
import { clampPosition } from '../utils/window-manager'

/** ウィンドウ一つ分の状態を表すインターフェース */
export interface WindowState {
  /** ウィンドウ固有の ID */
  id: string
  /** 対応アプリの ID */
  appId: string
  /** ウィンドウタイトル */
  title: string
  /** i18n キー（存在する場合は title より優先して翻訳に使用） */
  nameKey?: string
  /** アイコンクラス名 */
  icon: string
  /** 左端の X 座標（px） */
  x: number
  /** 上端の Y 座標（px） */
  y: number
  /** 幅（px） */
  width: number
  /** 高さ（px） */
  height: number
  /** z-index 層
順値 */
  zIndex: number
  /** 最小化中かどうか */
  isMinimized: boolean
  /** 最大化中かどうか */
  isMaximized: boolean
  /** 所属する仮想デスクトップの ID */
  virtualDesktopId: string
  /** 最大化前のウィンドウ境界（復元用） */
  preMaximize?: { x: number, y: number, width: number, height: number }
}

/** 仮想デスクトップのメタデータを表すインターフェース */
export interface VirtualDesktop {
  /** 仮想デスクトップ固有の ID */
  id: string
  /** 表示名 */
  name: string
}

/** アプリの登録情報を表すインターフェース */
export interface AppMeta {
  /** アプリ固有の ID */
  id: string
  /** アプリ表示名（フォールバック用） */
  name: string
  /** i18n キー */
  nameKey: string
  /** アイコンクラス名 */
  icon: string
  /** Nuxt auto-import 名（コンポーネント名） */
  component: string
  /** ウィンドウのデフォルト幅（px） */
  defaultWidth: number
  /** ウィンドウのデフォルト高さ（px） */
  defaultHeight: number
  /** アプリのカテゴリ（任意） */
  category?: string
}

/** アプリ全体で使用するフォント種別 */
export type AppFont = 'system' | 'sans' | 'mono' | 'serif'

/** ボーダー半径の設定値 */
export type AppRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl'

/** ランチャーフォルダーを表すインターフェース */
export interface LauncherFolder {
  /** フォルダー固有の ID */
  id: string
  /** フォルダー表示名 */
  name: string
  /** フォルダーに含まれるアプリ ID の配列 */
  appIds: string[]
}

/** デスクトップ全体の状態ツリーを表すインターフェース */
export interface DesktopState {
  /** 開いているウィンドウ一覧 */
  windows: WindowState[]
  /** 仮想デスクトップ一覧 */
  virtualDesktops: VirtualDesktop[]
  /** 現在アクティブな仮想デスクトップの ID */
  activeVirtualDesktopId: string
  /** 現在のテーマ */
  theme: 'light' | 'dark'
  /** 現在の言語 */
  locale: 'ja' | 'en'
  /** アプリ全体に適用するフォント */
  font: AppFont
  /** アクセントカラー名 */
  primaryColor: string
  /** 登録済みアプリ一覧 */
  apps: AppMeta[]
  /** 次に割り当てる z-index 値 */
  nextZIndex: number
  /** 壁紙プリセット ID または CSS 文字列 */
  wallpaper: string
  /** ボーダー半径設定 */
  radius: AppRadius
  /** ランチャーフォルダー一覧 */
  launcherFolders: LauncherFolder[]
}

export const useDesktopStore = defineStore('desktop', {
  state: (): DesktopState => ({
    windows: [],
    virtualDesktops: [{ id: 'desktop-1', name: 'Desktop 1' }],
    activeVirtualDesktopId: 'desktop-1',
    theme: 'dark',
    locale: 'ja',
    font: 'system',
    primaryColor: 'violet',
    apps: [],
    nextZIndex: 100,
    wallpaper: 'gradient-default',
    radius: 'md',
    launcherFolders: []
  }),

  getters: {
    /** 現在の仮想デスクトップに属するウィンドウ一覧（最小化を含む） */
    activeWindows: (state): WindowState[] =>
      state.windows.filter(w => w.virtualDesktopId === state.activeVirtualDesktopId),

    /** 現在の仮想デスクトップに属し、最小化されていないウィンドウ一覧 */
    visibleWindows: (state): WindowState[] =>
      state.windows.filter(
        w => w.virtualDesktopId === state.activeVirtualDesktopId && !w.isMinimized
      ),

    /** 現在最前面に表示されているウィンドウ（z-index 最大） */
    topWindow: (state): WindowState | undefined =>
      state.windows
        .filter(w => w.virtualDesktopId === state.activeVirtualDesktopId && !w.isMinimized)
        .reduce<WindowState | undefined>((max, w) => {
          if (!max || w.zIndex > max.zIndex) return w
          return max
        }, undefined)
  },

  actions: {
    /**
     * アプリを新規ウィンドウとして開く。
     * @param app - 開くアプリのメタ情報
     * @param options - ウィンドウ状態の初期値上書き（任意）
     * @returns 生成したウィンドウの ID
     */
    openWindow(app: AppMeta, options?: Partial<WindowState>): string {
      const id = `window-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const zIndex = this.nextZIndex++
      const cascadeCount = this.windows.filter(
        w => w.appId === app.id && w.virtualDesktopId === this.activeVirtualDesktopId
      ).length
      const offset = (cascadeCount % 8) * 30

      this.windows.push({
        id,
        appId: app.id,
        title: app.name,
        nameKey: app.nameKey,
        icon: app.icon,
        x: 80 + offset,
        y: 40 + offset,
        width: app.defaultWidth,
        height: app.defaultHeight,
        zIndex,
        isMinimized: false,
        isMaximized: false,
        virtualDesktopId: this.activeVirtualDesktopId,
        ...options
      })
      return id
    },

    /**
     * 指定 ID のウィンドウを閉じる。
     * @param id - 閉じるウィンドウの ID
     */
    closeWindow(id: string): void {
      const idx = this.windows.findIndex(w => w.id === id)
      if (idx !== -1) this.windows.splice(idx, 1)
    },

    /**
     * 指定 ID のウィンドウを最小化する。
     * @param id - 最小化するウィンドウの ID
     */
    minimizeWindow(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (w) w.isMinimized = true
    },

    /**
     * 指定 ID のウィンドウを最小化から復元し、フォーカスする。
     * @param id - 復元するウィンドウの ID
     */
    restoreWindow(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (w) {
        w.isMinimized = false
        this.focusWindow(id)
      }
    },

    /**
     * 指定 ID のウィンドウの最大化状態をトグルする。
     * 最大化中は preMaximize に復元用境界を保存する。
     * @param id - 最大化をトグルするウィンドウの ID
     */
    toggleMaximize(id: string, screenWidth = 1280, screenHeight = 720, taskbarHeight = 48): void {
      const w = this.windows.find(w => w.id === id)
      if (!w) return
      if (w.isMaximized) {
        if (w.preMaximize) {
          const clamped = clampPosition(
            { x: w.preMaximize.x, y: w.preMaximize.y, width: w.preMaximize.width, height: w.preMaximize.height },
            screenWidth, screenHeight, taskbarHeight
          )
          w.x = clamped.x
          w.y = clamped.y
          w.width = w.preMaximize.width
          w.height = w.preMaximize.height
          w.preMaximize = undefined
        }
        w.isMaximized = false
      } else {
        w.preMaximize = { x: w.x, y: w.y, width: w.width, height: w.height }
        w.isMaximized = true
      }
    },

    /**
     * 指定 ID のウィンドウにフォーカスし、z-index を最前面に札当てる。
     * @param id - フォーカスするウィンドウの ID
     */
    focusWindow(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (w) w.zIndex = this.nextZIndex++
    },

    /**
     * 指定 ID のウィンドウの位置・サイズを更新する。
     * @param id - 更新対象のウィンドウ ID
     * @param bounds - 上書きする境界プロパティ
     */
    updateWindowBounds(
      id: string,
      bounds: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height'>>
    ): void {
      const w = this.windows.find(w => w.id === id)
      if (w) Object.assign(w, bounds)
    },

    /** 新しい仮想デスクトップを追加する。 */
    addVirtualDesktop(): void {
      const id = `desktop-${Date.now()}`
      this.virtualDesktops.push({ id, name: `Desktop ${this.virtualDesktops.length + 1}` })
    },

    /**
     * 指定 ID の仮想デスクトップを削除する。
     * 最後の 1 つの仮想デスクトップは削除できない。
     * 削除対象のデスクトップに属するウィンドウは全閉じされる。
     * @param id - 削除する仮想デスクトップの ID
     */
    removeVirtualDesktop(id: string): void {
      if (this.virtualDesktops.length <= 1) return
      this.windows = this.windows.filter(w => w.virtualDesktopId !== id)
      const idx = this.virtualDesktops.findIndex(d => d.id === id)
      if (idx !== -1) this.virtualDesktops.splice(idx, 1)
      if (this.activeVirtualDesktopId === id) {
        const remaining = this.virtualDesktops[0]
        if (remaining) this.activeVirtualDesktopId = remaining.id
      }
    },

    /**
     * 指定 ID の仮想デスクトップに切り替える。
     * @param id - 切り替え先の仮想デスクトップの ID
     */
    switchVirtualDesktop(id: string): void {
      if (this.virtualDesktops.some(d => d.id === id)) {
        this.activeVirtualDesktopId = id
      }
    },

    /**
     * テーマを切り替える。
     * @param theme - 切り替え先のテーマ
     */
    setTheme(theme: 'light' | 'dark'): void {
      this.theme = theme
    },

    /**
     * 表示言語を切り替える。
     * @param locale - 切り替え先のロケール
     */
    setLocale(locale: 'ja' | 'en'): void {
      this.locale = locale
    },

    /**
     * アプリ全体のフォントを切り替える。
     * @param font - 切り替え先のフォント種別
     */
    setFont(font: AppFont): void {
      this.font = font
    },

    /**
     * アクセントカラーを変更する。
     * @param color - 変更先のカラー名（Nuxt UI のカラートークン）
     */
    setPrimaryColor(color: string): void {
      this.primaryColor = color
    },

    /**
     * 壁紙を変更する。
     * @param wallpaper - 壁紙プリセット ID
     */
    setWallpaper(wallpaper: string): void {
      this.wallpaper = wallpaper
    },

    /**
     * ボーダー半径設定を変更する。
     * @param radius - 変更先の半径設定値
     */
    setRadius(radius: AppRadius): void {
      this.radius = radius
    },

    /**
     * アプリをデスクトップに登録する。同じ ID のアプリが既に登録済みの場合は何もしない。
     * @param app - 登録するアプリのメタ情報
     */
    registerApp(app: AppMeta): void {
      if (!this.apps.some(a => a.id === app.id)) {
        this.apps.push(app)
      }
    },

    /**
     * 新しいランチャーフォルダーを作成する。
     * @param name - フォルダー表示名
     */
    createLauncherFolder(name: string): void {
      const id = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      this.launcherFolders.push({ id, name, appIds: [] })
    },

    /**
     * ランチャーフォルダーの名前を変更する。
     * @param id - 変更対象のフォルダー ID
     * @param name - 新しい表示名
     */
    renameLauncherFolder(id: string, name: string): void {
      const folder = this.launcherFolders.find(f => f.id === id)
      if (folder) folder.name = name
    },

    /**
     * ランチャーフォルダーを削除する。
     * @param id - 削除するフォルダー ID
     */
    deleteLauncherFolder(id: string): void {
      const idx = this.launcherFolders.findIndex(f => f.id === id)
      if (idx !== -1) this.launcherFolders.splice(idx, 1)
    },

    /**
     * 指定フォルダーにアプリを追加する。既に含まれている場合は何もしない。
     * @param folderId - 追加先フォルダーの ID
     * @param appId - 追加するアプリの ID
     */
    addAppToFolder(folderId: string, appId: string): void {
      const folder = this.launcherFolders.find(f => f.id === folderId)
      if (folder && !folder.appIds.includes(appId)) {
        folder.appIds.push(appId)
      }
    },

    /**
     * 指定フォルダーからアプリを削除する。
     * @param folderId - 削除元フォルダーの ID
     * @param appId - 削除するアプリの ID
     */
    removeAppFromFolder(folderId: string, appId: string): void {
      const folder = this.launcherFolders.find(f => f.id === folderId)
      if (folder) {
        const idx = folder.appIds.indexOf(appId)
        if (idx !== -1) folder.appIds.splice(idx, 1)
      }
    }
  }
})
