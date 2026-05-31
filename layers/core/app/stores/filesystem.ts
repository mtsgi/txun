import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import {
  basenameFsPath,
  dirnameFsPath,
  normalizeFsPath,
  resolveFsPath,
  splitFsPath,
  toRelativeFsPath
} from '../utils/filesystem-path'

/** ファイルシステム権限状態 */
export type FileSystemPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

/** ファイルシステムエラーコード */
export type FileSystemErrorCode
  = | 'UNSUPPORTED'
    | 'NO_MOUNT'
    | 'INVALID_PATH'
    | 'NOT_FOUND'
    | 'NOT_DIRECTORY'
    | 'NOT_FILE'
    | 'PERMISSION_DENIED'
    | 'ALREADY_EXISTS'
    | 'UNKNOWN'

/** ファイルシステムマウント情報 */
export interface FileSystemMount {
  /** マウント識別子 */
  id: string
  /** マウント表示名 */
  name: string
  /** マウント権限状態 */
  permission: FileSystemPermissionState
  /** 作成時刻 (epoch ms) */
  createdAt: number
  /** 更新時刻 (epoch ms) */
  updatedAt: number
}

/** ファイルまたはディレクトリエントリー情報 */
export interface FileSystemEntry {
  /** エントリー名 */
  name: string
  /** ルート基準の絶対パス */
  path: string
  /** エントリー種別 */
  kind: 'file' | 'directory'
  /** ファイルサイズ（ファイル時のみ） */
  size?: number
  /** 最終更新時刻（ファイル時のみ） */
  lastModified?: number
}

/** ファイルシステムストアの状態 */
export interface FileSystemState {
  /** 登録済みマウント情報 */
  mounts: FileSystemMount[]
  /** 現在選択中マウント ID */
  activeMountId: string | null
  /** ディレクトリ選択ダイアログ表示中フラグ */
  isRequesting: boolean
  /** 直近エラーメッセージ */
  lastError: string | null
  /** 復元済みフラグ */
  isRestored: boolean
}

/** File System API 操作時のエラー型 */
export class DesktopFileSystemError extends Error {
  /** エラーコード */
  code: FileSystemErrorCode
  /** 関連パス */
  path?: string

  /**
   * @param code - エラーコード
   * @param message - エラーメッセージ
   * @param path - 関連パス
   */
  constructor(code: FileSystemErrorCode, message: string, path?: string) {
    super(message)
    this.name = 'DesktopFileSystemError'
    this.code = code
    this.path = path
  }
}

/** File System API 権限要求オプション */
interface WebFsPermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

/** FileSystemHandle 互換インターフェース */
interface WebFsHandle {
  kind: 'file' | 'directory'
  name: string
  isSameEntry(other: WebFsHandle): Promise<boolean>
  queryPermission?(descriptor?: WebFsPermissionDescriptor): Promise<FileSystemPermissionState>
  requestPermission?(descriptor?: WebFsPermissionDescriptor): Promise<FileSystemPermissionState>
}

/** FileSystemWritableFileStream 互換インターフェース */
interface WebFsWritableFileStream {
  write(data: Blob | string | ArrayBuffer | Uint8Array): Promise<void>
  close(): Promise<void>
}

/** FileSystemFileHandle 互換インターフェース */
interface WebFsFileHandle extends WebFsHandle {
  kind: 'file'
  getFile(): Promise<File>
  createWritable(): Promise<WebFsWritableFileStream>
}

/** FileSystemDirectoryHandle 互換インターフェース */
interface WebFsDirectoryHandle extends WebFsHandle {
  kind: 'directory'
  entries(): AsyncIterableIterator<[string, WebFsHandle]>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WebFsDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WebFsFileHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}

/** showDirectoryPicker 拡張を持つ Window 型 */
interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<WebFsDirectoryHandle>
}

/** IndexedDB に保存するマウントレコード */
interface FileSystemMountRecord {
  id: string
  name: string
  handle: WebFsDirectoryHandle
  createdAt: number
  updatedAt: number
}

/** IndexedDB に保存する状態レコード */
interface FileSystemStateRecord {
  key: string
  value: string | null
}

const FS_DB_NAME = 'txunos-filesystem'
const FS_DB_VERSION = 1
const FS_MOUNT_STORE = 'mounts'
const FS_STATE_STORE = 'state'
const ACTIVE_MOUNT_KEY = 'activeMountId'

function canUseFileSystemAccess(): boolean {
  return import.meta.client && typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

function canUseIndexedDb(): boolean {
  return import.meta.client && typeof indexedDB !== 'undefined'
}

function isDomException(error: unknown): error is DOMException {
  return error instanceof DOMException
}

function mapError(error: unknown, path?: string): DesktopFileSystemError {
  if (error instanceof DesktopFileSystemError) return error

  if (isDomException(error)) {
    if (error.name === 'NotFoundError') {
      return new DesktopFileSystemError('NOT_FOUND', error.message, path)
    }
    if (error.name === 'TypeMismatchError') {
      return new DesktopFileSystemError('INVALID_PATH', error.message, path)
    }
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return new DesktopFileSystemError('PERMISSION_DENIED', error.message, path)
    }
    if (error.name === 'InvalidModificationError') {
      return new DesktopFileSystemError('ALREADY_EXISTS', error.message, path)
    }
  }

  if (error instanceof Error) {
    return new DesktopFileSystemError('UNKNOWN', error.message, path)
  }

  return new DesktopFileSystemError('UNKNOWN', 'Unknown filesystem error', path)
}

function assertValidEntryName(name: string): void {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new DesktopFileSystemError('INVALID_PATH', 'Invalid entry name', name)
  }
}

async function queryHandlePermission(handle: WebFsHandle): Promise<FileSystemPermissionState> {
  if (!handle.queryPermission) return 'unknown'
  const state = await handle.queryPermission({ mode: 'readwrite' })
  return state ?? 'unknown'
}

async function requestHandlePermission(handle: WebFsHandle): Promise<FileSystemPermissionState> {
  if (!handle.requestPermission) return 'unknown'
  const state = await handle.requestPermission({ mode: 'readwrite' })
  return state ?? 'unknown'
}

async function openFsDatabase(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return null

  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, FS_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FS_MOUNT_STORE)) {
        db.createObjectStore(FS_MOUNT_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FS_STATE_STORE)) {
        db.createObjectStore(FS_STATE_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadMountRecords(): Promise<FileSystemMountRecord[]> {
  const db = await openFsDatabase()
  if (!db) return []

  return new Promise<FileSystemMountRecord[]>((resolve, reject) => {
    const tx = db.transaction(FS_MOUNT_STORE, 'readonly')
    const req = tx.objectStore(FS_MOUNT_STORE).getAll()
    req.onsuccess = () => {
      const records = req.result as FileSystemMountRecord[]
      resolve(records)
    }
    req.onerror = () => reject(req.error)
  })
}

async function saveMountRecord(record: FileSystemMountRecord): Promise<void> {
  const db = await openFsDatabase()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FS_MOUNT_STORE, 'readwrite')
    tx.objectStore(FS_MOUNT_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function deleteMountRecord(id: string): Promise<void> {
  const db = await openFsDatabase()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FS_MOUNT_STORE, 'readwrite')
    tx.objectStore(FS_MOUNT_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function saveActiveMountId(value: string | null): Promise<void> {
  const db = await openFsDatabase()
  if (!db) return

  const record: FileSystemStateRecord = { key: ACTIVE_MOUNT_KEY, value }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FS_STATE_STORE, 'readwrite')
    tx.objectStore(FS_STATE_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadActiveMountId(): Promise<string | null> {
  const db = await openFsDatabase()
  if (!db) return null

  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(FS_STATE_STORE, 'readonly')
    const req = tx.objectStore(FS_STATE_STORE).get(ACTIVE_MOUNT_KEY)
    req.onsuccess = () => {
      const record = req.result as FileSystemStateRecord | undefined
      resolve(record?.value ?? null)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * FileSystemAccess API を利用した OS レベルファイルシステムストア。
 * マウント管理・永続化・ファイル操作を一元管理する。
 */
export const useFileSystemStore = defineStore('filesystem', {
  state: (): FileSystemState & {
    /** マウント ID -> ディレクトリハンドル（非リアクティブ） */
    _mountHandles: Map<string, WebFsDirectoryHandle>
  } => ({
    mounts: [],
    activeMountId: null,
    isRequesting: false,
    lastError: null,
    isRestored: false,
    _mountHandles: markRaw(new Map<string, WebFsDirectoryHandle>())
  }),

  getters: {
    /** File System Access API が利用可能かどうか */
    isSupported: (): boolean => canUseFileSystemAccess(),

    /** 現在アクティブなマウント情報 */
    activeMount(state): FileSystemMount | null {
      if (!state.activeMountId) return null
      return state.mounts.find(m => m.id === state.activeMountId) ?? null
    }
  },

  actions: {
    /**
     * マウント状態を IndexedDB から復元する。
     */
    async restoreMounts(): Promise<void> {
      if (this.isRestored) return
      this.isRestored = true

      if (!canUseFileSystemAccess()) return

      try {
        const records = await loadMountRecords()
        this.mounts.splice(0, this.mounts.length)
        this._mountHandles.clear()

        for (const record of records) {
          this.mounts.push({
            id: record.id,
            name: record.name,
            permission: 'unknown',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
          })
          this._mountHandles.set(record.id, record.handle)
        }

        const restoredActiveId = await loadActiveMountId()
        if (restoredActiveId && this.mounts.some(m => m.id === restoredActiveId)) {
          this.activeMountId = restoredActiveId
        } else {
          this.activeMountId = this.mounts[0]?.id ?? null
        }

        await this.refreshMountPermissions()
      } catch (error) {
        const fsError = mapError(error)
        this.lastError = fsError.message
      }
    },

    /**
     * マウント済みディレクトリの権限状態を再評価する。
     */
    async refreshMountPermissions(): Promise<void> {
      for (const mount of this.mounts) {
        const handle = this._mountHandles.get(mount.id)
        if (!handle) continue
        try {
          mount.permission = await queryHandlePermission(handle)
        } catch {
          mount.permission = 'unknown'
        }
      }
    },

    /**
     * 指定マウントへ権限を明示要求する。
     * @param mountId - 対象マウント ID
     * @returns 更新後の権限状態
     */
    async requestMountPermission(mountId: string): Promise<FileSystemPermissionState> {
      const handle = this._mountHandles.get(mountId)
      if (!handle) {
        throw new DesktopFileSystemError('NO_MOUNT', 'Mount handle is missing')
      }

      const permission = await requestHandlePermission(handle)
      const mount = this.mounts.find(m => m.id === mountId)
      if (mount) mount.permission = permission
      return permission
    },

    /**
     * 作業ディレクトリを新規マウントとして追加する。
     * @returns 追加済みまたは選択済みのマウント。キャンセル時は null。
     */
    async addMount(): Promise<FileSystemMount | null> {
      if (!canUseFileSystemAccess()) {
        throw new DesktopFileSystemError('UNSUPPORTED', 'File System Access API is not supported')
      }

      this.isRequesting = true
      this.lastError = null

      try {
        const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker
        if (!picker) {
          throw new DesktopFileSystemError('UNSUPPORTED', 'showDirectoryPicker is unavailable')
        }

        const handle = await picker({ mode: 'readwrite' })

        for (const [mountId, mountedHandle] of this._mountHandles.entries()) {
          try {
            if (await mountedHandle.isSameEntry(handle)) {
              this.activeMountId = mountId
              await saveActiveMountId(this.activeMountId)
              return this.mounts.find(m => m.id === mountId) ?? null
            }
          } catch {
            // 既存ハンドル比較に失敗しても処理継続
          }
        }

        const now = Date.now()
        const mount: FileSystemMount = {
          id: crypto.randomUUID(),
          name: handle.name,
          permission: await queryHandlePermission(handle),
          createdAt: now,
          updatedAt: now
        }

        this.mounts.push(mount)
        this._mountHandles.set(mount.id, handle)
        this.activeMountId = mount.id

        await saveMountRecord({
          id: mount.id,
          name: mount.name,
          handle,
          createdAt: mount.createdAt,
          updatedAt: mount.updatedAt
        })
        await saveActiveMountId(this.activeMountId)

        return mount
      } catch (error) {
        if (isDomException(error) && error.name === 'AbortError') {
          return null
        }
        const fsError = mapError(error)
        this.lastError = fsError.message
        throw fsError
      } finally {
        this.isRequesting = false
      }
    },

    /**
     * 指定マウントを削除する。
     * @param mountId - 削除対象マウント ID
     */
    async removeMount(mountId: string): Promise<void> {
      this.mounts = this.mounts.filter(m => m.id !== mountId)
      this._mountHandles.delete(mountId)
      await deleteMountRecord(mountId)

      if (this.activeMountId === mountId) {
        this.activeMountId = this.mounts[0]?.id ?? null
      }
      await saveActiveMountId(this.activeMountId)
    },

    /**
     * アクティブマウントを切り替える。
     * @param mountId - 切り替え先マウント ID
     */
    async setActiveMount(mountId: string | null): Promise<void> {
      if (mountId && !this.mounts.some(m => m.id === mountId)) {
        throw new DesktopFileSystemError('NO_MOUNT', 'Mount is not registered')
      }
      this.activeMountId = mountId
      await saveActiveMountId(this.activeMountId)
    },

    /**
     * 現在ディレクトリ基準でパスを解決する。
     * @param cwd - 現在ディレクトリ
     * @param target - 解決対象
     * @returns 正規化済み絶対パス
     */
    resolvePath(cwd: string, target: string): string {
      return resolveFsPath(cwd, target)
    },

    /**
     * 指定マウントのディレクトリ内容を一覧取得する。
     * @param path - ルート基準の絶対パス
     * @param mountId - 操作対象マウント ID（省略時は active）
     * @returns ディレクトリエントリー配列
     */
    async listDirectory(path = '/', mountId?: string): Promise<FileSystemEntry[]> {
      const normalizedPath = normalizeFsPath(path)
      try {
        const directory = await this.getDirectoryHandle(normalizedPath, mountId)
        const entries: FileSystemEntry[] = []

        for await (const [name, handle] of directory.entries()) {
          const entryPath = resolveFsPath(normalizedPath, name)
          if (handle.kind === 'directory') {
            entries.push({ name, path: entryPath, kind: 'directory' })
            continue
          }

          const fileHandle = handle as WebFsFileHandle
          const file = await fileHandle.getFile()
          entries.push({
            name,
            path: entryPath,
            kind: 'file',
            size: file.size,
            lastModified: file.lastModified
          })
        }

        entries.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })

        return entries
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * テキストファイルを読み込む。
     * @param path - 読み込むファイルパス
     * @param mountId - 操作対象マウント ID
     * @returns ファイル内容
     */
    async readTextFile(path: string, mountId?: string): Promise<string> {
      const normalizedPath = normalizeFsPath(path)
      try {
        const handle = await this.getFileHandle(normalizedPath, mountId)
        const file = await handle.getFile()
        return await file.text()
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * ファイルを Blob として読み込む。
     * @param path - 読み込むファイルパス
     * @param mountId - 操作対象マウント ID
     * @returns ファイル Blob
     */
    async readFileBlob(path: string, mountId?: string): Promise<Blob> {
      const normalizedPath = normalizeFsPath(path)
      try {
        const handle = await this.getFileHandle(normalizedPath, mountId)
        const file = await handle.getFile()
        return file
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * テキストファイルへ内容を書き込む。
     * @param path - 書き込み先ファイルパス
     * @param content - 書き込む内容
     * @param mountId - 操作対象マウント ID
     */
    async writeTextFile(path: string, content: string, mountId?: string): Promise<void> {
      const normalizedPath = normalizeFsPath(path)
      try {
        const handle = await this.getFileHandle(normalizedPath, mountId, true)
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * ディレクトリを作成する。
     * @param path - 作成先ディレクトリパス
     * @param mountId - 操作対象マウント ID
     * @param recursive - 親ディレクトリを再帰作成するかどうか
     */
    async mkdir(path: string, mountId?: string, recursive = true): Promise<void> {
      const normalizedPath = normalizeFsPath(path)
      if (normalizedPath === '/') return

      try {
        const mountHandle = await this.getMountHandle(mountId)
        const segments = splitFsPath(normalizedPath)

        if (segments.length === 0) return

        if (!recursive) {
          const parentPath = dirnameFsPath(normalizedPath)
          const name = basenameFsPath(normalizedPath)
          assertValidEntryName(name)
          const parent = await this.getDirectoryHandle(parentPath, mountId)
          await parent.getDirectoryHandle(name, { create: true })
          return
        }

        let current = mountHandle
        for (const segment of segments) {
          current = await current.getDirectoryHandle(segment, { create: true })
        }
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * 空ファイルを作成する。
     * @param path - 作成先ファイルパス
     * @param mountId - 操作対象マウント ID
     */
    async touch(path: string, mountId?: string): Promise<void> {
      const normalizedPath = normalizeFsPath(path)
      try {
        const fileHandle = await this.getFileHandle(normalizedPath, mountId, true)
        const writable = await fileHandle.createWritable()
        await writable.close()
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * ファイルまたはディレクトリを削除する。
     * @param path - 削除対象パス
     * @param mountId - 操作対象マウント ID
     * @param recursive - ディレクトリ再帰削除フラグ
     */
    async deleteEntry(path: string, mountId?: string, recursive = false): Promise<void> {
      const normalizedPath = normalizeFsPath(path)
      if (normalizedPath === '/') {
        throw new DesktopFileSystemError('INVALID_PATH', 'Root directory cannot be removed', normalizedPath)
      }

      try {
        const parentPath = dirnameFsPath(normalizedPath)
        const name = basenameFsPath(normalizedPath)
        assertValidEntryName(name)
        const parent = await this.getDirectoryHandle(parentPath, mountId)
        await parent.removeEntry(name, { recursive })
      } catch (error) {
        throw mapError(error, normalizedPath)
      }
    },

    /**
     * パスが存在するかどうかを返す。
     * @param path - 対象パス
     * @param mountId - 操作対象マウント ID
     * @returns 存在する場合 true
     */
    async exists(path: string, mountId?: string): Promise<boolean> {
      const normalizedPath = normalizeFsPath(path)
      if (normalizedPath === '/') return true

      try {
        await this.getDirectoryHandle(normalizedPath, mountId)
        return true
      } catch (error) {
        const mapped = mapError(error, normalizedPath)
        if (mapped.code !== 'NOT_FOUND') return false
      }

      try {
        await this.getFileHandle(normalizedPath, mountId)
        return true
      } catch {
        return false
      }
    },

    /**
     * ファイルまたはディレクトリをコピーする。
     * @param fromPath - コピー元パス
     * @param toPath - コピー先パス
     * @param mountId - 操作対象マウント ID
     */
    async copy(fromPath: string, toPath: string, mountId?: string): Promise<void> {
      const srcPath = normalizeFsPath(fromPath)
      const dstPath = normalizeFsPath(toPath)
      if (srcPath === '/' || dstPath === '/') {
        throw new DesktopFileSystemError('INVALID_PATH', 'Root path cannot be copied', srcPath)
      }

      try {
        const sourceEntry = await this.getEntryHandle(srcPath, mountId)
        if (srcPath === dstPath || (sourceEntry.kind === 'directory' && dstPath.startsWith(`${srcPath}/`))) {
          throw new DesktopFileSystemError('INVALID_PATH', 'Cannot copy entry into itself', dstPath)
        }

        const dstParentPath = dirnameFsPath(dstPath)
        const dstName = basenameFsPath(dstPath)
        assertValidEntryName(dstName)
        const dstParent = await this.getDirectoryHandle(dstParentPath, mountId, true)

        await this.copyEntryHandle(sourceEntry, dstParent, dstName)
      } catch (error) {
        throw mapError(error, srcPath)
      }
    },

    /**
     * ファイルまたはディレクトリを移動する。
     * @param fromPath - 移動元パス
     * @param toPath - 移動先パス
     * @param mountId - 操作対象マウント ID
     */
    async move(fromPath: string, toPath: string, mountId?: string): Promise<void> {
      const srcPath = normalizeFsPath(fromPath)
      const dstPath = normalizeFsPath(toPath)
      await this.copy(srcPath, dstPath, mountId)
      await this.deleteEntry(srcPath, mountId, true)
    },

    /**
     * エントリー名を変更する。
     * @param path - 変更対象パス
     * @param newName - 新しい名前
     * @param mountId - 操作対象マウント ID
     */
    async rename(path: string, newName: string, mountId?: string): Promise<void> {
      assertValidEntryName(newName)
      const normalizedPath = normalizeFsPath(path)
      const destination = resolveFsPath(dirnameFsPath(normalizedPath), newName)
      await this.move(normalizedPath, destination, mountId)
    },

    /**
     * 指定パスのディレクトリハンドルを取得する。
     * @param path - 対象ディレクトリパス
     * @param mountId - 操作対象マウント ID
     * @param create - 不足階層を作成するかどうか
     * @returns ディレクトリハンドル
     */
    async getDirectoryHandle(path: string, mountId?: string, create = false): Promise<WebFsDirectoryHandle> {
      const normalizedPath = normalizeFsPath(path)
      const rootHandle = await this.getMountHandle(mountId)
      if (normalizedPath === '/') return rootHandle

      let current = rootHandle
      for (const segment of splitFsPath(normalizedPath)) {
        current = await current.getDirectoryHandle(segment, { create })
      }
      return current
    },

    /**
     * 指定パスのファイルハンドルを取得する。
     * @param path - 対象ファイルパス
     * @param mountId - 操作対象マウント ID
     * @param create - ファイルが無い場合に作成するかどうか
     * @returns ファイルハンドル
     */
    async getFileHandle(path: string, mountId?: string, create = false): Promise<WebFsFileHandle> {
      const normalizedPath = normalizeFsPath(path)
      if (normalizedPath === '/') {
        throw new DesktopFileSystemError('INVALID_PATH', 'Root path is not a file', normalizedPath)
      }

      const parentPath = dirnameFsPath(normalizedPath)
      const name = basenameFsPath(normalizedPath)
      assertValidEntryName(name)

      const parent = await this.getDirectoryHandle(parentPath, mountId, create)
      return await parent.getFileHandle(name, { create })
    },

    /**
     * 指定パスのエントリーハンドル（ファイルまたはディレクトリ）を取得する。
     * @param path - 対象パス
     * @param mountId - 操作対象マウント ID
     * @returns エントリーハンドル
     */
    async getEntryHandle(path: string, mountId?: string): Promise<WebFsHandle> {
      const normalizedPath = normalizeFsPath(path)
      if (normalizedPath === '/') {
        return await this.getMountHandle(mountId)
      }

      const parentPath = dirnameFsPath(normalizedPath)
      const name = basenameFsPath(normalizedPath)
      const parent = await this.getDirectoryHandle(parentPath, mountId)

      try {
        return await parent.getFileHandle(name)
      } catch {
        return await parent.getDirectoryHandle(name)
      }
    },

    /**
     * エントリーハンドルを別ディレクトリへ複製する。
     * @param sourceHandle - コピー元ハンドル
     * @param targetParent - コピー先親ディレクトリハンドル
     * @param targetName - コピー先名
     */
    async copyEntryHandle(
      sourceHandle: WebFsHandle,
      targetParent: WebFsDirectoryHandle,
      targetName: string
    ): Promise<void> {
      if (sourceHandle.kind === 'file') {
        const sourceFileHandle = sourceHandle as WebFsFileHandle
        const sourceFile = await sourceFileHandle.getFile()
        const targetFileHandle = await targetParent.getFileHandle(targetName, { create: true })
        const writable = await targetFileHandle.createWritable()
        await writable.write(await sourceFile.arrayBuffer())
        await writable.close()
        return
      }

      const sourceDirectoryHandle = sourceHandle as WebFsDirectoryHandle
      const targetDirectoryHandle = await targetParent.getDirectoryHandle(targetName, { create: true })
      for await (const [childName, childHandle] of sourceDirectoryHandle.entries()) {
        await this.copyEntryHandle(childHandle, targetDirectoryHandle, childName)
      }
    },

    /**
     * マウントハンドルを取得する。
     * @param mountId - 操作対象マウント ID（省略時は active）
     * @returns ディレクトリハンドル
     */
    async getMountHandle(mountId?: string): Promise<WebFsDirectoryHandle> {
      const targetMountId = mountId ?? this.activeMountId
      if (!targetMountId) {
        throw new DesktopFileSystemError('NO_MOUNT', 'No mount is selected')
      }

      const handle = this._mountHandles.get(targetMountId)
      if (!handle) {
        throw new DesktopFileSystemError('NO_MOUNT', 'Mount handle was not found')
      }

      const permission = await queryHandlePermission(handle)
      const mount = this.mounts.find(m => m.id === targetMountId)
      if (mount) mount.permission = permission

      if (permission === 'prompt') {
        const requested = await requestHandlePermission(handle)
        if (mount) mount.permission = requested
        if (requested !== 'granted') {
          throw new DesktopFileSystemError('PERMISSION_DENIED', 'Permission was not granted')
        }
      } else if (permission === 'denied') {
        throw new DesktopFileSystemError('PERMISSION_DENIED', 'Permission is denied')
      }

      return handle
    },

    /**
     * ルート基準パスを相対パスへ変換する。
     * @param path - 絶対パス
     * @returns 先頭 `/` を除いた相対パス
     */
    toRelativePath(path: string): string {
      return toRelativeFsPath(path)
    }
  }
})
