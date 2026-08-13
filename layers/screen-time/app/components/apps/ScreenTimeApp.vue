<script setup lang="ts">
import { todayDateKey } from '../../stores/screenTime'

defineProps<{
  /** ウィンドウ固有 ID */
  windowId: string
}>()

const { t } = useI18n()
const screenTimeStore = useScreenTimeStore()
const desktopStore = useDesktopStore()
const { saveState } = useDesktopStorage()

// ---- タブ ----
type Tab = 'today' | 'week' | 'limits' | 'settings'
const activeTab = ref<Tab>('today')

const tabs = computed(() => [
  { key: 'today' as Tab, label: t('apps.screenTime.tabToday'), icon: 'i-lucide-sun' },
  { key: 'week' as Tab, label: t('apps.screenTime.tabWeek'), icon: 'i-lucide-calendar-days' },
  { key: 'limits' as Tab, label: t('apps.screenTime.tabLimits'), icon: 'i-lucide-timer' },
  { key: 'settings' as Tab, label: t('apps.screenTime.tabSettings'), icon: 'i-lucide-settings-2' }
])

// ---- 週間タブ：選択日 ----
const selectedDate = ref(todayDateKey())
const selectedRecord = computed(
  () => screenTimeStore.days[selectedDate.value]
    ?? { totalSeconds: 0, apps: {}, notifications: {}, hourly: Array.from({ length: 24 }, () => 0) }
)

// ---- ヘルパー ----

/** 秒数を "X時間 Ym" / "Ym" / "1分未満" 形式に変換 */
function formatTime(sec: number): string {
  if (sec < 60) return t('apps.screenTime.lessThanMinute')
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return t('apps.screenTime.hoursMinutes', { h, m })
  return t('apps.screenTime.minutes', { m })
}

/** アプリ一覧を使用時間の降順に返す（0 秒のアプリは除外） */
function sortedAppUsage(appsRecord: Record<string, number>) {
  return Object.entries(appsRecord)
    .filter(([, sec]) => sec > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([appId, seconds]) => ({
      appId,
      seconds,
      meta: desktopStore.apps.find(a => a.id === appId)
    }))
}

const sortedTodayApps = computed(() => sortedAppUsage(screenTimeStore.todayRecord.apps))
const sortedSelectedApps = computed(() => sortedAppUsage(selectedRecord.value.apps))
const maxTodaySeconds = computed(() => sortedTodayApps.value[0]?.seconds ?? 1)
const maxSelectedSeconds = computed(() => sortedSelectedApps.value[0]?.seconds ?? 1)

/** すべての登録アプリを制限設定付きで返す */
const appsWithLimits = computed(() =>
  desktopStore.apps.map(app => ({
    app,
    limit: screenTimeStore.limits.find(l => l.appId === app.id),
    usedSeconds: screenTimeStore.todayRecord.apps[app.id] ?? 0
  }))
)

// ---- 制限設定ダイアログ ----
const limitDialog = ref(false)
const limitTarget = ref<{ appId: string, appName: string } | null>(null)
const limitInput = ref(60) // 分単位

function openLimitDialog(appId: string, appName: string) {
  const existing = screenTimeStore.limits.find(l => l.appId === appId)
  limitInput.value = existing ? Math.floor(existing.dailyLimitSeconds / 60) : 60
  limitTarget.value = { appId, appName }
  limitDialog.value = true
}

function saveLimitDialog() {
  if (!limitTarget.value) return
  screenTimeStore.setLimit(limitTarget.value.appId, limitInput.value * 60)
  limitDialog.value = false
  persistNow()
}

function removeLimitAndClose() {
  if (!limitTarget.value) return
  screenTimeStore.removeLimit(limitTarget.value.appId)
  limitDialog.value = false
  persistNow()
}

// ---- 設定タブ ----
const showResetConfirm = ref(false)

function confirmReset() {
  screenTimeStore.resetAllData()
  showResetConfirm.value = false
  persistNow()
}

/** 即時 IndexedDB 保存 */
function persistNow() {
  saveState('screen-time', {
    days: screenTimeStore.days,
    limits: screenTimeStore.limits,
    trackingEnabled: screenTimeStore.trackingEnabled
  })
}

// 計測トグル変更時も保存
watch(() => screenTimeStore.trackingEnabled, () => persistNow())
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-[--ui-bg]">
    <!-- ヘッダー -->
    <div class="px-4 pt-4 pb-2 border-b border-[--ui-border]">
      <h1 class="text-lg font-semibold">
        {{ $t('apps.screenTime.name') }}
      </h1>
    </div>

    <!-- タブナビ -->
    <div class="flex border-b border-[--ui-border] px-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === tab.key
          ? 'border-primary text-primary'
          : 'border-transparent text-muted hover:text-[--ui-text]'"
        @click="activeTab = tab.key"
      >
        <UIcon
          :name="tab.icon"
          class="w-4 h-4"
        />
        {{ tab.label }}
      </button>
    </div>

    <!-- コンテンツ -->
    <div class="flex-1 overflow-y-auto">
      <!-- 今日タブ -->
      <div
        v-if="activeTab === 'today'"
        class="p-4 flex flex-col gap-4"
      >
        <div class="text-center">
          <div class="text-4xl font-bold tabular-nums">
            {{ formatTime(screenTimeStore.todayRecord.totalSeconds) }}
          </div>
          <p class="text-sm text-muted mt-1">
            {{ $t('apps.screenTime.totalToday') }}
          </p>
        </div>

        <ScreenTimeHourlyChart :hourly="screenTimeStore.todayRecord.hourly" />

        <div v-if="sortedTodayApps.length > 0">
          <p class="text-xs text-muted uppercase tracking-wide font-semibold mb-1">
            {{ $t('apps.screenTime.mostUsed') }}
          </p>
          <ScreenTimeAppRow
            v-for="item in sortedTodayApps"
            :key="item.appId"
            :app-id="item.appId"
            :app-name="item.meta?.name ?? item.appId"
            :app-icon="item.meta?.icon ?? 'i-lucide-app-window'"
            :seconds="item.seconds"
            :limit-seconds="screenTimeStore.limits.find(l => l.appId === item.appId && l.enabled)?.dailyLimitSeconds"
            :max-seconds="maxTodaySeconds"
            :notification-count="screenTimeStore.todayRecord.notifications[item.appId]"
          />
        </div>
        <div
          v-else
          class="text-center text-muted text-sm py-8"
        >
          {{ $t('apps.screenTime.noData') }}
        </div>
      </div>

      <!-- 週間タブ -->
      <div
        v-else-if="activeTab === 'week'"
        class="p-4 flex flex-col gap-4"
      >
        <ScreenTimeDailyChart
          :days="screenTimeStore.last7Days"
          :selected-date="selectedDate"
          @select="selectedDate = $event"
        />
        <div>
          <p class="text-xs text-muted uppercase tracking-wide font-semibold mb-1">
            {{ selectedDate === todayDateKey() ? $t('apps.screenTime.today') : selectedDate }}
            —
            {{ formatTime(selectedRecord.totalSeconds) }}
          </p>
          <div v-if="sortedSelectedApps.length > 0">
            <ScreenTimeAppRow
              v-for="item in sortedSelectedApps"
              :key="item.appId"
              :app-id="item.appId"
              :app-name="item.meta?.name ?? item.appId"
              :app-icon="item.meta?.icon ?? 'i-lucide-app-window'"
              :seconds="item.seconds"
              :max-seconds="maxSelectedSeconds"
              :notification-count="selectedRecord.notifications[item.appId]"
            />
          </div>
          <div
            v-else
            class="text-center text-muted text-sm py-8"
          >
            {{ $t('apps.screenTime.noData') }}
          </div>
        </div>
      </div>

      <!-- 制限タブ -->
      <div
        v-else-if="activeTab === 'limits'"
        class="p-4 flex flex-col gap-2"
      >
        <p class="text-xs text-muted mb-2">
          {{ $t('apps.screenTime.limitsDesc') }}
        </p>
        <div
          v-for="{ app, limit, usedSeconds } in appsWithLimits"
          :key="app.id"
          class="flex items-center gap-3 py-2 border-b border-[--ui-border] last:border-0"
        >
          <div class="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <UIcon
              :name="app.icon"
              class="w-5 h-5"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">
              {{ app.name }}
            </p>
            <p class="text-xs text-muted">
              {{ formatTime(usedSeconds) }}
              <span
                v-if="limit?.enabled"
                class="text-warning"
              >
                / {{ formatTime(limit.dailyLimitSeconds) }}
              </span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <USwitch
              v-if="limit"
              :model-value="limit.enabled"
              size="xs"
              @update:model-value="screenTimeStore.toggleLimit(app.id)"
            />
            <UButton
              size="xs"
              variant="ghost"
              :icon="limit ? 'i-lucide-pencil' : 'i-lucide-plus'"
              :label="limit ? '' : $t('apps.screenTime.addLimit')"
              @click="openLimitDialog(app.id, app.name)"
            />
          </div>
        </div>
      </div>

      <!-- 設定タブ -->
      <div
        v-else-if="activeTab === 'settings'"
        class="p-4 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between py-2 border-b border-[--ui-border]">
          <div>
            <p class="text-sm font-medium">
              {{ $t('apps.screenTime.trackingEnabled') }}
            </p>
            <p class="text-xs text-muted">
              {{ $t('apps.screenTime.trackingEnabledDesc') }}
            </p>
          </div>
          <USwitch
            :model-value="screenTimeStore.trackingEnabled"
            @update:model-value="screenTimeStore.toggleTracking()"
          />
        </div>

        <div class="py-2">
          <p class="text-sm font-medium text-error mb-1">
            {{ $t('apps.screenTime.resetData') }}
          </p>
          <p class="text-xs text-muted mb-3">
            {{ $t('apps.screenTime.resetDataDesc') }}
          </p>
          <UButton
            v-if="!showResetConfirm"
            color="error"
            variant="soft"
            size="sm"
            icon="i-lucide-trash-2"
            :label="$t('apps.screenTime.resetData')"
            @click="showResetConfirm = true"
          />
          <div
            v-else
            class="flex gap-2"
          >
            <UButton
              color="error"
              size="sm"
              icon="i-lucide-check"
              :label="$t('apps.screenTime.confirm')"
              @click="confirmReset"
            />
            <UButton
              variant="ghost"
              size="sm"
              :label="$t('apps.screenTime.cancel')"
              @click="showResetConfirm = false"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 制限設定ダイアログ -->
  <UModal
    v-model:open="limitDialog"
    :title="$t('apps.screenTime.setLimit')"
  >
    <template #body>
      <div
        v-if="limitTarget"
        class="flex flex-col gap-4"
      >
        <p class="text-sm">
          {{ limitTarget.appName }} {{ $t('apps.screenTime.limitFor') }}
        </p>
        <div class="flex items-center gap-2">
          <UInput
            v-model="limitInput"
            type="number"
            :min="1"
            :max="1440"
            class="w-24"
          />
          <span class="text-sm text-muted">{{ $t('apps.screenTime.minuteUnit') }}</span>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-between w-full">
        <UButton
          v-if="screenTimeStore.limits.find(l => l.appId === limitTarget?.appId)"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          :label="$t('apps.screenTime.removeLimit')"
          @click="removeLimitAndClose"
        />
        <div class="flex gap-2 ml-auto">
          <UButton
            variant="ghost"
            :label="$t('apps.screenTime.cancel')"
            @click="limitDialog = false"
          />
          <UButton
            :label="$t('apps.screenTime.save')"
            @click="saveLimitDialog"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
