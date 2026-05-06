/**
 * デスクトップ通知（トースト）を表示するコンポーザブル。
 * アプリ内から useDesktopNotification().notify() を呼び出すことでトーストを表示する。
 */
export function useDesktopNotification() {
  const toast = useToast()

  /**
   * 通知トーストを表示する。
   * @param title - 通知タイトル
   * @param options - 追加オプション（説明文・タイプ・アイコン）
   */
  function notify(
    title: string,
    options?: {
      description?: string
      type?: 'success' | 'error' | 'info' | 'warning'
      icon?: string
    }
  ): void {
    const colorMap = {
      success: 'success',
      error: 'error',
      info: 'info',
      warning: 'warning'
    } as const

    toast.add({
      title,
      description: options?.description,
      color: options?.type ? colorMap[options.type] : undefined,
      icon: options?.icon
    })
  }

  return { notify }
}
