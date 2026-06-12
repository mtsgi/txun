<script setup lang="ts">
import type { DailyRecord } from '../../stores/screenTime'

const { t } = useI18n()

/** 日別棒グラフコンポーネント（直近 7 日） */
const props = defineProps<{
  /** 直近 7 日分のデータ（古い順） */
  days: Array<{ date: string, record: DailyRecord }>
  /** 選択中の日付（YYYY-MM-DD） */
  selectedDate: string
}>()

const emit = defineEmits<{
  (e: 'select', date: string): void
}>()

const maxVal = computed(() => Math.max(...props.days.map(d => d.record.totalSeconds), 1))

/** YYYY-MM-DD → 曜日の短縮形 */
function dayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const key = keys[d.getDay()]
  return key ? t('apps.screenTime.days.' + key) : ''
}

/** 今日かどうか */
function isToday(date: string): boolean {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return date === today
}
</script>

<template>
  <div class="flex items-end gap-1.5 h-24 w-full px-1">
    <div
      v-for="day in days"
      :key="day.date"
      class="flex-1 flex flex-col items-center gap-1 cursor-pointer"
      @click="emit('select', day.date)"
    >
      <div class="w-full flex-1 flex items-end">
        <div
          class="w-full rounded-t transition-all duration-300"
          :class="[
            day.date === selectedDate ? 'bg-primary' : 'bg-primary/40',
            isToday(day.date) ? 'ring-1 ring-primary ring-offset-1 ring-offset-transparent' : ''
          ]"
          :style="{ height: (day.record.totalSeconds / maxVal * 100) + '%', minHeight: day.record.totalSeconds > 0 ? '4px' : '0' }"
        />
      </div>
      <span
        class="text-[10px] leading-none"
        :class="isToday(day.date) ? 'text-primary font-semibold' : 'text-muted'"
      >{{ dayLabel(day.date) }}</span>
    </div>
  </div>
</template>
