/** 通知イベントの型（スクリーンタイム等での計測用） */
export interface DesktopNotificationEvent {
  /** 通知を発行したアプリの ID */
  appId: string
  /** 発行タイムスタンプ（ms） */
  ts: number
}

/**
 * デスクトップ通知（トースト）を表示するコンポーザブル。
 * アプリ内から useDesktopNotification().notify() を呼び出すことでトーストを表示する。
 */
export function useDesktopNotification() {
  const toast = useToast()
  const lastNotificationEvent = useState<DesktopNotificationEvent | null>(
    'desktop-notification-event',
    () => null
  )

  /**
   * 通知トーストを表示する。
   * @param title - 通知タイトル
   * @param options - 追加オプション（説明文・タイプ・アイコン・アプリ ID）
   */
  function notify(
    title: string,
    options?: {
      description?: string
      type?: 'success' | 'error' | 'info' | 'warning'
      icon?: string
      /** スクリーンタイム計測用アプリ ID */
      appId?: string
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

    if (options?.appId) {
      lastNotificationEvent.value = { appId: options.appId, ts: Date.now() }
    }
  }

  return { notify, lastNotificationEvent }
}
