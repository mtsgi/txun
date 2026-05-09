<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()

/** アクティブなタブ */
const activeTab = ref('clock')

// ─── 時計 ─────────────────────────────────────────
/** 現在時刻 */
const now = ref(new Date())
let clockInterval: ReturnType<typeof setInterval> | null = null

/** 時刻を HH:mm:ss 形式で返す */
const timeStr = computed(() => now.value.toLocaleTimeString('ja-JP', { hour12: false }))
/** 日付文字列 */
const dateStr = computed(() => now.value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))

// ─── ストップウォッチ ────────────────────────────────
/** 経過ミリ秒 */
const swElapsed = ref(0)
/** ストップウォッチ動作中か */
const swRunning = ref(false)
/** ラップ一覧 */
const swLaps = ref<number[]>([])
let swInterval: ReturnType<typeof setInterval> | null = null
let swLastStart = 0

/** 経過時間を mm:ss.cc 形式で返す */
function formatElapsed(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/** ストップウォッチを開始/停止する */
function swToggle(): void {
  if (swRunning.value) {
    clearInterval(swInterval!)
    swInterval = null
    swRunning.value = false
  } else {
    swLastStart = Date.now() - swElapsed.value
    swInterval = setInterval(() => { swElapsed.value = Date.now() - swLastStart }, 50)
    swRunning.value = true
  }
}

/** ラップを記録する */
function swLap(): void {
  swLaps.value.push(swElapsed.value)
}

/** ストップウォッチをリセットする */
function swReset(): void {
  clearInterval(swInterval!)
  swInterval = null
  swRunning.value = false
  swElapsed.value = 0
  swLaps.value = []
}

// ─── タイマー ──────────────────────────────────────
/** タイマーの分入力 */
const timerMinutes = ref(0)
/** タイマーの秒入力 */
const timerSeconds = ref(0)
/** タイマーの残り秒数 */
const timerRemaining = ref(0)
/** タイマー動作中か */
const timerRunning = ref(false)
/** タイマーセット済みか */
const timerStarted = ref(false)
let timerInterval: ReturnType<typeof setInterval> | null = null

/** タイマーを開始する */
function timerStart(): void {
  if (!timerStarted.value) {
    timerRemaining.value = timerMinutes.value * 60 + timerSeconds.value
    timerStarted.value = true
  }
  if (timerRemaining.value <= 0) return
  timerInterval = setInterval(() => {
    timerRemaining.value--
    if (timerRemaining.value <= 0) {
      clearInterval(timerInterval!)
      timerInterval = null
      timerRunning.value = false
      notify(t('apps.clock.timerFinished'), { type: 'success', icon: 'i-lucide-bell' })
    }
  }, 1000)
  timerRunning.value = true
}

/** タイマーを停止する */
function timerPause(): void {
  clearInterval(timerInterval!)
  timerInterval = null
  timerRunning.value = false
}

/** タイマーをリセットする */
function timerReset(): void {
  clearInterval(timerInterval!)
  timerInterval = null
  timerRunning.value = false
  timerStarted.value = false
  timerRemaining.value = 0
}

/** 残り時間を mm:ss 形式で返す */
const timerDisplay = computed(() => {
  const m = Math.floor(timerRemaining.value / 60)
  const s = timerRemaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

/** タイマーの進捗率 */
const timerProgress = computed(() => {
  const total = timerMinutes.value * 60 + timerSeconds.value
  if (total === 0) return 0
  return ((total - timerRemaining.value) / total) * 100
})

// ─── タブ定義 ──────────────────────────────────────
const tabs = computed(() => [
  { value: 'clock', label: t('apps.clock.tabClock') },
  { value: 'stopwatch', label: t('apps.clock.tabStopwatch') },
  { value: 'timer', label: t('apps.clock.tabTimer') }
])

// ─── コンテナ幅によるレスポンシブ判定 ────────────────
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(380)

onMounted(() => {
  // 時計インターバル開始
  clockInterval = setInterval(() => { now.value = new Date() }, 1000)

  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) containerWidth.value = entry.contentRect.width
  })
  ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
  if (swInterval) clearInterval(swInterval)
  if (timerInterval) clearInterval(timerInterval)
})

/** 幅が 340px 未満をコンパクトモードと判定 */
const isCompact = computed(() => containerWidth.value < 340)
</script>

<template>
  <div
    ref="containerRef"
    class="clock-app"
    :class="{ compact: isCompact }"
  >
    <UTabs
      v-model="activeTab"
      :items="tabs"
      class="clock-tabs"
    >
      <template #content="{ item }">
        <!-- 時計タブ -->
        <div
          v-if="item.value === 'clock'"
          class="tab-panel clock-panel"
        >
          <div class="clock-time">
            {{ timeStr }}
          </div>
          <div class="clock-date">
            {{ dateStr }}
          </div>
        </div>

        <!-- ストップウォッチタブ -->
        <div
          v-if="item.value === 'stopwatch'"
          class="tab-panel sw-panel"
        >
          <div class="sw-display">
            {{ formatElapsed(swElapsed) }}
          </div>
          <div class="sw-controls">
            <UButton
              :label="swRunning ? t('apps.clock.stop') : t('apps.clock.start')"
              :color="swRunning ? 'error' : 'success'"
              variant="solid"
              @click="swToggle"
            />
            <UButton
              :label="t('apps.clock.lap')"
              color="neutral"
              variant="outline"
              :disabled="!swRunning"
              @click="swLap"
            />
            <UButton
              :label="t('apps.clock.reset')"
              color="neutral"
              variant="ghost"
              :disabled="swRunning"
              @click="swReset"
            />
          </div>
          <div
            v-if="swLaps.length"
            class="sw-laps"
          >
            <div
              v-for="(lap, i) in [...swLaps].reverse()"
              :key="i"
              class="sw-lap"
            >
              <span class="lap-num">{{ t('apps.clock.lapLabel') }} {{ swLaps.length - i }}</span>
              <span class="lap-time">{{ formatElapsed(lap) }}</span>
            </div>
          </div>
        </div>

        <!-- タイマータブ -->
        <div
          v-if="item.value === 'timer'"
          class="tab-panel timer-panel"
        >
          <div class="timer-display">
            {{ timerStarted ? timerDisplay : `${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}` }}
          </div>
          <div
            v-if="timerStarted"
            class="timer-progress-bar"
          >
            <div
              class="timer-progress-fill"
              :style="{ width: `${timerProgress}%` }"
            />
          </div>
          <div
            v-if="!timerStarted"
            class="timer-inputs"
          >
            <UFormField :label="t('apps.clock.minutes')">
              <UInput
                v-model.number="timerMinutes"
                type="number"
                :min="0"
                :max="99"
                class="timer-input"
              />
            </UFormField>
            <span class="timer-colon">:</span>
            <UFormField :label="t('apps.clock.seconds')">
              <UInput
                v-model.number="timerSeconds"
                type="number"
                :min="0"
                :max="59"
                class="timer-input"
              />
            </UFormField>
          </div>
          <div class="timer-controls">
            <UButton
              v-if="!timerRunning"
              :label="timerStarted ? t('apps.clock.resume') : t('apps.clock.start')"
              color="success"
              variant="solid"
              :disabled="!timerStarted && (timerMinutes === 0 && timerSeconds === 0)"
              @click="timerStart"
            />
            <UButton
              v-else
              :label="t('apps.clock.stop')"
              color="warning"
              variant="solid"
              @click="timerPause"
            />
            <UButton
              :label="t('apps.clock.reset')"
              color="neutral"
              variant="ghost"
              @click="timerReset"
            />
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<style scoped>
.clock-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
}

.clock-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  gap: 20px;
  flex: 1;
}

.compact .tab-panel {
  padding: 20px 16px;
  gap: 14px;
}

/* 時計 */
.clock-time {
  font-size: 4rem;
  font-weight: 200;
  letter-spacing: 0.05em;
  color: var(--ui-text-highlighted);
  font-variant-numeric: tabular-nums;
}

.compact .clock-time {
  font-size: 2.8rem;
}

.clock-date {
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}

/* ストップウォッチ */
.sw-display {
  font-size: 3rem;
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-highlighted);
}

.compact .sw-display {
  font-size: 2.2rem;
}

.sw-controls, .timer-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.sw-laps {
  width: 100%;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  padding: 4px 0;
}

.sw-lap {
  display: flex;
  justify-content: space-between;
  padding: 6px 14px;
  font-size: 0.85rem;
}

.sw-lap:not(:last-child) {
  border-bottom: 1px solid var(--ui-border);
}

.lap-num { color: var(--ui-text-muted); }
.lap-time { font-variant-numeric: tabular-nums; font-weight: 500; }

/* タイマー */
.timer-display {
  font-size: 3.5rem;
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-highlighted);
}

.compact .timer-display {
  font-size: 2.5rem;
}

.timer-progress-bar {
  width: 100%;
  max-width: 280px;
  height: 6px;
  background: var(--ui-bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.timer-progress-fill {
  height: 100%;
  background: var(--ui-color-primary-500);
  transition: width 1s linear;
}

.timer-inputs {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.timer-colon {
  font-size: 1.5rem;
  padding-bottom: 4px;
  color: var(--ui-text-muted);
}

.timer-input {
  width: 72px;
}
</style>
