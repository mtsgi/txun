import { defineStore } from 'pinia'

/** 1 日分の使用記録 */
export interface DailyRecord {
  /** デスクトップ全体の使用時間（秒） */
  totalSeconds: number
  /** アプリごとの使用時間（appId → 秒） */
  apps: Record<string, number>
  /** アプリごとの通知受信回数（appId → 回） */
  notifications: Record<string, number>
  /** 時間帯別のデスクトップ使用時間（0〜23 の配列、秒） */
  hourly: number[]
}

/** アプリの 1 日あたり使用制限設定 */
export interface AppLimit {
  /** 対象アプリの ID */
  appId: string
  /** 1 日の制限時間（秒） */
  dailyLimitSeconds: number
  /** 制限を有効にするかどうか */
  enabled: boolean
}

/** スクリーンタイムストアの状態 */
export interface ScreenTimeData {
  /** 日付文字列（YYYY-MM-DD）をキーとした日別記録 */
  days: Record<string, DailyRecord>
  /** アプリ制限の一覧 */
  limits: AppLimit[]
  /** 計測を有効にするかどうか */
  trackingEnabled: boolean
}

/** 空の DailyRecord を返すユーティリティ */
export function emptyDailyRecord(): DailyRecord {
  return { totalSeconds: 0, apps: {}, notifications: {}, hourly: Array.from({ length: 24 }, () => 0) }
}

/** 今日の日付文字列（YYYY-MM-DD）を返すユーティリティ */
export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useScreenTimeStore = defineStore('screenTime', {
  state: (): ScreenTimeData => ({
    days: {},
    limits: [],
    trackingEnabled: true
  }),

  getters: {
    /** 今日の使用記録 */
    todayRecord: (state): DailyRecord => {
      const key = todayDateKey()
      return state.days[key] ?? emptyDailyRecord()
    },

    /** 直近 7 日分の記録（古い順） */
    last7Days: (state): Array<{ date: string, record: DailyRecord }> => {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const date = d.toISOString().slice(0, 10)
        return { date, record: state.days[date] ?? emptyDailyRecord() }
      })
    }
  },

  actions: {
    /**
     * 指定日の DailyRecord を取得する。存在しない場合は作成して返す。
     * @param date - 対象日付（YYYY-MM-DD）
     */
    ensureDay(date: string): DailyRecord {
      if (!this.days[date]) {
        this.days[date] = emptyDailyRecord()
      }
      return this.days[date]!
    },

    /**
     * 今日のデスクトップ全体の使用時間を加算する。
     * @param seconds - 加算する秒数（省略時 1）
     */
    incrementTotal(seconds = 1): void {
      if (!this.trackingEnabled) return
      const today = todayDateKey()
      const hour = new Date().getHours()
      const record = this.ensureDay(today)
      record.totalSeconds += seconds
      record.hourly[hour] = (record.hourly[hour] ?? 0) + seconds
    },

    /**
     * 指定アプリの使用時間を今日に加算する。
     * @param appId - 対象アプリの ID
     * @param seconds - 加算する秒数（省略時 1）
     */
    incrementApp(appId: string, seconds = 1): void {
      if (!this.trackingEnabled) return
      const today = todayDateKey()
      const record = this.ensureDay(today)
      record.apps[appId] = (record.apps[appId] ?? 0) + seconds
    },

    /**
     * 指定アプリの通知受信数を今日に加算する。
     * @param appId - 通知を受け取ったアプリの ID
     */
    recordNotification(appId: string): void {
      if (!this.trackingEnabled) return
      const today = todayDateKey()
      const record = this.ensureDay(today)
      record.notifications[appId] = (record.notifications[appId] ?? 0) + 1
    },

    /**
     * アプリの使用制限を設定する。既存設定があれば更新する。
     * @param appId - 対象アプリの ID
     * @param dailyLimitSeconds - 1 日の制限時間（秒）
     * @param enabled - 制限を有効にするかどうか（省略時 true）
     */
    setLimit(appId: string, dailyLimitSeconds: number, enabled = true): void {
      const existing = this.limits.find(l => l.appId === appId)
      if (existing) {
        existing.dailyLimitSeconds = dailyLimitSeconds
        existing.enabled = enabled
      } else {
        this.limits.push({ appId, dailyLimitSeconds, enabled })
      }
    },

    /**
     * アプリの使用制限を削除する。
     * @param appId - 削除対象アプリの ID
     */
    removeLimit(appId: string): void {
      const idx = this.limits.findIndex(l => l.appId === appId)
      if (idx !== -1) this.limits.splice(idx, 1)
    },

    /**
     * アプリ制限の有効/無効を切り替える。
     * @param appId - 対象アプリの ID
     */
    toggleLimit(appId: string): void {
      const limit = this.limits.find(l => l.appId === appId)
      if (limit) limit.enabled = !limit.enabled
    },

    /** 計測の有効/無効を切り替える。 */
    toggleTracking(): void {
      this.trackingEnabled = !this.trackingEnabled
    },

    /** すべての使用記録をリセットする。 */
    resetAllData(): void {
      this.days = {}
    }
  }
})
