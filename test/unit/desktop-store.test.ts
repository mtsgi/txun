import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDesktopStore } from '../../layers/core/app/stores/desktop'
import type { AppMeta } from '../../layers/core/app/stores/desktop'

const mockApp: AppMeta = {
  id: 'test-app',
  name: 'Test App',
  nameKey: 'apps.test.name',
  icon: 'i-lucide-star',
  component: 'AppsTestApp',
  defaultWidth: 640,
  defaultHeight: 480,
  category: 'test'
}

describe('useDesktopStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── Initial state ──────────────────────────────────────────────
  describe('initial state', () => {
    it('has one default virtual desktop', () => {
      const store = useDesktopStore()
      expect(store.virtualDesktops).toHaveLength(1)
      expect(store.virtualDesktops[0]?.id).toBe('desktop-1')
    })

    it('defaults to dark theme', () => {
      const store = useDesktopStore()
      expect(store.theme).toBe('dark')
    })

    it('defaults to ja locale', () => {
      const store = useDesktopStore()
      expect(store.locale).toBe('ja')
    })

    it('defaults to system font', () => {
      const store = useDesktopStore()
      expect(store.font).toBe('system')
    })

    it('defaults to violet primaryColor', () => {
      const store = useDesktopStore()
      expect(store.primaryColor).toBe('violet')
    })

    it('starts with no windows', () => {
      const store = useDesktopStore()
      expect(store.windows).toHaveLength(0)
    })
  })

  // ── registerApp ────────────────────────────────────────────────
  describe('registerApp', () => {
    it('registers a new app', () => {
      const store = useDesktopStore()
      store.registerApp(mockApp)
      expect(store.apps).toHaveLength(1)
      expect(store.apps[0]?.id).toBe('test-app')
    })

    it('does not register the same app twice', () => {
      const store = useDesktopStore()
      store.registerApp(mockApp)
      store.registerApp(mockApp)
      expect(store.apps).toHaveLength(1)
    })
  })

  // ── openWindow / closeWindow ───────────────────────────────────
  describe('openWindow / closeWindow', () => {
    it('opens a window and returns its id', () => {
      const store = useDesktopStore()
      store.registerApp(mockApp)
      const id = store.openWindow(mockApp)
      expect(typeof id).toBe('string')
      expect(store.windows).toHaveLength(1)
      expect(store.windows[0]?.id).toBe(id)
    })

    it('window inherits app defaults', () => {
      const store = useDesktopStore()
      store.registerApp(mockApp)
      const id = store.openWindow(mockApp)
      const win = store.windows.find(w => w.id === id)
      expect(win?.appId).toBe('test-app')
      expect(win?.width).toBe(640)
      expect(win?.height).toBe(480)
      expect(win?.isMinimized).toBe(false)
      expect(win?.isMaximized).toBe(false)
    })

    it('option overrides are applied', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp, { x: 100, y: 200 })
      const win = store.windows.find(w => w.id === id)
      expect(win?.x).toBe(100)
      expect(win?.y).toBe(200)
    })

    it('closes a window by id', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      store.closeWindow(id)
      expect(store.windows).toHaveLength(0)
    })

    it('closing a non-existent id is a no-op', () => {
      const store = useDesktopStore()
      expect(() => store.closeWindow('non-existent')).not.toThrow()
    })
  })

  // ── minimizeWindow / restoreWindow ─────────────────────────────
  describe('minimizeWindow / restoreWindow', () => {
    it('minimizes a window', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      store.minimizeWindow(id)
      expect(store.windows.find(w => w.id === id)?.isMinimized).toBe(true)
    })

    it('restores a minimized window', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      store.minimizeWindow(id)
      store.restoreWindow(id)
      expect(store.windows.find(w => w.id === id)?.isMinimized).toBe(false)
    })
  })

  // ── toggleMaximize ─────────────────────────────────────────────
  describe('toggleMaximize', () => {
    it('maximizes a normal window', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      store.toggleMaximize(id)
      expect(store.windows.find(w => w.id === id)?.isMaximized).toBe(true)
    })

    it('saves pre-maximize bounds', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp, { x: 50, y: 60, width: 400, height: 300 })
      store.toggleMaximize(id)
      const win = store.windows.find(w => w.id === id)
      expect(win?.preMaximize).toEqual({ x: 50, y: 60, width: 400, height: 300 })
    })

    it('restores bounds on second toggle', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp, { x: 50, y: 60, width: 400, height: 300 })
      store.toggleMaximize(id)
      store.toggleMaximize(id)
      const win = store.windows.find(w => w.id === id)
      expect(win?.isMaximized).toBe(false)
      expect(win?.x).toBe(50)
      expect(win?.y).toBe(60)
      expect(win?.width).toBe(400)
      expect(win?.height).toBe(300)
    })
  })

  // ── focusWindow / updateWindowBounds ──────────────────────────
  describe('focusWindow / updateWindowBounds', () => {
    it('increases zIndex on focus', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      const before = store.windows.find(w => w.id === id)?.zIndex ?? 0
      store.focusWindow(id)
      const after = store.windows.find(w => w.id === id)?.zIndex ?? 0
      expect(after).toBeGreaterThan(before)
    })

    it('updates position bounds', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      store.updateWindowBounds(id, { x: 300, y: 400 })
      const win = store.windows.find(w => w.id === id)
      expect(win?.x).toBe(300)
      expect(win?.y).toBe(400)
    })

    it('updates size bounds', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      store.updateWindowBounds(id, { width: 800, height: 600 })
      const win = store.windows.find(w => w.id === id)
      expect(win?.width).toBe(800)
      expect(win?.height).toBe(600)
    })
  })

  // ── getters ────────────────────────────────────────────────────
  describe('getters', () => {
    it('activeWindows returns windows on active virtual desktop', () => {
      const store = useDesktopStore()
      store.openWindow(mockApp)
      expect(store.activeWindows).toHaveLength(1)
    })

    it('visibleWindows excludes minimized windows', () => {
      const store = useDesktopStore()
      const id = store.openWindow(mockApp)
      expect(store.visibleWindows).toHaveLength(1)
      store.minimizeWindow(id)
      expect(store.visibleWindows).toHaveLength(0)
    })

    it('topWindow returns the window with highest zIndex', () => {
      const store = useDesktopStore()
      const id1 = store.openWindow(mockApp)
      const id2 = store.openWindow(mockApp)
      store.focusWindow(id1)
      expect(store.topWindow?.id).toBe(id1)
      store.focusWindow(id2)
      expect(store.topWindow?.id).toBe(id2)
    })
  })

  // ── virtual desktops ──────────────────────────────────────────
  describe('virtual desktops', () => {
    it('adds a virtual desktop', () => {
      const store = useDesktopStore()
      store.addVirtualDesktop()
      expect(store.virtualDesktops).toHaveLength(2)
    })

    it('switches virtual desktop', () => {
      const store = useDesktopStore()
      store.addVirtualDesktop()
      const second = store.virtualDesktops[1]
      if (!second) throw new Error('no second desktop')
      store.switchVirtualDesktop(second.id)
      expect(store.activeVirtualDesktopId).toBe(second.id)
    })

    it('removes a virtual desktop and its windows', () => {
      const store = useDesktopStore()
      store.addVirtualDesktop()
      const second = store.virtualDesktops[1]
      if (!second) throw new Error('no second desktop')
      store.switchVirtualDesktop(second.id)
      store.openWindow(mockApp)
      store.removeVirtualDesktop(second.id)
      expect(store.virtualDesktops).toHaveLength(1)
      expect(store.windows).toHaveLength(0)
    })

    it('cannot remove the last virtual desktop', () => {
      const store = useDesktopStore()
      store.removeVirtualDesktop('desktop-1')
      expect(store.virtualDesktops).toHaveLength(1)
    })

    it('switches to first desktop when active desktop is removed', () => {
      const store = useDesktopStore()
      store.addVirtualDesktop()
      const second = store.virtualDesktops[1]
      if (!second) throw new Error('no second desktop')
      store.switchVirtualDesktop(second.id)
      store.removeVirtualDesktop(second.id)
      expect(store.activeVirtualDesktopId).toBe('desktop-1')
    })
  })

  // ── theme / locale / font / primaryColor ──────────────────────
  describe('setTheme / setLocale / setFont / setPrimaryColor', () => {
    it('sets light theme', () => {
      const store = useDesktopStore()
      store.setTheme('light')
      expect(store.theme).toBe('light')
    })

    it('sets locale to en', () => {
      const store = useDesktopStore()
      store.setLocale('en')
      expect(store.locale).toBe('en')
    })

    it('sets font to mono', () => {
      const store = useDesktopStore()
      store.setFont('mono')
      expect(store.font).toBe('mono')
    })

    it('sets primaryColor', () => {
      const store = useDesktopStore()
      store.setPrimaryColor('blue')
      expect(store.primaryColor).toBe('blue')
    })
  })
})
