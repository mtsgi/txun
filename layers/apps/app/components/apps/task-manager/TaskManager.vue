<script setup lang="ts">
import type { WindowState, VirtualDesktop } from '../../../../../core/app/stores/desktop'

defineProps<{ windowId: string }>()

const store = useDesktopStore()
const { t } = useI18n()

/** 現在表示中のタブ */
const activeTab = ref<'windows' | 'virtualDesktops' | 'system'>('windows')

const tabItems = computed(() => [
  { key: 'windows' as const, label: t('apps.taskManager.windows'), icon: 'i-lucide-layout-dashboard' },
  { key: 'virtualDesktops' as const, label: t('apps.taskManager.virtualDesktops'), icon: 'i-lucide-monitor' },
  { key: 'system' as const, label: t('apps.taskManager.system'), icon: 'i-lucide-cpu' }
])

/** ウィンドウのステータス文字列を返す */
function getWindowStatus(win: WindowState): string {
  if (win.isMinimized) return t('apps.taskManager.statusMinimized')
  if (win.isMaximized) return t('apps.taskManager.statusMaximized')
  return t('apps.taskManager.statusNormal')
}

/** ウィンドウのアプリ color を返す */
function getWindowColor(win: WindowState): string {
  return store.apps.find(a => a.id === win.appId)?.color ?? 'neutral'
}

/** 仮想デスクトップ内のウィンドウ数を返す */
function getDesktopWindowCount(desktop: VirtualDesktop): number {
  return store.windows.filter(w => w.virtualDesktopId === desktop.id).length
}

/** performance.memory の型定義 */
interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

/** performance.memory（Chrome 限定）への型安全アクセス */
function getPerformanceMemory(): PerformanceMemory | null {
  const mem = (performance as unknown as { memory?: PerformanceMemory }).memory
  return mem ?? null
}

/** メモリ情報（リアクティブ更新用） */
const memoryInfo = ref<PerformanceMemory | null>(getPerformanceMemory())

/** MB 表記にフォーマットする */
function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/** 使用率（0〜100）を計算する */
function heapUsagePercent(mem: PerformanceMemory): number {
  if (mem.jsHeapSizeLimit === 0) return 0
  return Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100)
}

// 2秒ごとにメモリ情報を更新
onMounted(() => {
  const timer = setInterval(() => {
    memoryInfo.value = getPerformanceMemory()
  }, 2000)
  onUnmounted(() => clearInterval(timer))
})
</script>

<template>
  <div class="task-manager">
    <!-- タブナビゲーション -->
    <div class="tab-nav">
      <button
        v-for="tab in tabItems"
        :key="tab.key"
        type="button"
        :class="['tab-nav-btn', { 'tab-nav-btn-active': activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <UIcon
          :name="tab.icon"
          class="tab-nav-icon"
        />
        <span class="tab-nav-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- コンテンツ -->
    <div class="tab-content">
      <!-- ウィンドウ一覧 -->
      <template v-if="activeTab === 'windows'">
        <p
          v-if="store.windows.length === 0"
          class="empty-msg"
        >
          {{ $t('apps.taskManager.noWindows') }}
        </p>
        <div
          v-else
          class="window-list"
        >
          <!-- テーブルヘッダー（PC のみ） -->
          <div class="window-row window-row-header">
            <span class="col-app">{{ $t('apps.taskManager.appName') }}</span>
            <span class="col-status hide-mobile">{{ $t('apps.taskManager.status') }}</span>
            <span class="col-desktop hide-mobile">{{ $t('apps.taskManager.desktop') }}</span>
            <span class="col-actions" />
          </div>

          <div
            v-for="win in store.windows"
            :key="win.id"
            class="window-row"
          >
            <!-- アプリアイコン＋タイトル -->
            <div class="col-app">
              <div
                class="win-icon-wrap"
                :style="{ background: `color-mix(in srgb, var(--color-${getWindowColor(win)}-500) 20%, var(--ui-bg))` }"
              >
                <UIcon
                  :name="win.icon"
                  class="win-icon"
                  :style="{ color: `var(--color-${getWindowColor(win)}-500)` }"
                />
              </div>
              <span class="win-title">{{ win.nameKey ? $t(win.nameKey) : win.title }}</span>
            </div>

            <!-- ステータス -->
            <span class="col-status hide-mobile">
              <UBadge
                :label="getWindowStatus(win)"
                variant="soft"
                :color="win.isMinimized ? 'neutral' : win.isMaximized ? 'primary' : 'success'"
                size="xs"
              />
            </span>

            <!-- 所属デスクトップ -->
            <span class="col-desktop hide-mobile text-muted">
              {{ store.virtualDesktops.find(d => d.id === win.virtualDesktopId)?.name ?? '' }}
            </span>

            <!-- 操作ボタン -->
            <div class="col-actions">
              <UTooltip :text="$t('apps.taskManager.minimize')">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-minus"
                  :disabled="win.isMinimized"
                  @click="store.minimizeWindow(win.id)"
                />
              </UTooltip>
              <UTooltip :text="$t('apps.taskManager.close')">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-x"
                  @click="store.closeWindow(win.id)"
                />
              </UTooltip>
            </div>
          </div>
        </div>
      </template>

      <!-- 仮想デスクトップ一覧 -->
      <template v-else-if="activeTab === 'virtualDesktops'">
        <div class="desktop-list">
          <div
            v-for="desktop in store.virtualDesktops"
            :key="desktop.id"
            :class="['desktop-card', { 'desktop-card-active': desktop.id === store.activeVirtualDesktopId }]"
          >
            <UIcon
              name="i-lucide-monitor"
              class="desktop-icon"
            />
            <div class="desktop-info">
              <p class="desktop-name">
                {{ desktop.name }}
              </p>
              <p class="desktop-count">
                {{ $t('apps.taskManager.windowCount') }}: {{ getDesktopWindowCount(desktop) }}
              </p>
            </div>
            <UBadge
              v-if="desktop.id === store.activeVirtualDesktopId"
              label="Active"
              color="primary"
              variant="soft"
              size="xs"
            />
          </div>
        </div>
      </template>

      <!-- システム情報 -->
      <template v-else-if="activeTab === 'system'">
        <div
          v-if="memoryInfo"
          class="system-info"
        >
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">{{ $t('apps.taskManager.heapUsed') }}</span>
              <span class="info-value">{{ formatMB(memoryInfo.usedJSHeapSize) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t('apps.taskManager.heapTotal') }}</span>
              <span class="info-value">{{ formatMB(memoryInfo.totalJSHeapSize) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t('apps.taskManager.heapLimit') }}</span>
              <span class="info-value">{{ formatMB(memoryInfo.jsHeapSizeLimit) }}</span>
            </div>
            <!-- 使用率プログレスバー -->
            <div class="heap-usage-row">
              <div class="heap-bar-track">
                <div
                  class="heap-bar"
                  :style="{ width: `${heapUsagePercent(memoryInfo)}%` }"
                />
              </div>
              <span class="heap-percent">{{ heapUsagePercent(memoryInfo) }}%</span>
            </div>
          </div>
        </div>
        <p
          v-else
          class="empty-msg"
        >
          {{ $t('apps.taskManager.memoryUnavailable') }}
        </p>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.task-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ---- タブナビゲーション ----
.tab-nav {
  display: flex;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.tab-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;

  &:hover { color: var(--ui-text); }

  &.tab-nav-btn-active {
    color: var(--ui-primary);
    border-bottom-color: var(--ui-primary);
  }
}

.tab-nav-icon {
  font-size: 0.875rem;
}

.tab-nav-label {
  // 狭いウィンドウではアイコンのみ表示
  @container (max-width: 400px) {
    display: none;
  }
}

// ---- コンテンツ ----
.tab-content {
  flex: 1 1 0%;
  overflow-y: auto;
  padding: 0.75rem;
}

.empty-msg {
  text-align: center;
  color: var(--ui-text-muted);
  font-size: 0.875rem;
  padding: 2.5rem 0;
}

// ---- ウィンドウ一覧 ----
.window-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.window-row {
  display: grid;
  grid-template-columns: 1fr auto 8rem 5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;

  &:not(.window-row-header):hover {
    background: var(--ui-bg-elevated);
  }

  // 狭いウィンドウ: デスクトップ・ステータス列を非表示
  @container (max-width: 520px) {
    grid-template-columns: 1fr 4rem;
  }
}

.window-row-header {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-text-muted);
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--ui-border);
  margin-bottom: 0.125rem;
}

// 狭いウィンドウで非表示の列
.hide-mobile {
  @container (max-width: 520px) {
    display: none !important;
  }
}

.col-app {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.col-status {
  display: flex;
  align-items: center;
}

.col-desktop {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.125rem;
}

.text-muted {
  color: var(--ui-text-muted);
}

.win-icon-wrap {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.win-icon {
  font-size: 0.875rem;
}

.win-title {
  font-size: 0.8125rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

// ---- 仮想デスクトップ一覧 ----
.desktop-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.desktop-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  transition: border-color 0.15s;

  &.desktop-card-active {
    border-color: var(--ui-primary);
  }
}

.desktop-icon {
  font-size: 1.25rem;
  color: var(--ui-primary);
  flex-shrink: 0;
}

.desktop-info {
  flex: 1 1 0%;
  min-width: 0;
}

.desktop-name {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.desktop-count {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  margin: 0;
}

// ---- システム情報 ----
.system-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-card {
  border: 1px solid var(--ui-border);
  border-radius: 0.625rem;
  padding: 0.875rem 1rem;
  background: var(--ui-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}

.info-label {
  color: var(--ui-text-muted);
}

.info-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.heap-usage-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.heap-bar-track {
  flex: 1 1 0%;
  height: 0.5rem;
  background: var(--ui-bg-accented);
  border-radius: 9999px;
  overflow: hidden;
}

.heap-bar {
  height: 100%;
  background: var(--ui-primary);
  border-radius: 9999px;
  transition: width 0.4s ease;
  max-width: 100%;
}

.heap-percent {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 2.5rem;
  text-align: right;
}
</style>
