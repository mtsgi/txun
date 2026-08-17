<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import { useWindowManager } from '../../composables/useWindowManager'
import { useCalendarEvents } from '../../composables/useCalendarEvents'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useDesktopStore()
const { openApp } = useWindowManager()
const { t } = useI18n()
const { loadEvents, eventsOnDate } = useCalendarEvents()

/** 現在時刻 */
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await loadEvents()
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

/** 時刻表示文字列 */
const formattedTime = computed(() => {
  const is12h = store.timeFormat === '12h'
  return now.value.toLocaleTimeString(store.locale === 'ja' ? 'ja-JP' : 'en-US', {
    hour12: is12h,
    hour: is12h ? 'numeric' : '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
})

/** 日付表示文字列 */
const formattedDate = computed(() => {
  return now.value.toLocaleDateString(store.locale === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

/** 表示中のカレンダー月 */
const viewDate = ref(new Date())
/** 選択中の日付 (YYYY-MM-DD) */
const selectedDateStr = ref(toDateStr(new Date()))

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${date}`
}

const todayStr = computed(() => toDateStr(now.value))

const viewYear = computed(() => viewDate.value.getFullYear())
const viewMonth = computed(() => viewDate.value.getMonth())

function prevMonth() {
  viewDate.value = new Date(viewYear.value, viewMonth.value - 1, 1)
}

function nextMonth() {
  viewDate.value = new Date(viewYear.value, viewMonth.value + 1, 1)
}

function goToday() {
  viewDate.value = new Date()
  selectedDateStr.value = todayStr.value
}

function selectDate(dateStr: string) {
  selectedDateStr.value = dateStr
}

/** 選択中日付の表示テキスト（ヘッダー用） */
const selectedDateLabel = computed(() => {
  const [y, m, d] = selectedDateStr.value.split('-').map(Number)
  if (!y || !m || !d) return selectedDateStr.value
  const dateObj = new Date(y, m - 1, d)
  return dateObj.toLocaleDateString(store.locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  })
})

/** 選択中日付のイベント一覧 */
const currentDayEvents = computed(() => {
  return eventsOnDate(selectedDateStr.value)
})

/** 月間グリッドのセル */
const calendarCells = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1).getDay()
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const cells: Array<{ date: string, day: number } | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth.value + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ date: `${viewYear.value}-${mm}-${dd}`, day: d })
  }
  return cells
})

const monthNames = computed(() => [
  t('core.desktop.clock.month.jan'), t('core.desktop.clock.month.feb'), t('core.desktop.clock.month.mar'),
  t('core.desktop.clock.month.apr'), t('core.desktop.clock.month.may'), t('core.desktop.clock.month.jun'),
  t('core.desktop.clock.month.jul'), t('core.desktop.clock.month.aug'), t('core.desktop.clock.month.sep'),
  t('core.desktop.clock.month.oct'), t('core.desktop.clock.month.nov'), t('core.desktop.clock.month.dec')
])

const weekDays = computed(() => [
  t('core.desktop.clock.week.sun'), t('core.desktop.clock.week.mon'), t('core.desktop.clock.week.tue'),
  t('core.desktop.clock.week.wed'), t('core.desktop.clock.week.thu'), t('core.desktop.clock.week.fri'),
  t('core.desktop.clock.week.sat')
])

/** イベント色マッピング */
const eventColorBgMap: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500'
}

function handleOpenClock() {
  openApp('clock')
  emit('close')
}

function handleOpenCalendar() {
  openApp('calendar')
  emit('close')
}
</script>

<template>
  <div class="clock-flyout">
    <!-- 時計ヘッダー -->
    <div class="flyout-header">
      <div class="time-section">
        <div class="time-main">
          {{ formattedTime }}
        </div>
        <div class="date-main">
          {{ formattedDate }}
        </div>
      </div>
      <div class="header-actions">
        <UTooltip :text="$t('core.desktop.clock.openClock')">
          <UButton
            icon="i-lucide-clock"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="$t('core.desktop.clock.openClock')"
            @click="handleOpenClock"
          />
        </UTooltip>
        <UTooltip :text="$t('core.desktop.clock.openCalendar')">
          <UButton
            icon="i-lucide-calendar"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="$t('core.desktop.clock.openCalendar')"
            @click="handleOpenCalendar"
          />
        </UTooltip>
      </div>
    </div>

    <!-- ミニカレンダー -->
    <div class="calendar-section">
      <!-- ナビゲーション -->
      <div class="cal-nav-bar">
        <span class="cal-current-month">{{ monthNames[viewMonth] }} {{ viewYear }}</span>
        <div class="cal-nav-buttons">
          <UButton
            icon="i-lucide-chevron-left"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="$t('core.desktop.clock.prevMonth')"
            @click="prevMonth"
          />
          <UButton
            icon="i-lucide-circle-dot"
            size="xs"
            variant="ghost"
            color="neutral"
            :title="$t('core.desktop.clock.today')"
            :aria-label="$t('core.desktop.clock.today')"
            @click="goToday"
          />
          <UButton
            icon="i-lucide-chevron-right"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="$t('core.desktop.clock.nextMonth')"
            @click="nextMonth"
          />
        </div>
      </div>

      <!-- 曜日ヘッダー -->
      <div class="cal-weekdays">
        <div
          v-for="(d, i) in weekDays"
          :key="d"
          class="cal-weekday"
          :class="{ 'is-sun': i === 0, 'is-sat': i === 6 }"
        >
          {{ d }}
        </div>
      </div>

      <!-- 日付グリッド -->
      <div class="cal-grid">
        <template
          v-for="(cell, idx) in calendarCells"
          :key="idx"
        >
          <button
            v-if="cell"
            type="button"
            class="cal-cell"
            :class="{
              'is-today': cell.date === todayStr,
              'is-selected': cell.date === selectedDateStr
            }"
            @click="selectDate(cell.date)"
          >
            <span class="day-number">{{ cell.day }}</span>
            <div
              v-if="eventsOnDate(cell.date).length > 0"
              class="event-dots"
            >
              <span
                v-for="ev in eventsOnDate(cell.date).slice(0, 3)"
                :key="ev.id"
                class="event-dot"
                :class="eventColorBgMap[ev.color] || 'bg-primary'"
              />
            </div>
          </button>
          <div
            v-else
            class="cal-cell is-empty"
          />
        </template>
      </div>
    </div>

    <!-- 予定一覧セクション -->
    <div class="events-section">
      <div class="events-header">
        <span class="events-date-title">{{ selectedDateLabel }}</span>
        <UBadge
          v-if="currentDayEvents.length > 0"
          size="xs"
          variant="subtle"
          color="primary"
        >
          {{ currentDayEvents.length }}
        </UBadge>
      </div>

      <div class="events-list">
        <div
          v-if="currentDayEvents.length === 0"
          class="events-empty"
        >
          <UIcon
            name="i-lucide-calendar-check-2"
            class="empty-icon"
          />
          <span>{{ $t('core.desktop.clock.noEvents') }}</span>
        </div>
        <div
          v-for="ev in currentDayEvents"
          v-else
          :key="ev.id"
          class="event-item"
        >
          <span
            class="event-color-bar"
            :class="eventColorBgMap[ev.color] || 'bg-primary'"
          />
          <span class="event-title">{{ ev.title }}</span>
        </div>
      </div>

      <!-- カレンダー起動フッター -->
      <div class="events-footer">
        <UButton
          icon="i-lucide-calendar-days"
          size="xs"
          variant="soft"
          color="primary"
          block
          @click="handleOpenCalendar"
        >
          {{ $t('core.desktop.clock.viewInCalendar') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.clock-flyout {
  width: 290px;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  gap: 0.75rem;
  color: var(--ui-text);
}

.flyout-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--ui-border);
}

.time-section {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  .time-main {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--ui-text-highlighted);
  }

  .date-main {
    font-size: 0.75rem;
    color: var(--ui-text-muted);
  }
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.calendar-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.cal-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .cal-current-month {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .cal-nav-buttons {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--ui-text-muted);
  padding: 0.125rem 0;

  .cal-weekday.is-sun {
    color: var(--ui-color-red-500);
  }

  .cal-weekday.is-sat {
    color: var(--ui-color-blue-500);
  }
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 0.75rem;
  transition: all 0.12s ease;

  &:hover:not(.is-empty) {
    background: var(--ui-bg-elevated);
  }

  &.is-empty {
    cursor: default;
  }

  &.is-today {
    font-weight: 700;
    color: var(--ui-primary);

    .day-number {
      color: var(--ui-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  }

  &.is-selected {
    background: color-mix(in srgb, var(--ui-primary) 20%, transparent);
    border-color: var(--ui-primary);
    font-weight: 700;
  }

  .day-number {
    line-height: 1;
  }

  .event-dots {
    position: absolute;
    bottom: 2px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 3px;
    pointer-events: none;
  }

  .event-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}

.events-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ui-border);
}

.events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .events-date-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ui-text-muted);
  }
}

.events-list {
  max-height: 110px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.events-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 0;
  font-size: 0.75rem;
  color: var(--ui-text-muted);

  .empty-icon {
    font-size: 0.875rem;
    opacity: 0.7;
  }
}

.event-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem;
  border-radius: 4px;
  background: var(--ui-bg-elevated);
  font-size: 0.75rem;

  .event-color-bar {
    width: 3px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .event-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.events-footer {
  padding-top: 0.25rem;
}
</style>
