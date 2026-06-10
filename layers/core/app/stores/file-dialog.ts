import { defineStore } from 'pinia'

export interface FileDialogOptions {
  title?: string
  mode?: 'open-file' | 'open-directory' | 'save-file'
  filters?: string[]
  multiple?: boolean
  initialPath?: string
}

export interface FileDialogResult {
  path: string
  mountId: string
}

export const useFileDialogStore = defineStore('file-dialog', {
  state: () => ({
    isOpen: false,
    title: '',
    mode: 'open-file' as 'open-file' | 'open-directory' | 'save-file',
    filters: [] as string[],
    multiple: false,
    cwd: '/',
    selectedPaths: [] as string[],
    fileNameInput: '',
    resolve: null as ((value: FileDialogResult | FileDialogResult[] | null) => void) | null,
    reject: null as ((reason?: unknown) => void) | null
  }),
  actions: {
    open(options: FileDialogOptions = {}): Promise<FileDialogResult | FileDialogResult[] | null> {
      this.title = options.title || ''
      this.mode = options.mode || 'open-file'
      this.filters = options.filters || []
      this.multiple = options.multiple || false
      this.cwd = options.initialPath || '/'
      this.selectedPaths = []
      this.fileNameInput = ''
      this.isOpen = true

      return new Promise<FileDialogResult | FileDialogResult[] | null>((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    confirm(mountId: string) {
      if (!this.resolve) return

      if (this.mode === 'save-file') {
        if (!this.fileNameInput.trim()) return
        const cleanName = this.fileNameInput.trim()
        const resolvedPath = this.cwd === '/' ? `/${cleanName}` : `${this.cwd}/${cleanName}`
        this.resolve({
          path: resolvedPath,
          mountId
        })
      } else if (this.mode === 'open-directory') {
        this.resolve({
          path: this.cwd,
          mountId
        })
      } else {
        // open-file
        if (this.selectedPaths.length === 0) return
        if (this.multiple) {
          this.resolve(
            this.selectedPaths.map(p => ({
              path: p,
              mountId
            }))
          )
        } else {
          this.resolve({
            path: this.selectedPaths[0]!,
            mountId
          })
        }
      }
      this.close()
    },
    cancel() {
      if (this.resolve) {
        this.resolve(null)
      }
      this.close()
    },
    close() {
      this.isOpen = false
      this.resolve = null
      this.reject = null
    }
  }
})
