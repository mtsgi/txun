<script setup lang="ts">
/** アプリ使用時間の 1 行表示コンポーネント */
const props = defineProps<{
  /** アプリ ID */
  appId: string
  /** アプリ表示名 */
  appName: string
  /** アプリアイコンクラス */
  appIcon: string
  /** 使用時間（秒） */
  seconds: number
  /** 制限時間（秒、未設定なら undefined） */
  limitSeconds?: number
  /** 全アプリ中の最大使用時間（秒）— バー幅計算用 */
  maxSeconds: number
  /** 通知受信回数 */
  notificationCount?: number
}>()

/** 秒数を "X時間 Ym" / "Ym" / "1分未満" 形式に変換 */
function formatTime(sec: number): string {
  if (sec < 60) return '1分未満'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}時間 ${m}分`
  return `${m}分`
}

const barWidth = computed(() => props.maxSeconds > 0 ? (props.seconds / props.maxSeconds * 100) : 0)
const limitRatio = computed(() =>
  props.limitSeconds != null && props.limitSeconds > 0
    ? Math.min(props.seconds / props.limitSeconds, 1)
    : null
)
const overLimit = computed(() => props.limitSeconds != null && props.seconds >= props.limitSeconds)
</script>

<template>
  <div class="flex items-center gap-3 py-2">
    <!-- アイコン -->
    <div class="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
      <UIcon
        :name="appIcon"
        class="w-5 h-5"
      />
    </div>

    <!-- 名前・バー -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-medium truncate">{{ appName }}</span>
        <div class="flex items-center gap-1.5 shrink-0">
          <UBadge
            v-if="notificationCount"
            :label="String(notificationCount)"
            size="xs"
            variant="subtle"
            color="neutral"
          />
          <span class="text-xs text-muted">{{ formatTime(seconds) }}</span>
        </div>
      </div>
      <!-- 使用量バー -->
      <div class="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          v-if="limitRatio !== null"
          class="h-full rounded-full transition-all duration-500"
          :class="overLimit ? 'bg-error' : 'bg-primary'"
          :style="{ width: (limitRatio * 100) + '%' }"
        />
        <div
          v-else
          class="h-full rounded-full bg-primary/60 transition-all duration-500"
          :style="{ width: barWidth + '%' }"
        />
      </div>
    </div>
  </div>
</template>
