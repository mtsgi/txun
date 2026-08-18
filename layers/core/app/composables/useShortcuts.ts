export type ShortcutActionId
  = | 'toggleOverview'
    | 'prevDesktop'
    | 'nextDesktop'
    | 'toggleSpotlight'
    | 'toggleLauncher'
    | 'toggleClipboardHistory'
    | 'closeWindow'
    | 'minimizeWindow'
    | 'maximizeWindow'

export interface ShortcutDefinition {
  id: ShortcutActionId
  labelKey: string
  descKey: string
  defaultKey: string
  category: 'system' | 'desktop' | 'window'
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'toggleOverview',
    labelKey: 'core.desktop.shortcuts.toggleOverview',
    descKey: 'core.desktop.shortcuts.toggleOverviewDesc',
    defaultKey: 'Ctrl+Alt+ArrowUp',
    category: 'desktop'
  },
  {
    id: 'prevDesktop',
    labelKey: 'core.desktop.shortcuts.prevDesktop',
    descKey: 'core.desktop.shortcuts.prevDesktopDesc',
    defaultKey: 'Ctrl+Alt+ArrowLeft',
    category: 'desktop'
  },
  {
    id: 'nextDesktop',
    labelKey: 'core.desktop.shortcuts.nextDesktop',
    descKey: 'core.desktop.shortcuts.nextDesktopDesc',
    defaultKey: 'Ctrl+Alt+ArrowRight',
    category: 'desktop'
  },
  {
    id: 'toggleSpotlight',
    labelKey: 'core.desktop.shortcuts.toggleSpotlight',
    descKey: 'core.desktop.shortcuts.toggleSpotlightDesc',
    defaultKey: 'Ctrl+k',
    category: 'system'
  },
  {
    id: 'toggleLauncher',
    labelKey: 'core.desktop.shortcuts.toggleLauncher',
    descKey: 'core.desktop.shortcuts.toggleLauncherDesc',
    defaultKey: 'Alt+Space',
    category: 'system'
  },
  {
    id: 'toggleClipboardHistory',
    labelKey: 'core.desktop.shortcuts.toggleClipboardHistory',
    descKey: 'core.desktop.shortcuts.toggleClipboardHistoryDesc',
    defaultKey: 'Meta+v',
    category: 'system'
  },
  {
    id: 'closeWindow',
    labelKey: 'core.desktop.shortcuts.closeWindow',
    descKey: 'core.desktop.shortcuts.closeWindowDesc',
    defaultKey: 'Alt+w',
    category: 'window'
  },
  {
    id: 'minimizeWindow',
    labelKey: 'core.desktop.shortcuts.minimizeWindow',
    descKey: 'core.desktop.shortcuts.minimizeWindowDesc',
    defaultKey: 'Alt+m',
    category: 'window'
  },
  {
    id: 'maximizeWindow',
    labelKey: 'core.desktop.shortcuts.maximizeWindow',
    descKey: 'core.desktop.shortcuts.maximizeWindowDesc',
    defaultKey: 'Alt+Enter',
    category: 'window'
  }
]

export const DEFAULT_SHORTCUTS: Record<ShortcutActionId, string> = {
  toggleOverview: 'Ctrl+Alt+ArrowUp',
  prevDesktop: 'Ctrl+Alt+ArrowLeft',
  nextDesktop: 'Ctrl+Alt+ArrowRight',
  toggleSpotlight: 'Ctrl+k',
  toggleLauncher: 'Alt+Space',
  toggleClipboardHistory: 'Meta+v',
  closeWindow: 'Alt+w',
  minimizeWindow: 'Alt+m',
  maximizeWindow: 'Alt+Enter'
}

/**
 * KeyboardEvent から正規化されたショートカット文字列を生成する
 * 例: 'Ctrl+Alt+ArrowUp', 'Alt+Space', 'Ctrl+Shift+Tab'
 */
export function stringifyKeyEvent(e: KeyboardEvent): string | null {
  // 単独の修飾キー押下はショートカットキーコンビネーションとして扱わない
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock'].includes(e.key)) {
    return null
  }

  const parts: string[] = []

  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')

  // 主キーの正規化
  let keyName = e.key
  if (keyName === ' ') keyName = 'Space'
  else if (keyName === '`') keyName = '`'
  else if (keyName.length === 1) keyName = keyName.toLowerCase()

  parts.push(keyName)

  return parts.join('+')
}

/**
 * KeyboardEvent が指定されたショートカット文字列と一致するか判定する
 */
export function matchShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr) return false

  const parts = shortcutStr.split('+').map(p => p.trim().toLowerCase())
  const hasCtrl = parts.includes('ctrl')
  const hasAlt = parts.includes('alt')
  const hasShift = parts.includes('shift')
  const hasMeta = parts.includes('meta')

  const nonModifierParts = parts.filter(p => !['ctrl', 'alt', 'shift', 'meta'].includes(p))
  const targetKey = nonModifierParts[0]

  if (Boolean(e.ctrlKey) !== hasCtrl) return false
  if (Boolean(e.altKey) !== hasAlt) return false
  if (Boolean(e.shiftKey) !== hasShift) return false
  if (Boolean(e.metaKey) !== hasMeta) return false

  if (!targetKey) return false

  let eventKey = e.key.toLowerCase()
  if (e.key === ' ' || e.code === 'Space') eventKey = 'space'

  return eventKey === targetKey
}

/**
 * 表示用（UKbd 等）にショートカット文字列を個別のキー配列に分解・整形する
 */
export function formatShortcutKeys(shortcutStr: string): string[] {
  if (!shortcutStr) return []
  return shortcutStr.split('+').map((part) => {
    switch (part) {
      case 'ArrowUp': return '↑'
      case 'ArrowDown': return '↓'
      case 'ArrowLeft': return '←'
      case 'ArrowRight': return '→'
      case 'Space': return 'Space'
      default: return part.length === 1 ? part.toUpperCase() : part
    }
  })
}

/**
 * ショートカット文字列（例: 'Ctrl+Alt+ArrowUp', 'Alt+Space'）を
 * Nuxt UI の defineShortcuts が解釈可能な形式（例: 'ctrl_alt_arrowup', 'alt_space'）に変換する
 */
export function toDefineShortcutKey(shortcutStr: string): string {
  if (!shortcutStr) return ''
  return shortcutStr
    .split('+')
    .map(part => part.trim().toLowerCase())
    .join('_')
}

export function useShortcuts() {
  const store = useDesktopStore()

  const shortcuts = computed(() => ({
    ...DEFAULT_SHORTCUTS,
    ...(store.shortcuts || {})
  }))

  function getShortcut(action: ShortcutActionId): string {
    return shortcuts.value[action] || DEFAULT_SHORTCUTS[action]
  }

  function getShortcutKeys(action: ShortcutActionId): string[] {
    return formatShortcutKeys(getShortcut(action))
  }

  function getDefineShortcutKey(action: ShortcutActionId): string {
    return toDefineShortcutKey(getShortcut(action))
  }

  return {
    definitions: SHORTCUT_DEFINITIONS,
    shortcuts,
    getShortcut,
    getShortcutKeys,
    getDefineShortcutKey,
    toDefineShortcutKey,
    matchShortcut,
    stringifyKeyEvent,
    formatShortcutKeys
  }
}
