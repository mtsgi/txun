// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  stringifyKeyEvent,
  matchShortcut,
  formatShortcutKeys,
  toDefineShortcutKey,
  DEFAULT_SHORTCUTS,
  SHORTCUT_DEFINITIONS
} from '../../layers/core/app/composables/useShortcuts'
import { useDesktopStore } from '../../layers/core/app/stores/desktop'

describe('useShortcuts composable and DesktopStore shortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('stringifyKeyEvent', () => {
    it('returns null for standalone modifier keys', () => {
      const e = new KeyboardEvent('keydown', { key: 'Control' })
      expect(stringifyKeyEvent(e)).toBeNull()
    })

    it('stringifies Ctrl+Alt+ArrowUp', () => {
      const e = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        altKey: true
      })
      expect(stringifyKeyEvent(e)).toBe('Ctrl+Alt+ArrowUp')
    })

    it('stringifies Alt+Space', () => {
      const e = new KeyboardEvent('keydown', {
        key: ' ',
        altKey: true
      })
      expect(stringifyKeyEvent(e)).toBe('Alt+Space')
    })

    it('stringifies Ctrl+k with lowercase letter', () => {
      const e = new KeyboardEvent('keydown', {
        key: 'K',
        ctrlKey: true
      })
      expect(stringifyKeyEvent(e)).toBe('Ctrl+k')
    })
  })

  describe('matchShortcut', () => {
    it('matches exact shortcut', () => {
      const e = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        altKey: true
      })
      expect(matchShortcut(e, 'Ctrl+Alt+ArrowUp')).toBe(true)
    })

    it('does not match if modifier is missing', () => {
      const e = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        altKey: false
      })
      expect(matchShortcut(e, 'Ctrl+Alt+ArrowUp')).toBe(false)
    })

    it('matches Space key correctly', () => {
      const e = new KeyboardEvent('keydown', {
        key: ' ',
        altKey: true
      })
      expect(matchShortcut(e, 'Alt+Space')).toBe(true)
    })

    it('matches case insensitively for letters', () => {
      const e = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true
      })
      expect(matchShortcut(e, 'Ctrl+k')).toBe(true)
      expect(matchShortcut(e, 'ctrl+K')).toBe(true)
    })
  })

  describe('formatShortcutKeys', () => {
    it('formats arrows into symbols', () => {
      expect(formatShortcutKeys('Ctrl+Alt+ArrowUp')).toEqual(['Ctrl', 'Alt', '↑'])
      expect(formatShortcutKeys('Ctrl+Alt+ArrowLeft')).toEqual(['Ctrl', 'Alt', '←'])
      expect(formatShortcutKeys('Ctrl+Alt+ArrowRight')).toEqual(['Ctrl', 'Alt', '→'])
      expect(formatShortcutKeys('Ctrl+Alt+ArrowDown')).toEqual(['Ctrl', 'Alt', '↓'])
    })

    it('formats single characters in uppercase', () => {
      expect(formatShortcutKeys('Ctrl+k')).toEqual(['Ctrl', 'K'])
      expect(formatShortcutKeys('Alt+w')).toEqual(['Alt', 'W'])
    })
  })

  describe('toDefineShortcutKey', () => {
    it('transforms shortcut strings to defineShortcuts underscore format', () => {
      expect(toDefineShortcutKey('Ctrl+Alt+ArrowUp')).toBe('ctrl_alt_arrowup')
      expect(toDefineShortcutKey('Alt+Space')).toBe('alt_space')
      expect(toDefineShortcutKey('Ctrl+k')).toBe('ctrl_k')
      expect(toDefineShortcutKey('Alt+Enter')).toBe('alt_enter')
    })
  })

  describe('DesktopStore shortcut actions', () => {
    it('initializes with DEFAULT_SHORTCUTS', () => {
      const store = useDesktopStore()
      expect(store.shortcuts.toggleOverview).toBe(DEFAULT_SHORTCUTS.toggleOverview)
      expect(store.shortcuts.toggleSpotlight).toBe(DEFAULT_SHORTCUTS.toggleSpotlight)
    })

    it('updates a shortcut via setShortcut', () => {
      const store = useDesktopStore()
      store.setShortcut('toggleOverview', 'Ctrl+Shift+Tab')
      expect(store.shortcuts.toggleOverview).toBe('Ctrl+Shift+Tab')
    })

    it('resets a single shortcut via resetShortcut', () => {
      const store = useDesktopStore()
      store.setShortcut('toggleOverview', 'Ctrl+Shift+Tab')
      store.resetShortcut('toggleOverview')
      expect(store.shortcuts.toggleOverview).toBe('Ctrl+Alt+ArrowUp')
    })

    it('resets all shortcuts via resetShortcuts', () => {
      const store = useDesktopStore()
      store.setShortcut('toggleOverview', 'Ctrl+Shift+Tab')
      store.setShortcut('toggleSpotlight', 'Ctrl+Shift+F')
      store.resetShortcuts()
      expect(store.shortcuts.toggleOverview).toBe('Ctrl+Alt+ArrowUp')
      expect(store.shortcuts.toggleSpotlight).toBe('Ctrl+k')
    })
  })

  describe('SHORTCUT_DEFINITIONS', () => {
    it('contains all required actions', () => {
      const ids = SHORTCUT_DEFINITIONS.map(d => d.id)
      expect(ids).toContain('toggleOverview')
      expect(ids).toContain('prevDesktop')
      expect(ids).toContain('nextDesktop')
      expect(ids).toContain('toggleSpotlight')
      expect(ids).toContain('toggleLauncher')
      expect(ids).toContain('closeWindow')
      expect(ids).toContain('minimizeWindow')
      expect(ids).toContain('maximizeWindow')
    })
  })
})
