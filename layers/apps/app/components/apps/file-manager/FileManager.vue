<script setup lang="ts">
defineProps<{ windowId: string }>()

interface FSEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  modified?: Date
}

const currentPath = ref('/')
const selectedItem = ref<string | null>(null)
const showSidebar = ref(true)

const { t } = useI18n()

const fsTree: Record<string, FSEntry[]> = {
  '/': [
    { name: 'Desktop', type: 'dir' },
    { name: 'Documents', type: 'dir' },
    { name: 'Downloads', type: 'dir' }
  ],
  '/Desktop': [
    { name: 'README.txt', type: 'file', size: 128, modified: new Date() }
  ],
  '/Documents': [],
  '/Downloads': []
}

const entries = computed<FSEntry[]>(() => fsTree[currentPath.value] ?? [])

/** UBreadcrumb 用リンク配列 */
const breadcrumbLinks = computed(() => {
  if (currentPath.value === '/') {
    return [{ label: '/', onClick: () => goTo('/') }]
  }
  const parts = currentPath.value.slice(1).split('/')
  return [
    { label: '/', onClick: () => goTo('/') },
    ...parts.map((part, i) => ({
      label: part,
      onClick: () => goTo('/' + parts.slice(0, i + 1).join('/'))
    }))
  ]
})

/** UTree 用ツリーアイテム */
const treeItems = computed(() => [
  {
    label: '/',
    icon: 'i-lucide-hard-drive',
    defaultExpanded: true,
    path: '/',
    children: Object.keys(fsTree)
      .filter(k => k !== '/' && (k.match(/\//g) ?? []).length === 1)
      .map(k => ({
        label: k.split('/').pop() ?? k,
        icon: 'i-lucide-folder',
        path: k
      }))
  }
])

/** UContextMenu のアイテム */
const contextMenuItems = computed(() => (entry: FSEntry) => [
  [
    {
      label: t('apps.fileManager.open'),
      icon: entry.type === 'dir' ? 'i-lucide-folder-open' : 'i-lucide-file-text',
      onSelect: () => navigate(entry)
    }
  ],
  [
    {
      label: t('apps.fileManager.rename'),
      icon: 'i-lucide-pencil',
      onSelect: () => {}
    },
    {
      label: t('apps.fileManager.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => {}
    }
  ]
])

function navigate(entry: FSEntry) {
  if (entry.type !== 'dir') return
  const next = currentPath.value === '/'
    ? '/' + entry.name
    : currentPath.value + '/' + entry.name
  currentPath.value = next
  selectedItem.value = null
}

function goTo(path: string) {
  currentPath.value = path
  selectedItem.value = null
}

/** UTree のノード選択ハンドラ */
function onTreeSelect(node: { path?: string }) {
  if (node.path) goTo(node.path)
}
</script>

<template>
  <div class="file-manager">
    <!-- toolbar -->
    <div class="toolbar">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-panel-left"
        :aria-label="$t('apps.fileManager.sidebar')"
        @click="showSidebar = !showSidebar"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        :disabled="currentPath === '/'"
        @click="goTo(currentPath.split('/').slice(0, -1).join('/') || '/')"
      />
      <UBreadcrumb
        :links="breadcrumbLinks"
        class="breadcrumb"
      />
    </div>

    <!-- main area -->
    <div class="main-area">
      <!-- sidebar -->
      <Transition name="sidebar-slide">
        <div
          v-if="showSidebar"
          class="sidebar"
        >
          <UTree
            :items="treeItems"
            @update:model-value="onTreeSelect"
          />
        </div>
      </Transition>

      <!-- file grid -->
      <div class="file-grid">
        <div
          v-if="entries.length === 0"
          class="empty"
        >
          {{ $t('apps.fileManager.empty') }}
        </div>
        <div
          v-else
          class="grid"
        >
          <UContextMenu
            v-for="entry in entries"
            :key="entry.name"
            :items="contextMenuItems(entry)"
          >
            <button
              class="file-item"
              :class="selectedItem === entry.name ? 'selected' : ''"
              @click="selectedItem = entry.name"
              @dblclick="navigate(entry)"
            >
              <UIcon
                :name="entry.type === 'dir' ? 'i-lucide-folder' : 'i-lucide-file-text'"
                :class="['file-icon', entry.type === 'dir' ? 'icon-dir' : 'icon-file']"
              />
              <span>{{ entry.name }}</span>
            </button>
          </UContextMenu>
        </div>
      </div>
    </div>

    <div class="status-bar">
      {{ entries.length }} {{ $t('apps.fileManager.items') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.file-manager {
  display: flex;
  flex-direction: column;
  height: 100%;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;
  }

  .breadcrumb {
    flex: 1 1 0%;
    min-width: 0;
    overflow-x: auto;
    font-size: 0.75rem;
  }

  .main-area {
    display: flex;
    flex: 1 1 0%;
    min-height: 0;
    overflow: hidden;
  }

  .sidebar {
    width: 11rem;
    flex-shrink: 0;
    overflow-y: auto;
    border-right: 1px solid var(--ui-border);
    padding: 0.5rem;
    background: var(--ui-bg-elevated);
  }

  // サイドバー スライドアニメーション
  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active {
    transition: width 0.2s ease, opacity 0.2s ease;
    overflow: hidden;
  }

  .sidebar-slide-enter-from,
  .sidebar-slide-leave-to {
    width: 0;
    opacity: 0;
  }

  .file-grid {
    flex: 1 1 0%;
    overflow: auto;
    padding: 0.75rem;

    .empty {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      color: var(--ui-text-muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 0.75rem;
    }
  }

  .file-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: none;
    background: none;
    border-radius: var(--ui-radius);
    cursor: pointer;
    text-align: center;
    transition: background-color 0.1s;
    color: inherit;
    width: 100%;

    &:hover {
      background: var(--ui-bg-elevated);
    }

    &.selected {
      background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
      box-shadow: 0 0 0 1px var(--ui-primary);
    }

    .file-icon {
      font-size: 1.875rem;
    }

    .icon-dir {
      color: var(--ui-primary);
    }

    .icon-file {
      color: var(--ui-text-muted);
    }

    span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.75rem;
    }
  }

  .status-bar {
    flex-shrink: 0;
    padding: 0.25rem 0.75rem;
    border-top: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    font-size: 0.75rem;
    color: var(--ui-text-muted);
  }
}
</style>
