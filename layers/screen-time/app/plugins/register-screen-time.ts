import { todayDateKey } from '../stores/screenTime'

export default defineNuxtPlugin((nuxtApp) => {
  const desktopStore = useDesktopStore()
  const screenTimeStore = useScreenTimeStore()

  // アプリ登録
  desktopStore.registerApp({
    id: 'screen-time',
    name: 'Screen Time',
    nameKey: 'apps.screenTime.name',
    icon: 'i-lucide-activity',
    color: 'indigo',
    component: 'AppsScreenTimeApp',
    defaultWidth: 480,
    defaultHeight: 540,
    category: 'system'
  })

  // アプリ起動後に計測を開始する
  nuxtApp.hook('app:mounted', () => {
    const toast = useToast()
    const { lastNotificationEvent } = useDesktopNotification()
    const { saveState, loadState } = useDesktopStorage()

    // IndexedDB から前回の記録を復元する
    loadState<{ days: unknown, limits: unknown, trackingEnabled: unknown }>('screen-time')
      .then((saved) => {
        if (saved) {
          if (saved.days && typeof saved.days === 'object') {
            const days = saved.days as Record<string, any>
            for (const key of Object.keys(days)) {
              const record = days[key]
              if (record && typeof record === 'object') {
                if (record.totalSeconds == null) record.totalSeconds = 0
                if (!record.apps) record.apps = {}
                if (!record.notifications) record.notifications = {}
                if (!record.hourly || !Array.isArray(record.hourly) || record.hourly.length !== 24) {
                  record.hourly = Array.from({ length: 24 }, () => 0)
                }
              }
            }
            screenTimeStore.days = days as typeof screenTimeStore.days
          }
          if (Array.isArray(saved.limits)) {
            screenTimeStore.limits = saved.limits as typeof screenTimeStore.limits
          }
          if (typeof saved.trackingEnabled === 'boolean') {
            screenTimeStore.trackingEnabled = saved.trackingEnabled
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load screen-time state:', err)
      })

    // 通知イベントを監視して受信回数を記録する
    watch(lastNotificationEvent, (event) => {
      if (event) screenTimeStore.recordNotification(event.appId)
    })

    // 制限超過アラート済みアプリ ID のセット（今日のみ有効）
    const alerted = new Set<string>()
    let alertedDate = todayDateKey()

    // 1 秒ごとにデスクトップ使用時間とアクティブアプリ時間を加算する
    setInterval(() => {
      const today = todayDateKey()

      // 日付が変わったらアラート済みセットをリセットする
      if (today !== alertedDate) {
        alerted.clear()
        alertedDate = today
      }

      // デスクトップ全体の時間を加算
      screenTimeStore.incrementTotal()

      // フォーカス中ウィンドウのアプリ時間を加算
      const focusedId = desktopStore.focusedWindowId
      if (!focusedId) return

      const focusedWindow = desktopStore.getWindowById(focusedId)
      if (!focusedWindow || focusedWindow.isMinimized) return

      const appId = focusedWindow.appId
      screenTimeStore.incrementApp(appId)

      // 制限超過チェック
      const limit = screenTimeStore.limits.find(l => l.appId === appId && l.enabled)
      if (limit && !alerted.has(appId)) {
        const used = screenTimeStore.days[today]?.apps[appId] ?? 0
        if (used >= limit.dailyLimitSeconds) {
          alerted.add(appId)
          const appMeta = desktopStore.apps.find(a => a.id === appId)
          const appName = appMeta?.name ?? appId
          const i18n = nuxtApp.$i18n as any
          toast.add({
            title: i18n.t('apps.screenTime.limitReached'),
            description: i18n.t('apps.screenTime.limitReachedDesc', { app: appName }),
            color: 'warning',
            icon: 'i-lucide-timer-off'
          })
        }
      }
    }, 1000)

    // 1 分ごとに IndexedDB へ保存する
    setInterval(() => {
      saveState('screen-time', {
        days: screenTimeStore.days,
        limits: screenTimeStore.limits,
        trackingEnabled: screenTimeStore.trackingEnabled
      })
    }, 60_000)
  })
})
