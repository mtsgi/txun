<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()
const { saveState, loadState } = useDesktopStorage()

/** カレンダーイベントを表す型 */
interface CalendarEvent {
  id: string
  date: string
  title: string
  color: 'red' | 'blue' | 'green' | 'orange' | 'purple'
}

/** 表示中の月 */
const currentDate = ref(new Date())
/** イベント一覧 */
const events = ref<CalendarEvent[]>([])
/** イベント追加モーダルの表示状態 */
const showAddModal = ref(false)
/** 新規イベントのフォームデータ */
const newEvent = ref<Partial<CalendarEvent>>({ color: 'blue' })
/** 選択中の日付 */
const selectedDate = ref<string | null>(null)

/** ストレージキー */
const STORAGE_KEY = 'calendar-events'

onMounted(async () => {
  const saved = await loadState(STORAGE_KEY)
  if (Array.isArray(saved)) {
    events.value = saved as CalendarEvent[]
  }
})

/** イベントをストレージに保存する */
async function persistEvents(): Promise<void> {
  await saveState(STORAGE_KEY, events.value)
}

/** コンテナ幅によるレスポンシブ判定 */
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(700)

onMounted(() => {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) containerWidth.value = entry.contentRect.width
  })
  ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})

/** 幅が 500px 未満をコンパクトモードと判定 */
const isCompact = computed(() => containerWidth.value < 500)

/** 表示中の年 */
const year = computed(() => currentDate.value.getFullYear())
/** 表示中の月（0始まり） */
const month = computed(() => currentDate.value.getMonth())

/** 月間グリッドのセル（先頭パディング含む）を計算する */
const calendarCells = computed(() => {
  const firstDay = new Date(year.value, month.value, 1).getDay()
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const cells: Array<{ date: string, day: number } | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month.value + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ date: `${year.value}-${mm}-${dd}`, day: d })
  }
  return cells
})

/** 指定日付のイベントを返す */
function eventsOnDate(date: string): CalendarEvent[] {
  return events.value.filter(e => e.date === date)
}

/** 前の月に移動する */
function prevMonth(): void {
  currentDate.value = new Date(year.value, month.value - 1, 1)
}

/** 次の月に移動する */
function nextMonth(): void {
  currentDate.value = new Date(year.value, month.value + 1, 1)
}

/** 今日に戻る */
function goToday(): void {
  currentDate.value = new Date()
}

/** 日付をクリックしてイベント追加モーダルを開く */
function openAddModal(date: string): void {
  selectedDate.value = date
  newEvent.value = { date, color: 'blue' }
  showAddModal.value = true
}

/** イベントを追加する */
async function addEvent(): Promise<void> {
  if (!newEvent.value.title || !newEvent.value.date) return
  const event: CalendarEvent = {
    id: crypto.randomUUID(),
    date: newEvent.value.date,
    title: newEvent.value.title,
    color: newEvent.value.color ?? 'blue'
  }
  events.value.push(event)
  await persistEvents()
  showAddModal.value = false
  newEvent.value = { color: 'blue' }
}

/** イベントを削除する */
async function removeEvent(id: string): Promise<void> {
  events.value = events.value.filter(e => e.id !== id)
  await persistEvents()
}

/** 今日の日付文字列 */
const todayStr = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})

/** 月名と曜日名 */
const monthNames = computed(() => [
  t('apps.calendar.month.jan'), t('apps.calendar.month.feb'), t('apps.calendar.month.mar'),
  t('apps.calendar.month.apr'), t('apps.calendar.month.may'), t('apps.calendar.month.jun'),
  t('apps.calendar.month.jul'), t('apps.calendar.month.aug'), t('apps.calendar.month.sep'),
  t('apps.calendar.month.oct'), t('apps.calendar.month.nov'), t('apps.calendar.month.dec')
])

const weekDays = computed(() => [
  t('apps.calendar.week.sun'), t('apps.calendar.week.mon'), t('apps.calendar.week.tue'),
  t('apps.calendar.week.wed'), t('apps.calendar.week.thu'), t('apps.calendar.week.fri'),
  t('apps.calendar.week.sat')
])

/** イベント色マッピング */
const eventColorClass: Record<CalendarEvent['color'], string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500'
}

const colorOptions = [
  { label: t('apps.calendar.color.red'), value: 'red' },
  { label: t('apps.calendar.color.blue'), value: 'blue' },
  { label: t('apps.calendar.color.green'), value: 'green' },
  { label: t('apps.calendar.color.orange'), value: 'orange' },
  { label: t('apps.calendar.color.purple'), value: 'purple' }
]
</script>

<template>
  <div
    ref="containerRef"
    class="calendar-app"
    :class="{ compact: isCompact }"
  >
    <!-- ヘッダー -->
    <div class="cal-header">
      <div class="cal-nav">
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="prevMonth"
        />
        <span class="cal-title">{{ monthNames[month] }} {{ year }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="nextMonth"
        />
      </div>
      <UButton
        :label="t('apps.calendar.today')"
        variant="outline"
        color="neutral"
        size="sm"
        @click="goToday"
      />
    </div>

    <!-- 曜日ヘッダー -->
    <div class="cal-weekdays">
      <div
        v-for="d in weekDays"
        :key="d"
        class="cal-weekday"
        :class="{ sun: d === weekDays[0], sat: d === weekDays[6] }"
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
        <div
          v-if="cell"
          class="cal-cell"
          :class="{ today: cell.date === todayStr, selected: cell.date === selectedDate }"
          @click="openAddModal(cell.date)"
        >
          <span class="cal-day">{{ cell.day }}</span>
          <div class="cal-events">
            <div
              v-for="ev in eventsOnDate(cell.date)"
              :key="ev.id"
              class="cal-event"
              :class="eventColorClass[ev.color]"
              :title="ev.title"
              @click.stop="removeEvent(ev.id)"
            >
              <span v-if="!isCompact">{{ ev.title }}</span>
            </div>
          </div>
        </div>
        <div
          v-else
          class="cal-cell empty"
        />
      </template>
    </div>

    <!-- イベント追加モーダル -->
    <UModal
      v-model:open="showAddModal"
      :title="t('apps.calendar.addEvent')"
    >
      <template #body>
        <div class="modal-form">
          <UFormField :label="t('apps.calendar.eventTitle')">
            <UInput
              v-model="newEvent.title"
              :placeholder="t('apps.calendar.eventTitlePlaceholder')"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField :label="t('apps.calendar.eventDate')">
            <UInput
              v-model="newEvent.date"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('apps.calendar.eventColor')">
            <USelect
              v-model="newEvent.color"
              :items="colorOptions"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="modal-footer">
          <UButton
            :label="t('apps.calendar.cancel')"
            variant="ghost"
            color="neutral"
            @click="showAddModal = false"
          />
          <UButton
            :label="t('apps.calendar.add')"
            color="primary"
            :disabled="!newEvent.title"
            @click="addEvent"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.calendar-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  overflow: hidden;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
}

.cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-title {
  font-size: 1rem;
  font-weight: 600;
  min-width: 140px;
  text-align: center;
}

.compact .cal-title {
  font-size: 0.9rem;
  min-width: 110px;
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
}

.cal-weekday {
  text-align: center;
  padding: 6px 2px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ui-text-muted);
}

.cal-weekday.sun { color: var(--ui-color-red-500); }
.cal-weekday.sat { color: var(--ui-color-blue-500); }

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex: 1;
  overflow-y: auto;
  align-content: start;
}

.cal-cell {
  border-right: 1px solid var(--ui-border);
  border-bottom: 1px solid var(--ui-border);
  padding: 4px;
  min-height: 72px;
  cursor: pointer;
  transition: background 0.15s;
}

.compact .cal-cell {
  min-height: 52px;
}

.cal-cell:hover {
  background: var(--ui-bg-elevated);
}

.cal-cell.today .cal-day {
  background: var(--ui-color-primary-500);
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cal-cell.empty {
  background: var(--ui-bg-muted);
  cursor: default;
}

.cal-day {
  font-size: 0.8rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.cal-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.cal-event {
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 0.68rem;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.cal-event:hover {
  opacity: 0.75;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
