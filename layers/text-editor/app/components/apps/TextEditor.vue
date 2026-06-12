<script setup lang="ts">
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'

const props = defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()
const store = useDesktopStore()
const win = computed(() => store.getWindowById(props.windowId))

interface Tab {
  id: string
  filename: string
  path: string | null
  content: string
  isDirty: boolean
  mountId: string | null
}

const tabs = ref<Tab[]>([])
const activeTabId = ref<string | null>(null)

const activeTab = computed(() => tabs.value.find(tab => tab.id === activeTabId.value) || null)

const isSaving = ref(false)
const localError = ref<string | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(960)

const isCompact = computed(() => containerWidth.value < 860)

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.textEditor.errorGeneric')
}

function formatEntryName(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.at(-1) ?? 'untitled.md'
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

function createNewDocument(): void {
  const newTab: Tab = {
    id: generateId(),
    filename: 'untitled.md',
    path: null,
    content: '',
    isDirty: false,
    mountId: null
  }
  tabs.value.push(newTab)
  activeTabId.value = newTab.id
}

async function openPath(path: string, selectedMountId?: string): Promise<void> {
  const mountId = selectedMountId || fileSystem.activeMountId.value
  if (!mountId) return

  // Check if file is already open
  const existingTab = tabs.value.find(t => t.path === path && t.mountId === mountId)
  if (existingTab) {
    activeTabId.value = existingTab.id
    return
  }

  localError.value = null
  try {
    const text = await fileSystem.readTextFile(path, mountId)
    const name = formatEntryName(path)

    // Overwrite active tab if it's an unmodified "untitled.md"
    const current = activeTab.value
    if (current && current.path === null && current.filename === 'untitled.md' && !current.isDirty && current.content === '') {
      current.path = path
      current.mountId = mountId
      current.filename = name
      current.content = text
      current.isDirty = false
    } else {
      const newTab: Tab = {
        id: generateId(),
        filename: name,
        path: path,
        content: text,
        isDirty: false,
        mountId: mountId
      }
      tabs.value.push(newTab)
      activeTabId.value = newTab.id
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function triggerOpenFile(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.fileManager.open'),
    mode: 'open-file',
    filters: ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.scss'],
    multiple: true
  })
  if (res) {
    if (Array.isArray(res)) {
      for (const item of res) {
        await openPath(item.path, item.mountId)
      }
    } else {
      await openPath(res.path, res.mountId)
    }
  }
}

async function saveFile(): Promise<void> {
  if (!activeTab.value) return
  const tab = activeTab.value
  let targetPath = tab.path
  let mountId = tab.mountId || fileSystem.activeMountId.value

  if (!targetPath) {
    const fileDialog = useFileDialog()
    const res = await fileDialog.open({
      title: t('apps.textEditor.save'),
      mode: 'save-file',
      filters: ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.scss'],
      initialPath: '/'
    })
    if (!res || Array.isArray(res)) return
    targetPath = res.path
    mountId = res.mountId
  }

  if (!mountId) return

  isSaving.value = true
  localError.value = null
  try {
    await fileSystem.writeTextFile(targetPath, tab.content, mountId)
    tab.path = targetPath
    tab.mountId = mountId
    tab.filename = formatEntryName(targetPath)
    tab.isDirty = false
    notify(t('apps.textEditor.saved', { name: tab.filename }), { type: 'success' })
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

async function saveFileAs(): Promise<void> {
  if (!activeTab.value) return
  const tab = activeTab.value
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.textEditor.save'),
    mode: 'save-file',
    filters: ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.scss'],
    initialPath: '/'
  })
  if (!res || Array.isArray(res)) return

  isSaving.value = true
  localError.value = null
  try {
    await fileSystem.writeTextFile(res.path, tab.content, res.mountId)
    tab.path = res.path
    tab.mountId = res.mountId
    tab.filename = formatEntryName(res.path)
    tab.isDirty = false
    notify(t('apps.textEditor.saved', { name: tab.filename }), { type: 'success' })
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

function closeTab(tabId: string): void {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  const tab = tabs.value[index]
  if (!tab) return
  if (tab.isDirty) {
    const ok = window.confirm(t('apps.textEditor.discardConfirm'))
    if (!ok) return
  }

  tabs.value.splice(index, 1)

  if (activeTabId.value === tabId) {
    if (tabs.value.length > 0) {
      const nextActiveIndex = Math.min(index, tabs.value.length - 1)
      const nextActiveTab = tabs.value[nextActiveIndex]
      activeTabId.value = nextActiveTab ? nextActiveTab.id : null
    } else {
      activeTabId.value = null
    }
  }
}

function onContentInput(value: string): void {
  if (activeTab.value) {
    activeTab.value.content = value
    activeTab.value.isDirty = true
  }
}

watch(() => win.value?.args?.path, async (newPath) => {
  if (typeof newPath === 'string') {
    await openPath(newPath)
  }
})

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    ro.observe(containerRef.value)
    onUnmounted(() => ro.disconnect())
  }

  await fileSystem.restoreMounts()

  if (typeof win.value?.args?.path === 'string') {
    await openPath(win.value.args.path)
  } else {
    createNewDocument()
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="text-editor"
  >
    <div class="toolbar">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-folder-open"
        :label="isCompact ? undefined : $t('apps.fileManager.open')"
        @click="triggerOpenFile"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-file-plus"
        :label="isCompact ? undefined : $t('apps.textEditor.new')"
        @click="createNewDocument"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-save"
        :label="$t('apps.textEditor.save')"
        :loading="isSaving"
        :disabled="!activeTab"
        @click="saveFile"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-save-all"
        :label="isCompact ? undefined : $t('apps.fileManager.copy')"
        :loading="isSaving"
        :disabled="!activeTab"
        @click="saveFileAs"
      />
    </div>

    <UAlert
      v-if="localError"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="soft"
      :description="localError"
      class="state-alert"
    />

    <div class="body">
      <div class="editor-wrap">
        <!-- Tab Bar -->
        <div
          v-if="tabs.length > 0"
          class="tab-bar"
        >
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: tab.id === activeTabId }"
            @click="activeTabId = tab.id"
          >
            <span
              class="tab-title"
              :title="tab.path || $t('apps.textEditor.unsaved')"
            >
              {{ tab.filename }}
              <span
                v-if="tab.isDirty"
                class="tab-dirty"
              >*</span>
            </span>
            <button
              class="tab-close-btn"
              @click.stop="closeTab(tab.id)"
            >
              <UIcon
                name="i-lucide-x"
                class="close-icon"
              />
            </button>
          </div>
        </div>

        <!-- Editor Container -->
        <div
          v-if="activeTab"
          class="editor-container"
        >
          <div class="editor-path-bar">
            <span>{{ activeTab.path ?? $t('apps.textEditor.unsaved') }}</span>
          </div>
          <textarea
            :value="activeTab.content"
            class="editor-textarea"
            :placeholder="$t('apps.textEditor.placeholder')"
            @input="onContentInput(($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <!-- Empty Placeholder -->
        <div
          v-else
          class="empty-placeholder"
        >
          <div class="placeholder-content">
            <UIcon
              name="i-lucide-file-text"
              class="placeholder-icon"
            />
            <p class="placeholder-text">
              {{ $t('apps.textEditor.noTabsOpen') }}
            </p>
            <UButton
              color="neutral"
              variant="solid"
              icon="i-lucide-file-plus"
              :label="$t('apps.textEditor.createFirstTab')"
              @click="createNewDocument"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.text-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;
  }

  .state-alert {
    margin: 0.5rem;
  }

  .body {
    flex: 1 1 0%;
    min-height: 0;
    display: flex;
    overflow: hidden;
  }

  .editor-wrap {
    flex: 1 1 0%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg);
  }

  .tab-bar {
    display: flex;
    align-items: center;
    background: var(--ui-bg-elevated);
    border-bottom: 1px solid var(--ui-border);
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
    flex-shrink: 0;

    .tab-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-right: 1px solid var(--ui-border);
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s ease, color 0.15s ease;
      background: var(--ui-bg-elevated);
      color: var(--ui-text-muted);
      position: relative;
      max-width: 12rem;

      &:hover {
        background: var(--ui-bg);
        color: var(--ui-text);

        .tab-close-btn {
          opacity: 1;
        }
      }

      &.active {
        background: var(--ui-bg);
        color: var(--ui-text);
        font-weight: 500;

        &::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--ui-primary);
        }

        .tab-close-btn {
          opacity: 1;
        }
      }

      .tab-title {
        font-size: 0.8125rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .tab-dirty {
        color: var(--ui-warning);
        font-weight: bold;
      }

      .tab-close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: var(--ui-text-muted);
        padding: 0.125rem;
        border-radius: 50%;
        cursor: pointer;
        opacity: 0.4;
        transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;

        &:hover {
          background: var(--ui-bg-elevated);
          color: var(--ui-error);
          opacity: 1;
        }

        .close-icon {
          width: 0.75rem;
          height: 0.75rem;
        }
      }
    }
  }

  .editor-container {
    flex: 1 1 0%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg);
  }

  .editor-path-bar {
    padding: 0.375rem 1rem;
    background: var(--ui-bg-elevated);
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text-muted);
    font-size: 0.75rem;
    flex-shrink: 0;

    span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .editor-textarea {
    flex: 1 1 0%;
    min-height: 0;
    width: 100%;
    border: none;
    resize: none;
    outline: none;
    padding: 1.5rem;
    font-family: 'Fira Code', 'Courier New', Courier, monospace;
    font-size: 0.9375rem;
    line-height: 1.6;
    background: var(--ui-bg);
    color: var(--ui-text);
    box-sizing: border-box;

    &::placeholder {
      color: var(--ui-text-muted);
      opacity: 0.6;
    }
  }

  .empty-placeholder {
    flex: 1 1 0%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ui-bg);
    color: var(--ui-text-muted);

    .placeholder-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      max-width: 20rem;
      padding: 2rem;

      .placeholder-icon {
        width: 3.5rem;
        height: 3.5rem;
        opacity: 0.4;
        color: var(--ui-primary);
      }

      .placeholder-text {
        font-size: 0.875rem;
        margin: 0;
        opacity: 0.8;
      }
    }
  }
}
</style>
