// @pinia/nuxt はレイヤーの app/stores/ を自動スキャンしないため、composables/ 経由で re-export する。
export { useScreenTimeStore } from '../stores/screenTime'
export type { DailyRecord, AppLimit, ScreenTimeData } from '../stores/screenTime'
