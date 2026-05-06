<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'
import type { LauncherFolder, AppMeta } from '../../stores/desktop'

const props = defineProps<{
  /** 表示対象のフォルダー */
  folder: LauncherFolder
  /** フォルダーに含まれる解決済みアプリ一覧 */
  apps: AppMeta[]
}>()

const emit = defineEmits<{
  /** フォルダー内アプリが選択されたとき */
  appSelect: [app: AppMeta]
}>()

const store = useDesktopStore()
const { t } = useI18n()

/** フォルダーが展開中かどうか */
const isExpanded = ref(false)
/** 名前変更インライン編集モード */
const isRenaming = ref(false)
/** 名前変更用の一時テキスト */
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

/** フォルダーのサムネイルに使う先頭 4 アイコン */
const thumbnailIcons = computed(() => props.apps.slice(0, 4).map(a => a.icon))

/** コンテキストメニュー項目 */
const contextMenuItems = computed(() => [
  [
    {
      label: t('core.desktop.launcher.folder_rename'),
      icon: 'i-lucide-pencil',
      onSelect: startRename
    },
    {
      label: t('core.desktop.launcher.folder_delete'),
      icon: 'i-lucide-trash-2',
      onSelect: () => store.deleteLauncherFolder(props.folder.id)
    }
  ]
])

/** 名前変更モードを開始する */
function startRename(): void {
  renameText.value = props.folder.name
  isRenaming.value = true
  nextTick(() => renameInput.value?.focus())
}

/** 名前変更を確定する */
function commitRename(): void {
  const trimmed = renameText.value.trim()
  if (trimmed) {
    store.renameLauncherFolder(props.folder.id, trimmed)
  }
  isRenaming.value = false
}

/** 名前変更をキャンセルする */
function cancelRename(): void {
  isRenaming.value = false
}
</script>

<template>
  <UContextMenu :items="contextMenuItems">
    <div class="launcher-folder">
      <!-- フォルダーヘッダー（サムネイル＋名前） -->
      <button
        type="button"
        class="folder-header"
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
      >
        <!-- 2×2 アイコングリッドのサムネイル -->
        <div class="folder-thumb">
          <div class="thumb-grid">
            <UIcon
              v-for="(icon, i) in thumbnailIcons"
              :key="i"
              :name="icon"
              class="thumb-icon"
            />
            <!-- 4 個に満たない場合は空セルで埋める -->
            <div
              v-for="i in Math.max(0, 4 - thumbnailIcons.length)"
              :key="`empty-${i}`"
              class="thumb-empty"
            />
          </div>
        </div>

        <!-- フォルダー名（インライン編集 or 表示） -->
        <div
          class="folder-name"
          @click.stop
        >
          <UInput
            v-if="isRenaming"
            ref="renameInput"
            v-model="renameText"
            size="xs"
            class="rename-input"
            @blur="commitRename"
            @keydown.enter.prevent="commitRename"
            @keydown.escape.prevent="cancelRename"
            @click.stop
          />
          <span
            v-else
            class="folder-name-text"
          >{{ folder.name }}</span>
        </div>

        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="folder-chevron"
        />
      </button>

      <!-- 展開コンテンツ（アプリ一覧） -->
      <Transition name="folder-expand">
        <div
          v-if="isExpanded"
          class="folder-apps"
        >
          <button
            v-for="app in apps"
            :key="app.id"
            type="button"
            class="folder-app-btn"
            @click="emit('appSelect', app)"
          >
            <UIcon
              :name="app.icon"
              class="app-icon"
            />
            <span class="app-name">{{ $t(app.nameKey) }}</span>
          </button>
        </div>
      </Transition>
    </div>
  </UContextMenu>
</template>

<style lang="scss" scoped>
.launcher-folder {
  width: 100%;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ui-bg-elevated) 80%, transparent);
  }
}

.folder-thumb {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--ui-primary) 20%, var(--ui-bg-elevated));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
}

.thumb-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: 100%;
  height: 100%;
}

.thumb-icon {
  font-size: 0.625rem;
  opacity: 0.85;
}

.thumb-empty {
  // placeholder for missing icons
}

.folder-name {
  flex: 1 1 0%;
  min-width: 0;
}

.folder-name-text {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.rename-input {
  width: 100%;
}

.folder-chevron {
  flex-shrink: 0;
  font-size: 0.875rem;
  opacity: 0.6;
}

// 展開コンテンツ
.folder-apps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
  padding: 0.375rem 0.25rem 0.25rem;
}

.folder-app-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.25rem;
  border-radius: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ui-bg-elevated) 80%, transparent);
  }
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
}

// Transition
.folder-expand-enter-active,
.folder-expand-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
  max-height: 200px;
}

.folder-expand-enter-from,
.folder-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
