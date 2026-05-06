/** IndexedDB データベース名 */
const DB_NAME = 'txunos'
/** IndexedDB データベースバージョン */
const DB_VERSION = 1
/** IndexedDB オブジェクトストア名 */
const STORE_NAME = 'desktop'

/**
 * IndexedDB を開き、ビルトインストアがなければ作成するプライベート関数。
 * @returns 接続した IDBDatabase
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * IndexedDB を介したデスクトップ状態永続化コンポーザブル。
 * `saveState` / `loadState` / `deleteState` を提供する。
 */
export function useDesktopStorage() {
  /**
   * デスクトップ状態を IndexedDB に保存する。
   * @param key - 保存キー
   * @param value - 保存する値
   */
  async function saveState(key: string, value: unknown): Promise<void> {
    const db = await openDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ key, value })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * IndexedDB からデスクトップ状態を読み込む。
   * @param key - 読み込むキー
   * @returns 保存された値、なければ null
   */
  async function loadState<T>(key: string): Promise<T | null> {
    const db = await openDB()
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => {
        const record = req.result as { key: string, value: T } | undefined
        resolve(record?.value ?? null)
      }
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * IndexedDB から指定キーの状態を削除する。
   * @param key - 削除するキー
   */
  async function deleteState(key: string): Promise<void> {
    const db = await openDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  return { saveState, loadState, deleteState }
}
