<script setup lang="ts">
const { windowId } = defineProps<{ windowId: string }>()
const { t } = useI18n()
const { saveState, loadState } = useDesktopStorage()

/** ブラウザタブの状態 */
interface BrowserTab {
  id: string
  url: string
  inputUrl: string
  title: string
  historyUrls: string[]
  historyIndex: number
  isLoading: boolean
}

/** ブックマークの型 */
interface Bookmark {
  url: string
  title: string
}

/** ブラウザ設定の型 */
interface BrowserSettings {
  homeUrl: string
}

const BOOKMARK_KEY = `browser-bookmarks-${windowId}`
const SETTINGS_KEY = `browser-settings-${windowId}`
const DEFAULT_HOME = 'https://example.com'

/** タブ一覧 */
const tabs = ref<BrowserTab[]>([createTab(DEFAULT_HOME)])
/** 現在アクティブなタブの ID */
const activeTabId = ref(tabs.value[0]?.id ?? '')
/** ブックマーク一覧 */
const bookmarks = ref<Bookmark[]>([])
/** ホームページ URL（設定画面で変更可） */
const homeUrl = ref(DEFAULT_HOME)
/** 設定画面を表示中か */
const showSettings = ref(false)
/** 設定画面で編集中の一時ホームページ URL */
const editingHomeUrl = ref(DEFAULT_HOME)

/** 現在のタブ */
const activeTab = computed<BrowserTab | undefined>(
  () => tabs.value.find(t => t.id === activeTabId.value)
)

/** 現在の URL が HTTPS かどうか */
const isSecure = computed(() => activeTab.value?.url.startsWith('https://') ?? false)

/** 現在の URL がブックマーク済みかどうか */
const isBookmarked = computed(() =>
  bookmarks.value.some(b => b.url === activeTab.value?.url)
)

/** 戻れるか */
const canGoBack = computed(() => {
  const tab = activeTab.value
  return tab != null && tab.historyIndex > 0
})

/** 進めるか */
const canGoForward = computed(() => {
  const tab = activeTab.value
  return tab != null && tab.historyIndex < tab.historyUrls.length - 1
})

/** 新しいタブを作成する */
function createTab(url: string): BrowserTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    url,
    inputUrl: url,
    title: url,
    historyUrls: [url],
    historyIndex: 0,
    isLoading: false
  }
}

/** 新しいタブを追加する */
function addTab(): void {
  const tab = createTab(homeUrl.value)
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

/** タブを閉じる（最後の1つは閉じない） */
function closeTab(id: string): void {
  if (tabs.value.length <= 1) return
  const idx = tabs.value.findIndex(t => t.id === id)
  if (idx === -1) return
  tabs.value.splice(idx, 1)
  if (activeTabId.value === id) {
    const next = tabs.value[Math.min(idx, tabs.value.length - 1)]
    if (next) activeTabId.value = next.id
  }
}

/** アドレスバーの内容でナビゲートする */
function navigate(): void {
  const tab = activeTab.value
  if (!tab) return
  let target = tab.inputUrl.trim()
  if (!target) return
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target
  applyNavigation(tab, target)
}

/** タブに URL をナビゲートする（履歴管理込み） */
function applyNavigation(tab: BrowserTab, url: string): void {
  tab.historyUrls.splice(tab.historyIndex + 1)
  tab.historyUrls.push(url)
  tab.historyIndex = tab.historyUrls.length - 1
  tab.url = url
  tab.inputUrl = url
  tab.title = url
  tab.isLoading = true
}

/** 戻る */
function goBack(): void {
  const tab = activeTab.value
  if (!tab || !canGoBack.value) return
  tab.historyIndex--
  const url = tab.historyUrls[tab.historyIndex]
  if (url) {
    tab.url = url
    tab.inputUrl = url
    tab.title = url
    tab.isLoading = true
  }
}

/** 進む */
function goForward(): void {
  const tab = activeTab.value
  if (!tab || !canGoForward.value) return
  tab.historyIndex++
  const url = tab.historyUrls[tab.historyIndex]
  if (url) {
    tab.url = url
    tab.inputUrl = url
    tab.title = url
    tab.isLoading = true
  }
}

/** リフレッシュ */
function refresh(): void {
  const tab = activeTab.value
  if (!tab) return
  tab.isLoading = true
  const url = tab.url
  tab.url = ''
  nextTick(() => {
    tab.url = url
  })
}

/** ホームに戻る */
function goHome(): void {
  const tab = activeTab.value
  if (!tab) return
  applyNavigation(tab, homeUrl.value)
}

/** iframe のロード完了ハンドラ */
function onIframeLoad(tab: BrowserTab): void {
  tab.isLoading = false
}

/** ブックマーク切り替え */
async function toggleBookmark(): Promise<void> {
  const tab = activeTab.value
  if (!tab) return
  const idx = bookmarks.value.findIndex(b => b.url === tab.url)
  if (idx !== -1) {
    bookmarks.value.splice(idx, 1)
  } else {
    bookmarks.value.push({ url: tab.url, title: tab.title })
  }
  await saveState(BOOKMARK_KEY, bookmarks.value)
}

/** ブックマークを開く */
function openBookmark(bm: Bookmark): void {
  const tab = activeTab.value
  if (!tab) return
  applyNavigation(tab, bm.url)
}

/** ブックマークを削除する */
async function removeBookmark(url: string): Promise<void> {
  const idx = bookmarks.value.findIndex(b => b.url === url)
  if (idx !== -1) {
    bookmarks.value.splice(idx, 1)
    await saveState(BOOKMARK_KEY, bookmarks.value)
  }
}

/** ブックマークドロップダウン項目 */
const bookmarkMenuItems = computed(() => {
  if (bookmarks.value.length === 0) {
    return [[{ label: t('apps.browser.noBookmarks'), disabled: true, icon: 'i-lucide-bookmark-x' }]]
  }
  return [bookmarks.value.map(bm => ({
    label: bm.title.length > 36 ? bm.title.slice(0, 34) + '…' : bm.title,
    icon: 'i-lucide-bookmark',
    children: [
      {
        label: t('apps.browser.removeBookmark'),
        icon: 'i-lucide-trash-2',
        onSelect: () => removeBookmark(bm.url)
      }
    ],
    onSelect: () => openBookmark(bm)
  }))]
})

/** 設定画面を開く */
function openSettings(): void {
  editingHomeUrl.value = homeUrl.value
  showSettings.value = true
}

/** 設定を保存して閉じる */
async function saveSettings(): Promise<void> {
  const trimmed = editingHomeUrl.value.trim()
  if (trimmed) {
    let url = trimmed
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    homeUrl.value = url
    editingHomeUrl.value = url
  }
  const settings: BrowserSettings = { homeUrl: homeUrl.value }
  await saveState(SETTINGS_KEY, settings)
  showSettings.value = false
}

onMounted(async () => {
  const [savedBookmarks, savedSettings] = await Promise.all([
    loadState<Bookmark[]>(BOOKMARK_KEY),
    loadState<BrowserSettings>(SETTINGS_KEY)
  ])
  if (savedBookmarks) bookmarks.value = savedBookmarks
  if (savedSettings?.homeUrl) {
    homeUrl.value = savedSettings.homeUrl
    // 初期タブのホームも更新
    const first = tabs.value[0]
    if (first && first.url === DEFAULT_HOME) {
      first.url = homeUrl.value
      first.inputUrl = homeUrl.value
      first.title = homeUrl.value
      first.historyUrls = [homeUrl.value]
    }
  }
})
</script>

<template>
  <div class="browser-app">
    <!-- タブバー -->
    <div class="tab-bar">
      <div class="tabs-scroll">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="['tab-btn', { 'tab-btn-active': tab.id === activeTabId }]"
          @click="activeTabId = tab.id"
        >
          <UIcon
            v-if="tab.isLoading"
            name="i-lucide-loader-circle"
            class="tab-loading-icon"
          />
          <span class="tab-title">{{ tab.title }}</span>
          <button
            v-if="tabs.length > 1"
            type="button"
            class="tab-close"
            :aria-label="$t('apps.browser.closeTab')"
            @click.stop="closeTab(tab.id)"
          >
            <UIcon name="i-lucide-x" />
          </button>
        </button>
      </div>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-plus"
        :aria-label="$t('apps.browser.newTab')"
        class="new-tab-btn"
        @click="addTab"
      />
    </div>

    <!-- ツールバー -->
    <div
      v-if="activeTab"
      class="toolbar"
    >
      <!-- ナビゲーションボタン -->
      <div class="nav-btns">
        <UTooltip :text="$t('apps.browser.back')">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-left"
            :disabled="!canGoBack"
            @click="goBack"
          />
        </UTooltip>
        <UTooltip :text="$t('apps.browser.forward')">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-right"
            :disabled="!canGoForward"
            @click="goForward"
          />
        </UTooltip>
        <UTooltip :text="$t('apps.browser.refresh')">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="activeTab.isLoading ? 'i-lucide-x' : 'i-lucide-refresh-cw'"
            @click="activeTab.isLoading ? (activeTab.isLoading = false) : refresh()"
          />
        </UTooltip>
        <UTooltip :text="$t('apps.browser.home')">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-house"
            @click="goHome"
          />
        </UTooltip>
      </div>

      <!-- アドレスバー -->
      <div class="address-bar">
        <UIcon
          :name="isSecure ? 'i-lucide-lock' : 'i-lucide-lock-open'"
          :class="['security-icon', isSecure ? 'security-icon-secure' : 'security-icon-insecure']"
        />
        <UInput
          v-model="activeTab.inputUrl"
          size="sm"
          :placeholder="$t('apps.browser.addressBar')"
          class="address-input"
          @keydown.enter.prevent="navigate"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </div>

      <!-- ブックマーク・設定操作 -->
      <div class="toolbar-actions">
        <UTooltip :text="isBookmarked ? $t('apps.browser.removeBookmark') : $t('apps.browser.addBookmark')">
          <UButton
            size="xs"
            :variant="isBookmarked ? 'soft' : 'ghost'"
            :color="isBookmarked ? 'warning' : 'neutral'"
            :icon="isBookmarked ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
            @click="toggleBookmark"
          />
        </UTooltip>
        <UDropdownMenu :items="bookmarkMenuItems">
          <UTooltip :text="$t('apps.browser.bookmarks')">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-chevron-down"
            />
          </UTooltip>
        </UDropdownMenu>
        <USeparator
          orientation="vertical"
          class="toolbar-sep"
        />
        <UTooltip :text="$t('apps.browser.settingsTitle')">
          <UButton
            size="xs"
            :variant="showSettings ? 'soft' : 'ghost'"
            :color="showSettings ? 'primary' : 'neutral'"
            icon="i-lucide-settings"
            @click="showSettings ? (showSettings = false) : openSettings()"
          />
        </UTooltip>
      </div>
    </div>

    <!-- 設定パネル（スライドオーバー） -->
    <Transition name="settings-slide">
      <div
        v-if="showSettings"
        class="settings-panel"
      >
        <div class="settings-header">
          <UIcon
            name="i-lucide-settings"
            class="settings-header-icon"
          />
          <h2 class="settings-title">
            {{ $t('apps.browser.settingsTitle') }}
          </h2>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="showSettings = false"
          />
        </div>

        <div class="settings-body">
          <!-- ホームページ設定 -->
          <div class="settings-section">
            <label class="settings-label">{{ $t('apps.browser.settingsHomepage') }}</label>
            <div class="settings-homepage-row">
              <UInput
                v-model="editingHomeUrl"
                size="sm"
                icon="i-lucide-house"
                placeholder="https://example.com"
                class="settings-homepage-input"
                @keydown.enter.prevent="saveSettings"
              />
              <UButton
                size="sm"
                color="primary"
                variant="solid"
                :label="$t('apps.browser.settingsSave')"
                @click="saveSettings"
              />
            </div>
          </div>

          <!-- サンドボックス注意事項 -->
          <UAlert
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :description="$t('apps.browser.settingsSandboxInfo')"
            class="settings-alert"
          />
        </div>
      </div>
    </Transition>

    <!-- iframe エリア -->
    <div class="frame-area">
      <template
        v-for="tab in tabs"
        :key="tab.id"
      >
        <iframe
          v-show="tab.id === activeTabId && !showSettings"
          :src="tab.url"
          class="browser-frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          :title="tab.title"
          @load="onIframeLoad(tab)"
        />
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.browser-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ---- タブバー ----
.tab-bar {
  display: flex;
  align-items: center;
  background: var(--ui-bg);
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
  min-height: 2rem;
  overflow: hidden;
}

.tabs-scroll {
  display: flex;
  flex: 1 1 0%;
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: none;
  border-right: 1px solid var(--ui-border);
  background: transparent;
  color: var(--ui-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  white-space: nowrap;
  min-width: 6rem;
  max-width: 11rem;
  flex-shrink: 0;
  transition: background 0.12s;

  &:hover { background: var(--ui-bg-elevated); }
  &.tab-btn-active {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
    border-bottom-color: var(--ui-bg-elevated);
  }
}

.tab-loading-icon {
  flex-shrink: 0;
  font-size: 0.75rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tab-title {
  flex: 1 1 0%;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.tab-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: none;
  background: transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  font-size: 0.625rem;
  padding: 0;

  &:hover { opacity: 1; background: var(--ui-bg-accented); }
}

.new-tab-btn {
  flex-shrink: 0;
  margin: 0 0.25rem;
}

// ---- ツールバー ----
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3125rem 0.5rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;

  @container (max-width: 480px) {
    gap: 0.125rem;
    padding: 0.25rem 0.375rem;
  }
}

.nav-btns {
  display: flex;
  gap: 0.125rem;
  flex-shrink: 0;

  // 極小ウィンドウではホームボタンを非表示
  @container (max-width: 360px) {
    :last-child { display: none; }
  }
}

.address-bar {
  display: flex;
  align-items: center;
  flex: 1 1 0%;
  min-width: 0;
  gap: 0.375rem;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: calc(var(--ui-radius) * 1.5);
  padding: 0 0.5rem;

  .address-input {
    flex: 1 1 0%;
    :deep(input) {
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      padding-inline: 0;
      font-size: 0.8125rem;
    }
  }
}

.security-icon {
  flex-shrink: 0;
  font-size: 0.75rem;
  &.security-icon-secure { color: var(--color-green-500); }
  &.security-icon-insecure { color: var(--ui-text-muted); }
}

.toolbar-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  align-items: center;
}

.toolbar-sep {
  margin-inline: 0.125rem;
  height: 1.25rem;
}

// ---- 設定パネル ----
.settings-panel {
  position: absolute;
  top: calc(2rem + 2.25rem); // タブバー + ツールバー分
  right: 0;
  width: min(320px, 100%);
  background: var(--ui-bg-elevated);
  border-left: 1px solid var(--ui-border);
  border-bottom: 1px solid var(--ui-border);
  border-radius: 0 0 0 0.75rem;
  box-shadow: -4px 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 10;
  overflow: hidden;

  @container (max-width: 400px) {
    width: 100%;
    border-radius: 0;
    border-left: none;
  }
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg);
}

.settings-header-icon {
  font-size: 1rem;
  color: var(--ui-primary);
  flex-shrink: 0;
}

.settings-title {
  flex: 1 1 0%;
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0;
}

.settings-body {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.settings-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ui-text-muted);
}

.settings-homepage-row {
  display: flex;
  gap: 0.375rem;
  align-items: center;

  .settings-homepage-input {
    flex: 1 1 0%;
    min-width: 0;
  }
}

.settings-alert {
  font-size: 0.8125rem;
}

// ---- フレーム ----
.frame-area {
  flex: 1 1 0%;
  min-height: 0;
  position: relative;
}

.browser-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
  display: block;
}

// ---- Transitions ----
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.settings-slide-enter-from,
.settings-slide-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
</style>
