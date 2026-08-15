import { defineStore } from 'pinia'
import { useDesktopStorage } from '../composables/useDesktopStorage'

export type ClipboardType = 'text' | 'image' | 'files' | 'html'

export interface ClipboardEntryMetadata {
  mimeType?: string
  width?: number
  height?: number
  paths?: string[]
  mountId?: string
  isCut?: boolean
  sizeBytes?: number
  fileName?: string
}

export interface ClipboardEntry {
  id: string
  type: ClipboardType
  content: string
  textPreview: string
  htmlContent?: string
  metadata?: ClipboardEntryMetadata
  pinned: boolean
  createdAt: number
}

export interface EditableTargetInfo {
  element: HTMLElement | null
  selectionStart?: number
  selectionEnd?: number
}

export interface ClipboardState {
  history: ClipboardEntry[]
  maxHistory: number
  isQuickHistoryOpen: boolean
  activeFilter: 'all' | 'text' | 'image' | 'files'
  searchQuery: string
  lastCopiedEntryId: string | null
  isRestored: boolean
  lastEditableTarget: EditableTargetInfo | null
}

const STORAGE_KEY = 'clipboard-history'
const DEFAULT_MAX_HISTORY = 50

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function truncatePreview(str: string, maxLength = 200): string {
  if (!str) return ''
  const trimmed = str.trim()
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength) + '…'
}

export const useClipboardStore = defineStore('clipboard', {
  state: (): ClipboardState => ({
    history: [],
    maxHistory: DEFAULT_MAX_HISTORY,
    isQuickHistoryOpen: false,
    activeFilter: 'all',
    searchQuery: '',
    lastCopiedEntryId: null,
    isRestored: false,
    lastEditableTarget: null
  }),

  getters: {
    /** フィルターおよび検索クエリを適用した履歴エントリ一覧（最新順、ピン留め優先） */
    filteredHistory: (state): ClipboardEntry[] => {
      let list = state.history

      // 種別フィルター
      if (state.activeFilter !== 'all') {
        list = list.filter((item) => {
          if (state.activeFilter === 'text') return item.type === 'text' || item.type === 'html'
          return item.type === state.activeFilter
        })
      }

      // 検索フィルター
      const q = state.searchQuery.trim().toLowerCase()
      if (q) {
        list = list.filter((item) => {
          if (item.textPreview.toLowerCase().includes(q)) return true
          if (item.type === 'text' && item.content.toLowerCase().includes(q)) return true
          if (item.metadata?.paths?.some(p => p.toLowerCase().includes(q))) return true
          if (item.metadata?.fileName?.toLowerCase().includes(q)) return true
          return false
        })
      }

      // ピン留めを上位、次いで作成日時順（降順）
      return [...list].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.createdAt - a.createdAt
      })
    },

    /** 最前面の最新クリップボードエントリ */
    currentEntry: (state): ClipboardEntry | null => {
      if (state.history.length === 0) return null
      // ピン留めに関わらず最新のもの
      const sorted = [...state.history].sort((a, b) => b.createdAt - a.createdAt)
      return sorted[0] ?? null
    },

    /** ピン留めされたエントリ一覧 */
    pinnedEntries: (state): ClipboardEntry[] => {
      return state.history.filter(item => item.pinned)
    },

    /** 履歴件数 */
    totalCount: (state): number => state.history.length
  },

  actions: {
    /**
     * クリップボード履歴をストレージ（IndexedDB）から復元する
     */
    async restoreFromStorage(): Promise<void> {
      if (this.isRestored) return
      try {
        const storage = useDesktopStorage()
        const saved = await storage.loadState<ClipboardEntry[]>(STORAGE_KEY)
        if (Array.isArray(saved)) {
          this.history = saved
        }
      } catch (err) {
        console.warn('Failed to restore clipboard history from storage', err)
      } finally {
        this.isRestored = true
      }
    },

    /**
     * クリップボード履歴をストレージへ保存する
     */
    async persistToStorage(): Promise<void> {
      try {
        const storage = useDesktopStorage()
        // 画像などのサイズ肥大化を抑えるため、最大履歴数分のプレーンオブジェクトを保存
        const toSave = this.history.slice(0, this.maxHistory)
        await storage.saveState(STORAGE_KEY, toSave)
      } catch (err) {
        console.warn('Failed to persist clipboard history to storage', err)
      }
    },

    /**
     * エントリを追加し、履歴上限を超えた非ピン留めエントリを削除する
     */
    addEntry(data: Omit<ClipboardEntry, 'id' | 'createdAt'> & { id?: string, createdAt?: number }): ClipboardEntry {
      // 直前と同一内容の重複エントリがある場合はタイムスタンプを更新して先頭へ
      const existingIndex = this.history.findIndex(item =>
        item.type === data.type && item.content === data.content
      )

      let entry: ClipboardEntry

      if (existingIndex !== -1) {
        const existing = this.history[existingIndex]!
        entry = {
          ...existing,
          ...data,
          pinned: existing.pinned || data.pinned,
          createdAt: Date.now()
        }
        this.history.splice(existingIndex, 1)
        this.history.unshift(entry)
      } else {
        entry = {
          id: data.id || generateId(),
          type: data.type,
          content: data.content,
          textPreview: data.textPreview,
          htmlContent: data.htmlContent,
          metadata: data.metadata,
          pinned: Boolean(data.pinned),
          createdAt: data.createdAt || Date.now()
        }
        this.history.unshift(entry)
      }

      this.lastCopiedEntryId = entry.id
      this.enforceHistoryLimit()
      this.persistToStorage()

      return entry
    },

    /**
     * 履歴上限（maxHistory）を超えた場合、古い非ピン留めエントリを削除する
     */
    enforceHistoryLimit(): void {
      if (this.history.length <= this.maxHistory) return

      // ピン留めエントリは保持し、非ピン留めの中で最も古いものから削除
      const unpinnedCount = this.history.filter(item => !item.pinned).length
      const pinnedCount = this.history.length - unpinnedCount

      if (pinnedCount >= this.maxHistory) {
        // ピン留めだけで上限に達している場合は非ピン留めをすべて削除
        this.history = this.history.filter(item => item.pinned)
        return
      }

      const allowedUnpinned = this.maxHistory - pinnedCount
      let currentUnpinned = 0

      // 作成日時降順で走査し、非ピン留めの許容数を超えたら除外
      this.history = this.history.filter((item) => {
        if (item.pinned) return true
        if (currentUnpinned < allowedUnpinned) {
          currentUnpinned++
          return true
        }
        return false
      })
    },

    /**
     * テキストをクリップボードにコピー
     */
    copyText(text: string, options?: { html?: string, syncNative?: boolean }): ClipboardEntry {
      const trimmed = text || ''
      const entry = this.addEntry({
        type: options?.html ? 'html' : 'text',
        content: trimmed,
        textPreview: truncatePreview(trimmed),
        htmlContent: options?.html,
        pinned: false,
        metadata: {
          sizeBytes: new Blob([trimmed]).size
        }
      })

      if (options?.syncNative !== false && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          if (options?.html && typeof ClipboardItem !== 'undefined') {
            const textBlob = new Blob([trimmed], { type: 'text/plain' })
            const htmlBlob = new Blob([options.html], { type: 'text/html' })
            navigator.clipboard.write([
              new ClipboardItem({
                'text/plain': textBlob,
                'text/html': htmlBlob
              })
            ]).catch(() => {
              // fallback
              navigator.clipboard.writeText(trimmed).catch(() => {})
            })
          } else {
            navigator.clipboard.writeText(trimmed).catch(() => {})
          }
        } catch {
          // ignore native clipboard write error
        }
      }

      return entry
    },

    /**
     * 画像をクリップボードにコピー
     */
    copyImage(
      dataUrl: string,
      options?: { mimeType?: string, width?: number, height?: number, syncNative?: boolean, fileName?: string }
    ): ClipboardEntry {
      const mimeType = options?.mimeType || 'image/png'
      const preview = options?.fileName
        ? `[Image: ${options.fileName}]`
        : `[Image: ${options?.width ? `${options.width}x${options.height} ` : ''}${mimeType}]`

      const entry = this.addEntry({
        type: 'image',
        content: dataUrl,
        textPreview: preview,
        pinned: false,
        metadata: {
          mimeType,
          width: options?.width,
          height: options?.height,
          fileName: options?.fileName,
          sizeBytes: Math.round((dataUrl.length * 3) / 4)
        }
      })

      if (options?.syncNative !== false && typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          // DataURL を Blob に変換してネイティブクリップボードへ書き込み
          fetch(dataUrl)
            .then(res => res.blob())
            .then((blob) => {
              const itemType = blob.type === 'image/png' ? 'image/png' : blob.type
              navigator.clipboard.write([
                new ClipboardItem({ [itemType]: blob })
              ]).catch(() => {})
            })
            .catch(() => {})
        } catch {
          // ignore
        }
      }

      return entry
    },

    /**
     * TxunOS 仮想ファイル参照をクリップボードにコピー
     */
    copyFiles(paths: string[], options?: { mountId?: string, isCut?: boolean }): ClipboardEntry {
      const count = paths.length
      const preview = `${options?.isCut ? '[Cut]' : '[Copy]'} ${count} file${count > 1 ? 's' : ''}: ${paths.map(p => p.split('/').pop()).join(', ')}`

      const entry = this.addEntry({
        type: 'files',
        content: JSON.stringify({ paths, mountId: options?.mountId, isCut: Boolean(options?.isCut) }),
        textPreview: truncatePreview(preview),
        pinned: false,
        metadata: {
          paths,
          mountId: options?.mountId,
          isCut: Boolean(options?.isCut),
          sizeBytes: paths.length
        }
      })

      // ネイティブクリップボードにはファイルパス一覧をテキストとしてコピー
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(paths.join('\n')).catch(() => {})
      }

      return entry
    },

    /**
     * ブラウザのネイティブクリップボードから内容を読み取り、TxunOSクリップボードへ同期する
     */
    async syncFromNativeClipboard(): Promise<ClipboardEntry | null> {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return null

      try {
        if (navigator.clipboard.read) {
          try {
            const items = await navigator.clipboard.read()
            for (const item of items) {
              // 画像形式のチェック
              const imageType = item.types.find(t => t.startsWith('image/'))
              if (imageType) {
                const blob = await item.getType(imageType)
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onload = () => resolve(reader.result as string)
                  reader.onerror = reject
                  reader.readAsDataURL(blob)
                })
                if (this.currentEntry?.type === 'image' && this.currentEntry.content === dataUrl) {
                  return this.currentEntry
                }
                return this.copyImage(dataUrl, { mimeType: imageType, syncNative: false })
              }

              // HTML 形式のチェック
              if (item.types.includes('text/html')) {
                const htmlBlob = await item.getType('text/html')
                const html = await htmlBlob.text()
                let text = html
                if (item.types.includes('text/plain')) {
                  const textBlob = await item.getType('text/plain')
                  text = await textBlob.text()
                }
                if (text && text.trim()) {
                  if (this.currentEntry?.content === text.trim()) {
                    return this.currentEntry
                  }
                  return this.copyText(text.trim(), { html, syncNative: false })
                }
              }

              // プレーンテキストのチェック
              if (item.types.includes('text/plain')) {
                const textBlob = await item.getType('text/plain')
                const text = await textBlob.text()
                if (text && text.trim()) {
                  if (this.currentEntry?.content === text.trim()) {
                    return this.currentEntry
                  }
                  return this.copyText(text.trim(), { syncNative: false })
                }
              }
            }
          } catch {
            // read() が非対応または拒否された場合は readText() を試行
          }
        }

        if (navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText()
          if (text && text.trim()) {
            if (this.currentEntry?.content === text.trim()) {
              return this.currentEntry
            }
            return this.copyText(text.trim(), { syncNative: false })
          }
        }
      } catch {
        // クリップボード読み取り権限がない、またはフォーカス外の場合はスキップ
      }

      return null
    },

    /**
     * ピン留め状態をトグル
     */
    togglePin(id: string): void {
      const entry = this.history.find(item => item.id === id)
      if (entry) {
        entry.pinned = !entry.pinned
        this.persistToStorage()
      }
    },

    /**
     * 指定エントリを削除
     */
    removeEntry(id: string): void {
      const idx = this.history.findIndex(item => item.id === id)
      if (idx !== -1) {
        this.history.splice(idx, 1)
        if (this.lastCopiedEntryId === id) {
          this.lastCopiedEntryId = this.history[0]?.id ?? null
        }
        this.persistToStorage()
      }
    },

    /**
     * 履歴を一括クリアする
     * @param preservePinned - true の場合はピン留めエントリを残す（デフォルト: true）
     */
    clearHistory(preservePinned = true): void {
      if (preservePinned) {
        this.history = this.history.filter(item => item.pinned)
      } else {
        this.history = []
      }
      this.lastCopiedEntryId = this.history[0]?.id ?? null
      this.persistToStorage()
    },

    /** クイック履歴ポップアップを開く */
    openQuickHistory(): void {
      this.isQuickHistoryOpen = true
    },

    /** クイック履歴ポップアップを閉じる */
    closeQuickHistory(): void {
      this.isQuickHistoryOpen = false
    },

    /** クイック履歴ポップアップのトグル */
    toggleQuickHistory(): void {
      this.isQuickHistoryOpen = !this.isQuickHistoryOpen
    },

    /** 検索クエリ設定 */
    setSearchQuery(q: string): void {
      this.searchQuery = q
    },

    /** 種別フィルター設定 */
    setActiveFilter(filter: 'all' | 'text' | 'image' | 'files'): void {
      this.activeFilter = filter
    },

    /**
     * 直前にフォーカスされていた入力要素とカーソル位置を記憶する
     */
    setLastEditableTarget(target: HTMLElement | null, selectionStart?: number, selectionEnd?: number): void {
      if (!target) {
        this.lastEditableTarget = null
        return
      }

      let start = selectionStart
      let end = selectionEnd

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (start === undefined) start = target.selectionStart ?? undefined
        if (end === undefined) end = target.selectionEnd ?? undefined
      }

      this.lastEditableTarget = {
        element: target,
        selectionStart: start,
        selectionEnd: end
      }
    },

    /**
     * 現在の document.activeElement が入力要素であれば記憶する
     */
    captureCurrentActiveElement(): void {
      if (typeof document === 'undefined') return
      const active = document.activeElement as HTMLElement | null
      if (!active) return

      // クリップボードUIやコンテキストメニュー内部の要素は無視
      if (active.closest('.clipboard-history-panel, .editable-context-menu-container')) return

      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable || active.hasAttribute('data-txun-editable')) {
        this.setLastEditableTarget(active)
      }
    }
  }
})
