import { useDesktopStore } from '../stores/desktop'
import type { LauncherFolder } from '../stores/desktop'

/** IndexedDB の永続化キー */
const STORAGE_KEY = 'launcher-folders'

/**
 * アプリランチャーの開閉状態と検索クエリをシングルトンで管理するコンポーザブル。
 * `launcherFolders` の IndexedDB 永続化も担当する。
 * `DesktopShell` でのみ `initLauncher()` を呼び出すこと。
 */
export function useLauncher() {
  const store = useDesktopStore()
  const { saveState, loadState } = useDesktopStorage()

  /** ランチャーの表示状態（シングルトン） */
  const isOpen = useState<boolean>('launcher-open', () => false)
  /** 検索クエリ（シングルトン） */
  const searchQuery = useState<string>('launcher-search', () => '')

  /** ランチャーを開く */
  function openLauncher(): void {
    isOpen.value = true
  }

  /** ランチャーを閉じる（検索クエリもリセット） */
  function closeLauncher(): void {
    isOpen.value = false
    searchQuery.value = ''
  }

  /** ランチャーの開閉をトグルする */
  function toggleLauncher(): void {
    if (isOpen.value) {
      closeLauncher()
    } else {
      openLauncher()
    }
  }

  /**
   * フォルダーデータを IndexedDB からロードしてストアに反映する。
   * `DesktopShell` の `onMounted` から呼び出す。
   */
  async function initLauncher(): Promise<void> {
    const saved = await loadState<LauncherFolder[]>(STORAGE_KEY)
    if (saved) {
      store.launcherFolders.splice(0, store.launcherFolders.length, ...saved)
    }
    watch(
      () => store.launcherFolders,
      (folders) => {
        saveState(STORAGE_KEY, JSON.parse(JSON.stringify(folders)))
      },
      { deep: true }
    )
  }

  return {
    isOpen,
    searchQuery,
    openLauncher,
    closeLauncher,
    toggleLauncher,
    initLauncher
  }
}
