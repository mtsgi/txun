import { defineStore } from 'pinia'

export interface WindowState {
  id: string
  appId: string
  title: string
  icon: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  isMinimized: boolean
  isMaximized: boolean
  virtualDesktopId: string
  preMaximize?: { x: number, y: number, width: number, height: number }
}

export interface VirtualDesktop {
  id: string
  name: string
}

export interface AppMeta {
  id: string
  name: string
  nameKey: string
  icon: string
  component: string
  defaultWidth: number
  defaultHeight: number
  category?: string
}

export type AppFont = 'system' | 'sans' | 'mono' | 'serif'

export interface DesktopState {
  windows: WindowState[]
  virtualDesktops: VirtualDesktop[]
  activeVirtualDesktopId: string
  theme: 'light' | 'dark'
  locale: 'ja' | 'en'
  font: AppFont
  primaryColor: string
  apps: AppMeta[]
  nextZIndex: number
  wallpaper: string
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
    wallpaper: ''
  }),

  getters: {
    activeWindows: (state): WindowState[] =>
      state.windows.filter(w => w.virtualDesktopId === state.activeVirtualDesktopId),

    visibleWindows: (state): WindowState[] =>
      state.windows.filter(
        w => w.virtualDesktopId === state.activeVirtualDesktopId && !w.isMinimized
      ),

    topWindow: (state): WindowState | undefined =>
      state.windows
        .filter(w => w.virtualDesktopId === state.activeVirtualDesktopId && !w.isMinimized)
        .reduce<WindowState | undefined>((max, w) => {
          if (!max || w.zIndex > max.zIndex) return w
          return max
        }, undefined)
  },

  actions: {
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

    closeWindow(id: string): void {
      const idx = this.windows.findIndex(w => w.id === id)
      if (idx !== -1) this.windows.splice(idx, 1)
    },

    minimizeWindow(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (w) w.isMinimized = true
    },

    restoreWindow(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (w) {
        w.isMinimized = false
        this.focusWindow(id)
      }
    },

    toggleMaximize(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (!w) return
      if (w.isMaximized) {
        if (w.preMaximize) {
          w.x = w.preMaximize.x
          w.y = w.preMaximize.y
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

    focusWindow(id: string): void {
      const w = this.windows.find(w => w.id === id)
      if (w) w.zIndex = this.nextZIndex++
    },

    updateWindowBounds(
      id: string,
      bounds: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height'>>
    ): void {
      const w = this.windows.find(w => w.id === id)
      if (w) Object.assign(w, bounds)
    },

    addVirtualDesktop(): void {
      const id = `desktop-${Date.now()}`
      this.virtualDesktops.push({ id, name: `Desktop ${this.virtualDesktops.length + 1}` })
    },

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

    switchVirtualDesktop(id: string): void {
      if (this.virtualDesktops.some(d => d.id === id)) {
        this.activeVirtualDesktopId = id
      }
    },

    setTheme(theme: 'light' | 'dark'): void {
      this.theme = theme
    },

    setLocale(locale: 'ja' | 'en'): void {
      this.locale = locale
    },

    setFont(font: AppFont): void {
      this.font = font
    },

    setPrimaryColor(color: string): void {
      this.primaryColor = color
    },

    registerApp(app: AppMeta): void {
      if (!this.apps.some(a => a.id === app.id)) {
        this.apps.push(app)
      }
    }
  }
})
