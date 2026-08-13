import type {
  FileSystemEntry,
  FileSystemMount,
  FileSystemPermissionState
} from '../stores/filesystem'

/**
 * TxunOS の File System API を利用するためのコンポーザブル。
 * store への直接依存を隠蔽し、アプリ層へ共通 API を提供する。
 */
export function useFileSystem() {
  const store = useFileSystemStore()

  /**
   * マウント情報を復元する。
   */
  async function restoreMounts(): Promise<void> {
    await store.restoreMounts()
  }

  /**
   * 作業ディレクトリを追加する。
   * @returns 追加または再選択されたマウント
   */
  async function addMount(): Promise<FileSystemMount | null> {
    return await store.addMount()
  }

  /**
   * マウントを削除する。
   * @param mountId - 削除対象 ID
   */
  async function removeMount(mountId: string): Promise<void> {
    await store.removeMount(mountId)
  }

  /**
   * アクティブマウントを切り替える。
   * @param mountId - 切り替え先 ID
   */
  async function setActiveMount(mountId: string | null): Promise<void> {
    await store.setActiveMount(mountId)
  }

  /**
   * マウント権限を更新する。
   * @param mountId - 対象マウント ID
   * @returns 更新後の権限状態
   */
  async function refreshPermission(mountId: string): Promise<FileSystemPermissionState> {
    return await store.requestMountPermission(mountId)
  }

  /**
   * ディレクトリ一覧を取得する。
   * @param path - 対象パス
   * @param mountId - 対象マウント ID
   * @returns エントリー一覧
   */
  async function listDirectory(path = '/', mountId?: string): Promise<FileSystemEntry[]> {
    return await store.listDirectory(path, mountId)
  }

  /**
   * テキストファイルを読み込む。
   * @param path - 対象パス
   * @param mountId - 対象マウント ID
   * @returns テキスト内容
   */
  async function readTextFile(path: string, mountId?: string): Promise<string> {
    return await store.readTextFile(path, mountId)
  }

  /**
   * ファイルを Blob として読み込む。
   * @param path - 対象パス
   * @param mountId - 対象マウント ID
   * @returns Blob
   */
  async function readFileBlob(path: string, mountId?: string): Promise<Blob> {
    return await store.readFileBlob(path, mountId)
  }

  /**
   * テキストファイルを書き込む。
   * @param path - 対象パス
   * @param content - 書き込み内容
   * @param mountId - 対象マウント ID
   */
  async function writeTextFile(path: string, content: string, mountId?: string): Promise<void> {
    await store.writeTextFile(path, content, mountId)
  }

  /**
   * ディレクトリを作成する。
   * @param path - 作成先パス
   * @param mountId - 対象マウント ID
   * @param recursive - 再帰作成フラグ
   */
  async function mkdir(path: string, mountId?: string, recursive = true): Promise<void> {
    await store.mkdir(path, mountId, recursive)
  }

  /**
   * 空ファイルを作成する。
   * @param path - 作成先パス
   * @param mountId - 対象マウント ID
   */
  async function touch(path: string, mountId?: string): Promise<void> {
    await store.touch(path, mountId)
  }

  /**
   * エントリーを削除する。
   * @param path - 削除対象パス
   * @param mountId - 対象マウント ID
   * @param recursive - 再帰削除フラグ
   */
  async function deleteEntry(path: string, mountId?: string, recursive = false): Promise<void> {
    await store.deleteEntry(path, mountId, recursive)
  }

  /**
   * エントリーをコピーする。
   * @param fromPath - コピー元
   * @param toPath - コピー先
   * @param mountId - 対象マウント ID
   */
  async function copy(fromPath: string, toPath: string, mountId?: string): Promise<void> {
    await store.copy(fromPath, toPath, mountId)
  }

  /**
   * エントリーを移動する。
   * @param fromPath - 移動元
   * @param toPath - 移動先
   * @param mountId - 対象マウント ID
   */
  async function move(fromPath: string, toPath: string, mountId?: string): Promise<void> {
    await store.move(fromPath, toPath, mountId)
  }

  /**
   * エントリー名を変更する。
   * @param path - 変更対象パス
   * @param newName - 新しい名前
   * @param mountId - 対象マウント ID
   */
  async function rename(path: string, newName: string, mountId?: string): Promise<void> {
    await store.rename(path, newName, mountId)
  }

  /**
   * パスの存在を確認する。
   * @param path - 対象パス
   * @param mountId - 対象マウント ID
   * @returns 存在すれば true
   */
  async function exists(path: string, mountId?: string): Promise<boolean> {
    return await store.exists(path, mountId)
  }

  /**
   * 現在ディレクトリから相対パスを解決する。
   * @param cwd - 現在ディレクトリ
   * @param target - 解決対象
   * @returns 解決済み絶対パス
   */
  function resolvePath(cwd: string, target: string): string {
    return store.resolvePath(cwd, target)
  }

  return {
    mounts: computed(() => store.mounts),
    activeMountId: computed(() => store.activeMountId),
    activeMount: computed(() => store.activeMount),
    isSupported: computed(() => store.isSupported),
    isRequesting: computed(() => store.isRequesting),
    lastError: computed(() => store.lastError),
    restoreMounts,
    addMount,
    removeMount,
    setActiveMount,
    refreshPermission,
    listDirectory,
    readTextFile,
    readFileBlob,
    writeTextFile,
    mkdir,
    touch,
    deleteEntry,
    copy,
    move,
    rename,
    exists,
    resolvePath
  }
}
