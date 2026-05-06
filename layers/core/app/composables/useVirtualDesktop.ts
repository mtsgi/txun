import { useDesktopStore } from '../stores/desktop'

/**
 * 仮想デスクトップ操作のコンポーザブル。
 * Pinia ストアの仮想デスクトップ関連アクションのラッパー。
 */
export function useVirtualDesktop() {
  const store = useDesktopStore()

  /** 新しい仮想デスクトップを追加する。 */
  function addDesktop(): void {
    store.addVirtualDesktop()
  }

  /**
   * 指定 ID の仮想デスクトップを削除する。
   * @param id - 削除する仮想デスクトップの ID
   */
  function removeDesktop(id: string): void {
    store.removeVirtualDesktop(id)
  }

  /**
   * 指定 ID の仮想デスクトップに切り替える。
   * @param id - 切り替え先の仮想デスクトップの ID
   */
  function switchDesktop(id: string): void {
    store.switchVirtualDesktop(id)
  }

  return {
    desktops: computed(() => store.virtualDesktops),
    activeId: computed(() => store.activeVirtualDesktopId),
    addDesktop,
    removeDesktop,
    switchDesktop
  }
}
