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

const pathParts = computed(() =>
  currentPath.value === '/'
    ? [{ label: '/', path: '/' }]
    : ['/', ...currentPath.value.slice(1).split('/')].reduce<{ label: string, path: string }[]>((acc, part, i, arr) => {
        acc.push({ label: part || '/', path: arr.slice(0, i + 1).join('/') || '/' })
        return acc
      }, [])
)

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
</script>

<template>
  <div class="file-manager">
    <div class="toolbar">
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :disabled="currentPath === '/'"
        @click="goTo(currentPath.split('/').slice(0, -1).join('/') || '/')"
      />
      <nav class="breadcrumb">
        <template
          v-for="(part, i) in pathParts"
          :key="part.path"
        >
          <span
            v-if="i > 0"
            class="sep"
          >/</span>
          <button
            :class="['crumb', i === pathParts.length - 1 ? 'active' : 'muted']"
            @click="goTo(part.path)"
          >
            {{ part.label }}
          </button>
        </template>
      </nav>
    </div>

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
        <button
          v-for="entry in entries"
          :key="entry.name"
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
    display: flex;
    align-items: center;
    gap: 0.125rem;
    overflow-x: auto;
    font-size: 0.75rem;
    flex: 1 1 0%;
    min-width: 0;

    .sep {
      color: var(--ui-text-muted);
    }

    .crumb {
      border: none;
      background: none;
      padding: 0.125rem 0.25rem;
      border-radius: calc(var(--ui-radius) * 0.5);
      cursor: pointer;
      color: inherit;
      font-size: inherit;

      &:hover {
        background: var(--ui-bg);
      }

      &.active {
        font-weight: 600;
      }

      &.muted {
        color: var(--ui-text-muted);
      }
    }
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
    border-top: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    color: var(--ui-text-muted);
    flex-shrink: 0;
  }
}
</style>
