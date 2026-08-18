import { computed } from 'vue'
import { useClipboardStore } from '../stores/clipboard'
import type { ClipboardEntry } from '../stores/clipboard'

/**
 * 現在アクティブな入力要素へテキストを挿入するユーティリティ関数
 */
export function insertTextToActiveElement(text: string, targetEl?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false

  const target = targetEl || (document.activeElement as HTMLElement | null)
  if (!target) return false

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    // input / textarea 要素
    const start = target.selectionStart ?? target.value.length
    const end = target.selectionEnd ?? target.value.length
    const val = target.value
    const nextVal = val.substring(0, start) + text + val.substring(end)
    target.value = nextVal
    const nextCursor = start + text.length
    target.setSelectionRange(nextCursor, nextCursor)

    // Vueのv-model等のリアクティビティを同期させるためのInput/Changeイベント発行
    target.dispatchEvent(new Event('input', { bubbles: true }))
    target.dispatchEvent(new Event('change', { bubbles: true }))
    target.focus()
    return true
  }

  if (target.isContentEditable) {
    // contenteditable 要素
    target.focus()
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode(text)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
      target.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    // execCommand fallback
    try {
      document.execCommand('insertText', false, text)
      return true
    } catch {
      // ignore
    }
  }

  return false
}

export function useClipboard() {
  const store = useClipboardStore()

  /**
   * エントリを現在のアクティブ要素（または直前の入力要素、指定要素）に貼り付ける
   */
  function pasteEntry(entry: ClipboardEntry, targetEl?: HTMLElement | null): boolean {
    if (!entry) return false

    // 対象要素の解決
    let target = targetEl

    if (!target) {
      const lastTarget = store.lastEditableTarget
      if (lastTarget?.element && typeof document !== 'undefined' && lastTarget.element.isConnected) {
        lastTarget.element.focus()
        if (
          (lastTarget.element instanceof HTMLInputElement || lastTarget.element instanceof HTMLTextAreaElement)
          && lastTarget.selectionStart !== undefined
          && lastTarget.selectionEnd !== undefined
        ) {
          try {
            lastTarget.element.setSelectionRange(lastTarget.selectionStart, lastTarget.selectionEnd)
          } catch {
            // ignore range error
          }
        }
        target = lastTarget.element
      } else if (typeof document !== 'undefined' && document.activeElement) {
        const active = document.activeElement as HTMLElement
        if (
          active instanceof HTMLInputElement
          || active instanceof HTMLTextAreaElement
          || active.isContentEditable
          || active.hasAttribute('data-txun-editable')
        ) {
          target = active
        }
      }
    }

    if (entry.type === 'text' || entry.type === 'html') {
      let success = false
      if (target) {
        success = insertTextToActiveElement(entry.content, target)
      }

      // ネイティブクリップボードにも反映
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(entry.content).catch(() => {})
      }

      // アクティブウィンドウやアプリ向けにカスタムイベントを発火
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('txun:clipboard-paste-text', {
          detail: { entry, target }
        }))
      }

      return target ? success : true
    }

    if (entry.type === 'image') {
      // ネイティブクリップボードに画像をセット
      store.copyImage(entry.content, {
        mimeType: entry.metadata?.mimeType,
        width: entry.metadata?.width,
        height: entry.metadata?.height,
        fileName: entry.metadata?.fileName
      })
      // カスタムイベントを発火（画像ビューアやホワイトボード等が捕捉可能）
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('txun:clipboard-paste-image', {
          detail: { entry, target }
        }))
      }
      return true
    }

    if (entry.type === 'files') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('txun:clipboard-paste-files', {
          detail: { entry, target }
        }))
      }
      return true
    }

    return false
  }

  return {
    history: computed(() => store.history),
    filteredHistory: computed(() => store.filteredHistory),
    currentEntry: computed(() => store.currentEntry),
    pinnedEntries: computed(() => store.pinnedEntries),
    isQuickHistoryOpen: computed(() => store.isQuickHistoryOpen),
    activeFilter: computed(() => store.activeFilter),
    searchQuery: computed(() => store.searchQuery),
    totalCount: computed(() => store.totalCount),
    copyText: store.copyText.bind(store),
    copyImage: store.copyImage.bind(store),
    copyFiles: store.copyFiles.bind(store),
    addEntry: store.addEntry.bind(store),
    togglePin: store.togglePin.bind(store),
    removeEntry: store.removeEntry.bind(store),
    clearHistory: store.clearHistory.bind(store),
    openQuickHistory: store.openQuickHistory.bind(store),
    closeQuickHistory: store.closeQuickHistory.bind(store),
    toggleQuickHistory: store.toggleQuickHistory.bind(store),
    setSearchQuery: store.setSearchQuery.bind(store),
    setActiveFilter: store.setActiveFilter.bind(store),
    syncFromNativeClipboard: store.syncFromNativeClipboard.bind(store),
    pasteEntry,
    insertTextToActiveElement
  }
}
