<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import type { AppMeta } from '../../stores/desktop'

const props = defineProps<{
  /** モバイルモードかどうか（true: 全画面, false: パネル） */
  isMobile: boolean
  /** 画面幅（px） */
  screenWidth: number
}>()

const store = useDesktopStore()
const { closeLauncher, searchQuery } = useLauncher()
const { t } = useI18n()

const searchInputRef = ref<HTMLInputElement | null>(null)

/** 検索クエリでフィルタリングされたアプリ一覧 */
const filteredApps = computed<AppMeta[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return store.apps
  return store.apps.filter(app =>
    app.name.toLowerCase().includes(q) || t(app.nameKey).toLowerCase().includes(q)
  )
})

/** フォルダー未所属のアプリ一覧 */
const unfolderedApps = computed<AppMeta[]>(() => {
  const assignedIds = new Set(
    store.launcherFolders.flatMap(f => f.appIds)
  )
  return store.apps.filter(app => !assignedIds.has(app.id))
})

/** フォルダーごとの解決済みアプリ一覧 */
const resolvedFolders = computed(() =>
  store.launcherFolders.map(folder => ({
    folder,
    apps: folder.appIds
      .map(id => store.apps.find(a => a.id === id))
      .filter((a): a is AppMeta => a !== undefined)
  }))
)

/** アプリのコンテキストメニュー項目を生成する */
function getAppContextItems(app: AppMeta, folderId?: string) {
  const folderItems = store.launcherFolders.map(f => ({
    label: f.name,
    icon: 'i-lucide-folder',
    disabled: f.appIds.includes(app.id),
    onSelect: () => store.addAppToFolder(f.id, app.id)
  }))

  const baseItems = [
    {
      label: t('core.desktop.launcher.open'),
      icon: 'i-lucide-external-link',
      onSelect: () => handleAppOpen(app)
    }
  ]

  const folderActions = [
    ...(folderItems.length > 0
      ? [{ label: t('core.desktop.launcher.add_to_folder'), icon: 'i-lucide-folder-plus', children: folderItems }]
      : []),
    {
      label: t('core.desktop.launcher.new_folder'),
      icon: 'i-lucide-folder-plus',
      onSelect: () => {
        store.createLauncherFolder(t('core.desktop.launcher.new_folder'))
        const newFolder = store.launcherFolders[store.launcherFolders.length - 1]
        if (newFolder) store.addAppToFolder(newFolder.id, app.id)
      }
    },
    ...(folderId
      ? [{
          label: t('core.desktop.launcher.remove_from_folder'),
          icon: 'i-lucide-folder-minus',
          onSelect: () => store.removeAppFromFolder(folderId, app.id)
        }]
      : [])
  ]

  return [baseItems, folderActions]
}

/** アプリを開いてランチャーを閉じる */
function handleAppOpen(app: AppMeta): void {
  store.openWindow(app)
  closeLauncher()
}

/** オーバーレイクリックでランチャーを閉じる（SP 時） */
function onOverlayClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    closeLauncher()
  }
}

// ランチャーが開いたら検索欄にフォーカス
onMounted(() => {
  nextTick(() => searchInputRef.value?.focus())
})
</script>

<template>
  <div
    :class="['launcher-root', isMobile ? 'launcher-fullscreen' : 'launcher-panel']"
    @click="isMobile ? onOverlayClick($event) : undefined"
  >
    <div
      :class="['launcher-content', isMobile ? 'launcher-content-fullscreen' : 'launcher-content-panel']"
      @click.stop
    >
      <!-- 検索バー -->
      <div class="launcher-search">
        <UInput
          ref="searchInputRef"
          v-model="searchQuery"
          :placeholder="$t('core.desktop.launcher.search_placeholder')"
          icon="i-lucide-search"
          size="md"
          class="search-input"
          @keydown.escape.prevent="closeLauncher"
        />
      </div>

      <!-- スクロール可能なコンテンツ領域 -->
      <div class="launcher-body">
        <!-- 検索中: フラットにフィルタリング表示 -->
        <template v-if="searchQuery.trim()">
          <div class="apps-grid">
            <UContextMenu
              v-for="app in filteredApps"
              :key="app.id"
              :items="getAppContextItems(app)"
            >
              <button
                type="button"
                class="app-btn"
                @click="handleAppOpen(app)"
              >
                <div class="app-icon-wrap">
                  <UIcon
                    :name="app.icon"
                    class="app-icon"
                  />
                </div>
                <span class="app-name">{{ $t(app.nameKey) }}</span>
              </button>
            </UContextMenu>
          </div>
          <p
            v-if="filteredApps.length === 0"
            class="no-results"
          >
            {{ searchQuery.trim() }}
          </p>
        </template>

        <!-- 通常表示: フォルダー + 未所属アプリ -->
        <template v-else>
          <!-- フォルダー一覧 -->
          <div
            v-if="resolvedFolders.length > 0"
            class="folder-list"
          >
            <DesktopLauncherFolder
              v-for="{ folder, apps } in resolvedFolders"
              :key="folder.id"
              :folder="folder"
              :apps="apps"
              @app-select="handleAppOpen"
            />
          </div>

          <!-- 未所属アプリ -->
          <div
            v-if="unfolderedApps.length > 0"
            class="apps-section"
          >
            <p
              v-if="resolvedFolders.length > 0"
              class="section-label"
            >
              {{ $t('core.desktop.launcher.all_apps') }}
            </p>
            <div class="apps-grid">
              <UContextMenu
                v-for="app in unfolderedApps"
                :key="app.id"
                :items="getAppContextItems(app)"
              >
                <button
                  type="button"
                  class="app-btn"
                  @click="handleAppOpen(app)"
                >
                  <div class="app-icon-wrap">
                    <UIcon
                      :name="app.icon"
                      class="app-icon"
                    />
                  </div>
                  <span class="app-name">{{ $t(app.nameKey) }}</span>
                </button>
              </UContextMenu>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// ---- PC: パネルモード ----
.launcher-panel {
  position: absolute;
  bottom: 48px;
  left: 0;
  z-index: 900;
  padding: 0.25rem;
}

.launcher-content-panel {
  width: 320px;
  max-height: calc(100vh - 64px);
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg-elevated) 92%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// ---- SP: 全画面モード ----
.launcher-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-end;
}

.launcher-content-fullscreen {
  width: 100%;
  max-height: 85vh;
  border-radius: 1.25rem 1.25rem 0 0;
  background: var(--ui-bg-elevated);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// ---- 共通 ----
.launcher-search {
  padding: 0.75rem 0.75rem 0.5rem;
  flex-shrink: 0;

  .search-input {
    width: 100%;
  }
}

.launcher-body {
  flex: 1 1 0%;
  overflow-y: auto;
  padding: 0.25rem 0.5rem 0.75rem;
  overscroll-behavior: contain;
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 0.5rem;
}

.apps-section {
  // no extra margin
}

.section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ui-text-muted);
  padding: 0.25rem 0.375rem 0.375rem;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
}

.app-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.25rem;
  border-radius: 0.625rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  width: 100%;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
  }

  &:active {
    background: color-mix(in srgb, var(--ui-primary) 20%, transparent);
  }
}

.app-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--ui-bg-inverted) 8%, var(--ui-bg));
  border: 1px solid var(--ui-border);
}

.app-icon {
  font-size: 1.25rem;
}

.app-name {
  font-size: 0.625rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
}

.no-results {
  text-align: center;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  padding: 2rem 0;

  &::before {
    content: '"';
  }
  &::after {
    content: '" に一致するアプリはありません';
  }
}
</style>
