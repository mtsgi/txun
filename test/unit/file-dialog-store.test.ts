import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileDialogStore } from '../../layers/core/app/stores/file-dialog'

describe('useFileDialogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── Initial state ──────────────────────────────────────────────
  describe('initial state', () => {
    it('starts closed with default options', () => {
      const store = useFileDialogStore()
      expect(store.isOpen).toBe(false)
      expect(store.title).toBe('')
      expect(store.mode).toBe('open-file')
      expect(store.filters).toEqual([])
      expect(store.multiple).toBe(false)
      expect(store.cwd).toBe('/')
      expect(store.selectedPaths).toEqual([])
      expect(store.fileNameInput).toBe('')
      expect(store.resolve).toBeNull()
      expect(store.reject).toBeNull()
    })
  })

  // ── open ───────────────────────────────────────────────────────
  describe('open', () => {
    it('sets state based on passed options', () => {
      const store = useFileDialogStore()
      const promise = store.open({
        title: 'Test Title',
        mode: 'save-file',
        filters: ['.png', '.jpg'],
        multiple: true,
        initialPath: '/images'
      })
      expect(store.isOpen).toBe(true)
      expect(store.title).toBe('Test Title')
      expect(store.mode).toBe('save-file')
      expect(store.filters).toEqual(['.png', '.jpg'])
      expect(store.multiple).toBe(true)
      expect(store.cwd).toBe('/images')
      expect(promise).toBeInstanceOf(Promise)
    })

    it('falls back to defaults if options are empty', () => {
      const store = useFileDialogStore()
      store.open()
      expect(store.isOpen).toBe(true)
      expect(store.title).toBe('')
      expect(store.mode).toBe('open-file')
      expect(store.filters).toEqual([])
      expect(store.multiple).toBe(false)
      expect(store.cwd).toBe('/')
    })
  })

  // ── confirm and cancel ─────────────────────────────────────────
  describe('confirm and cancel', () => {
    it('resolves with null on cancel', async () => {
      const store = useFileDialogStore()
      const promise = store.open()
      store.cancel()
      const result = await promise
      expect(result).toBeNull()
      expect(store.isOpen).toBe(false)
      expect(store.resolve).toBeNull()
      expect(store.reject).toBeNull()
    })

    it('resolves single file in open-file mode', async () => {
      const store = useFileDialogStore()
      const promise = store.open({ mode: 'open-file', multiple: false })
      store.selectedPaths = ['/documents/hello.txt']
      store.confirm('local-fs')
      const result = await promise
      expect(result).toEqual({
        path: '/documents/hello.txt',
        mountId: 'local-fs'
      })
      expect(store.isOpen).toBe(false)
    })

    it('resolves multiple files in open-file mode when multiple is true', async () => {
      const store = useFileDialogStore()
      const promise = store.open({ mode: 'open-file', multiple: true })
      store.selectedPaths = ['/documents/hello.txt', '/documents/world.txt']
      store.confirm('local-fs')
      const result = await promise
      expect(result).toEqual([
        { path: '/documents/hello.txt', mountId: 'local-fs' },
        { path: '/documents/world.txt', mountId: 'local-fs' }
      ])
      expect(store.isOpen).toBe(false)
    })

    it('resolves folder path in open-directory mode', async () => {
      const store = useFileDialogStore()
      const promise = store.open({ mode: 'open-directory', initialPath: '/pictures' })
      store.confirm('sd-card')
      const result = await promise
      expect(result).toEqual({
        path: '/pictures',
        mountId: 'sd-card'
      })
      expect(store.isOpen).toBe(false)
    })

    it('resolves combined path in save-file mode', async () => {
      const store = useFileDialogStore()
      const promise = store.open({ mode: 'save-file', initialPath: '/downloads' })
      store.fileNameInput = 'notes.md'
      store.confirm('cloud-drive')
      const result = await promise
      expect(result).toEqual({
        path: '/downloads/notes.md',
        mountId: 'cloud-drive'
      })
      expect(store.isOpen).toBe(false)
    })

    it('handles root path correctly in save-file mode', async () => {
      const store = useFileDialogStore()
      const promise = store.open({ mode: 'save-file', initialPath: '/' })
      store.fileNameInput = 'root-file.txt'
      store.confirm('local-fs')
      const result = await promise
      expect(result).toEqual({
        path: '/root-file.txt',
        mountId: 'local-fs'
      })
    })

    it('does not resolve when fileNameInput is empty or spaces in save-file mode', async () => {
      const store = useFileDialogStore()
      let resolved = false
      const promise = store.open({ mode: 'save-file' })
      promise.then(() => {
        resolved = true
      })

      store.fileNameInput = '   '
      store.confirm('local-fs')

      // Wait a microtask
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(resolved).toBe(false)
      expect(store.isOpen).toBe(true)
    })

    it('does not resolve in open-file mode if selectedPaths is empty', async () => {
      const store = useFileDialogStore()
      let resolved = false
      const promise = store.open({ mode: 'open-file' })
      promise.then(() => {
        resolved = true
      })

      store.selectedPaths = []
      store.confirm('local-fs')

      await new Promise(resolve => setTimeout(resolve, 0))
      expect(resolved).toBe(false)
      expect(store.isOpen).toBe(true)
    })

    it('calling confirm when resolve is null does not crash', () => {
      const store = useFileDialogStore()
      expect(() => store.confirm('local-fs')).not.toThrow()
    })

    it('calling cancel when resolve is null does not crash', () => {
      const store = useFileDialogStore()
      expect(() => store.cancel()).not.toThrow()
    })
  })
})
