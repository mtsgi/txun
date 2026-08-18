// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClipboardStore } from '../../layers/core/app/stores/clipboard'
import { insertTextToActiveElement, useClipboard } from '../../layers/core/app/composables/useClipboard'

describe('Clipboard system (useClipboardStore & useClipboard)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('copyText', () => {
    it('adds text entry to history and sets as current', () => {
      const store = useClipboardStore()
      const entry = store.copyText('Hello World')

      expect(entry.type).toBe('text')
      expect(entry.content).toBe('Hello World')
      expect(entry.pinned).toBe(false)
      expect(store.history.length).toBe(1)
      expect(store.currentEntry?.id).toBe(entry.id)
    })

    it('supports HTML formatted text copying', () => {
      const store = useClipboardStore()
      const entry = store.copyText('Heading', { html: '<h1>Heading</h1>' })

      expect(entry.type).toBe('html')
      expect(entry.content).toBe('Heading')
      expect(entry.htmlContent).toBe('<h1>Heading</h1>')
    })

    it('updates timestamp and deduplicates identical text copied consecutively', () => {
      const store = useClipboardStore()
      const entry1 = store.copyText('Duplicate Text')
      const entry2 = store.copyText('Duplicate Text')

      expect(store.history.length).toBe(1)
      expect(entry2.id).toBe(entry1.id)
    })
  })

  describe('copyImage', () => {
    it('adds image entry with dimensions and mimeType', () => {
      const store = useClipboardStore()
      const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const entry = store.copyImage(dummyDataUrl, {
        mimeType: 'image/png',
        width: 100,
        height: 100,
        fileName: 'test.png',
        syncNative: false
      })

      expect(entry.type).toBe('image')
      expect(entry.content).toBe(dummyDataUrl)
      expect(entry.metadata?.width).toBe(100)
      expect(entry.metadata?.height).toBe(100)
      expect(entry.metadata?.fileName).toBe('test.png')
    })
  })

  describe('copyFiles', () => {
    it('adds virtual files entry with paths and mountId', () => {
      const store = useClipboardStore()
      const paths = ['/documents/note.txt', '/documents/todo.md']
      const entry = store.copyFiles(paths, { mountId: 'mount-1', isCut: false })

      expect(entry.type).toBe('files')
      expect(entry.metadata?.paths).toEqual(paths)
      expect(entry.metadata?.mountId).toBe('mount-1')
      expect(entry.metadata?.isCut).toBe(false)
    })
  })

  describe('Pinning & History limit enforcement', () => {
    it('toggles pin state on entry', () => {
      const store = useClipboardStore()
      const entry = store.copyText('Pin me')

      expect(entry.pinned).toBe(false)
      store.togglePin(entry.id)
      expect(store.history.find(e => e.id === entry.id)?.pinned).toBe(true)
      expect(store.pinnedEntries.length).toBe(1)

      store.togglePin(entry.id)
      expect(store.history.find(e => e.id === entry.id)?.pinned).toBe(false)
    })

    it('enforces maxHistory limit preserving pinned items', () => {
      const store = useClipboardStore()
      store.maxHistory = 5

      // Add 5 items
      for (let i = 1; i <= 5; i++) {
        store.copyText(`Item ${i}`)
      }

      // Pin the oldest item (Item 1)
      const oldest = store.history.find(i => i.content === 'Item 1')!
      store.togglePin(oldest.id)

      // Add 2 more items
      store.copyText('Item 6')
      store.copyText('Item 7')

      expect(store.history.length).toBe(5)
      // Pinned item must be preserved
      expect(store.history.some(i => i.content === 'Item 1' && i.pinned)).toBe(true)
      // Latest items must be present
      expect(store.history.some(i => i.content === 'Item 7')).toBe(true)
      expect(store.history.some(i => i.content === 'Item 6')).toBe(true)
    })

    it('clears unpinned history while preserving pinned entries', () => {
      const store = useClipboardStore()
      const e1 = store.copyText('Keep me')
      store.copyText('Delete me 1')
      store.copyText('Delete me 2')

      store.togglePin(e1.id)
      store.clearHistory(true)

      expect(store.history.length).toBe(1)
      expect(store.history[0]?.content).toBe('Keep me')
    })
  })

  describe('Filtering and Search query', () => {
    it('filters items by type', () => {
      const store = useClipboardStore()
      store.copyText('A text entry')
      store.copyImage('data:image/png;base64,xyz', { mimeType: 'image/png', syncNative: false })
      store.copyFiles(['/test.txt'])

      store.setActiveFilter('text')
      expect(store.filteredHistory.length).toBe(1)
      expect(store.filteredHistory[0]?.type).toBe('text')

      store.setActiveFilter('image')
      expect(store.filteredHistory.length).toBe(1)
      expect(store.filteredHistory[0]?.type).toBe('image')

      store.setActiveFilter('files')
      expect(store.filteredHistory.length).toBe(1)
      expect(store.filteredHistory[0]?.type).toBe('files')

      store.setActiveFilter('all')
      expect(store.filteredHistory.length).toBe(3)
    })

    it('filters items by search query', () => {
      const store = useClipboardStore()
      store.copyText('Apple banana')
      store.copyText('Cherry orange')

      store.setSearchQuery('banana')
      expect(store.filteredHistory.length).toBe(1)
      expect(store.filteredHistory[0]?.content).toBe('Apple banana')
    })
  })

  describe('insertTextToActiveElement', () => {
    it('inserts text into HTMLInputElement at cursor position', () => {
      const input = document.createElement('input')
      input.value = 'Hello World'
      document.body.appendChild(input)
      input.setSelectionRange(5, 5) // after 'Hello'

      const success = insertTextToActiveElement(' Beautiful', input)
      expect(success).toBe(true)
      expect(input.value).toBe('Hello Beautiful World')

      document.body.removeChild(input)
    })

    it('replaces selected text in HTMLTextAreaElement', () => {
      const textarea = document.createElement('textarea')
      textarea.value = 'Foo Bar Baz'
      document.body.appendChild(textarea)
      textarea.setSelectionRange(4, 7) // 'Bar'

      const success = insertTextToActiveElement('Qux', textarea)
      expect(success).toBe(true)
      expect(textarea.value).toBe('Foo Qux Baz')

      document.body.removeChild(textarea)
    })
  })

  describe('syncFromNativeClipboard', () => {
    it('imports new text from host OS native clipboard', async () => {
      const store = useClipboardStore()

      // Mock navigator.clipboard.readText
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: async () => 'Host OS Copied Text',
          writeText: async () => {}
        },
        configurable: true,
        writable: true
      })

      const entry = await store.syncFromNativeClipboard()
      expect(entry).not.toBeNull()
      expect(entry?.content).toBe('Host OS Copied Text')
      expect(store.currentEntry?.content).toBe('Host OS Copied Text')
      expect(store.history.length).toBe(1)
    })

    it('does not create duplicate entry if native text is already current', async () => {
      const store = useClipboardStore()
      store.copyText('Already Existing Text')

      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: async () => 'Already Existing Text',
          writeText: async () => {}
        },
        configurable: true,
        writable: true
      })

      const entry = await store.syncFromNativeClipboard()
      expect(entry?.content).toBe('Already Existing Text')
      expect(store.history.length).toBe(1)
    })
  })

  describe('useClipboard composable', () => {
    it('provides reactive access and pasteEntry functionality', () => {
      const clipboard = useClipboard()
      const entry = clipboard.copyText('Composable Text')

      expect(clipboard.history.value.length).toBe(1)
      expect(clipboard.currentEntry.value?.content).toBe('Composable Text')

      const input = document.createElement('input')
      document.body.appendChild(input)

      const pasted = clipboard.pasteEntry(entry, input)
      expect(pasted).toBe(true)
      expect(input.value).toBe('Composable Text')

      document.body.removeChild(input)
    })

    it('toggles quick history popup visibility', () => {
      const clipboard = useClipboard()
      expect(clipboard.isQuickHistoryOpen.value).toBe(false)
      clipboard.openQuickHistory()
      expect(clipboard.isQuickHistoryOpen.value).toBe(true)
      clipboard.closeQuickHistory()
      expect(clipboard.isQuickHistoryOpen.value).toBe(false)
      clipboard.toggleQuickHistory()
      expect(clipboard.isQuickHistoryOpen.value).toBe(true)
    })

    it('restores focus and pastes at preserved cursor position of lastEditableTarget', () => {
      const store = useClipboardStore()
      const clipboard = useClipboard()

      const input = document.createElement('input')
      input.value = 'Hello World'
      document.body.appendChild(input)

      // Simulate cursor positioned between 'Hello ' and 'World'
      store.setLastEditableTarget(input, 6, 6)

      const entry = store.copyText('Beautiful ')

      // Paste without passing targetEl (simulating pasting from history popup)
      const success = clipboard.pasteEntry(entry)
      expect(success).toBe(true)
      expect(input.value).toBe('Hello Beautiful World')
      expect(input.selectionStart).toBe(16)

      document.body.removeChild(input)
    })

    it('captures active input element automatically with captureCurrentActiveElement', () => {
      const store = useClipboardStore()
      const textarea = document.createElement('textarea')
      textarea.value = 'Initial content'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.setSelectionRange(7, 7)

      store.captureCurrentActiveElement()

      expect(store.lastEditableTarget?.element).toBe(textarea)
      expect(store.lastEditableTarget?.selectionStart).toBe(7)

      document.body.removeChild(textarea)
    })
  })
})
