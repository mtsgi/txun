/**
 * スポットライト検索の開閉状態をシングルトンで管理するコンポーザブル。
 * Ctrl+K で開くデスクトップ検索機能。
 */
export function useSpotlight() {
  /** スポットライトの表示状態（シングルトン） */
  const isOpen = useState<boolean>('spotlight-open', () => false)

  /** スポットライトを開く */
  function openSpotlight(): void {
    isOpen.value = true
  }

  /** スポットライトを閉じる */
  function closeSpotlight(): void {
    isOpen.value = false
  }

  /** スポットライトの開閉をトグルする */
  function toggleSpotlight(): void {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    openSpotlight,
    closeSpotlight,
    toggleSpotlight
  }
}
