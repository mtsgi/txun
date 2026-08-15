import { useDesktopStore } from '../stores/desktop'

/** Overview（Mission Control）画面の開閉状態（モジュールスコープで共有） */
const isOverviewOpen = ref(false)

/**
 * 仮想デスクトップ操作のコンポーザブル。
 * Pinia ストアの仮想デスクトップ関連アクションおよび Overview 画面の開閉制御を提供する。
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

  /**
   * 指定 ID の仮想デスクトップの名前を変更する。
   * @param id - デスクトップ ID
   * @param name - 新しい表示名
   */
  function renameDesktop(id: string, name: string): void {
    store.renameVirtualDesktop(id, name)
  }

  /**
   * 指定ウィンドウを別の仮想デスクトップに移動する。
   * @param windowId - ウィンドウ ID
   * @param targetDesktopId - 移動先の仮想デスクトップ ID
   */
  function moveWindowToDesktop(windowId: string, targetDesktopId: string): void {
    store.moveWindowToDesktop(windowId, targetDesktopId)
  }

  /** 次の仮想デスクトップに切り替える。 */
  function nextDesktop(): void {
    store.switchToNextDesktop()
  }

  /** 前の仮想デスクトップに切り替える。 */
  function prevDesktop(): void {
    store.switchToPrevDesktop()
  }

  /** Overview 画面を開く。 */
  function openOverview(): void {
    isOverviewOpen.value = true
  }

  /** Overview 画面を閉じる。 */
  function closeOverview(): void {
    isOverviewOpen.value = false
  }

  /** Overview 画面の開閉をトグルする。 */
  function toggleOverview(): void {
    isOverviewOpen.value = !isOverviewOpen.value
  }

  const desktops = computed(() => store.virtualDesktops)
  const activeId = computed(() => store.activeVirtualDesktopId)
  const activeDesktop = computed(() => store.virtualDesktops.find(d => d.id === store.activeVirtualDesktopId))
  const currentIndex = computed(() => store.virtualDesktops.findIndex(d => d.id === store.activeVirtualDesktopId))
  const totalDesktops = computed(() => store.virtualDesktops.length)
  const canGoPrev = computed(() => currentIndex.value > 0)
  const canGoNext = computed(() => currentIndex.value < totalDesktops.value - 1)
  const slideDirection = computed(() => store.slideDirection)

  return {
    isOverviewOpen: readonly(isOverviewOpen),
    desktops,
    activeId,
    activeDesktop,
    currentIndex,
    totalDesktops,
    canGoPrev,
    canGoNext,
    slideDirection,
    addDesktop,
    removeDesktop,
    switchDesktop,
    renameDesktop,
    moveWindowToDesktop,
    nextDesktop,
    prevDesktop,
    openOverview,
    closeOverview,
    toggleOverview
  }
}

