<script setup lang="ts">
import type { FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'

const props = defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()
const store = useDesktopStore()
const win = computed(() => store.getWindowById(props.windowId))

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif', '.tif', '.tiff'
])

/** 表示中の画像 URL */
const imageUrl = ref<string | null>(null)
/** ズーム倍率 */
const zoom = ref(1)
/** 回転角度（度） */
const rotation = ref(0)
/** 画像情報 */
const imageInfo = ref<{ name: string, size: string } | null>(null)

const localError = ref<string | null>(null)
const browserPath = ref('/')
const entries = ref<FileSystemEntry[]>([])
const isLoadingEntries = ref(false)
const addingMount = ref(false)
const showBrowser = ref(true)

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(700)

let currentObjectUrl: string | null = null

const isCompact = computed(() => containerWidth.value < 860)

const mountOptions = computed(() =>
  fileSystem.mounts.value.map(mount => ({
    label: mount.name,
    value: mount.id
  }))
)

const hasMount = computed(() => !!fileSystem.activeMountId.value)

const selectedMountId = computed({
  get: (): string => fileSystem.activeMountId.value ?? '',
  set: (mountId: string) => {
    void fileSystem.setActiveMount(mountId || null)
  }
})

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.imageViewer.errorGeneric')
}

function isImageFile(path: string): boolean {
  const lower = path.toLowerCase()
  return Array.from(IMAGE_EXTENSIONS).some(ext => lower.endsWith(ext))
}

function goTo(path: string): void {
  browserPath.value = path
}

function goUp(): void {
  if (browserPath.value === '/') return
  const parts = browserPath.value.split('/').filter(Boolean)
  parts.pop()
  browserPath.value = parts.length > 0 ? `/${parts.join('/')}` : '/'
}

async function loadEntries(): Promise<void> {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) {
    entries.value = []
    return
  }

  isLoadingEntries.value = true
  localError.value = null
  try {
    entries.value = await fileSystem.listDirectory(browserPath.value, mountId)
  } catch (error) {
    localError.value = toErrorMessage(error)
    entries.value = []
  } finally {
    isLoadingEntries.value = false
  }
}

async function openPath(path: string): Promise<void> {
  if (!isImageFile(path)) {
    notify(t('apps.imageViewer.notImage'), { type: 'warning' })
    return
  }

  const mountId = fileSystem.activeMountId.value
  if (!mountId) return

  localError.value = null
  try {
    const blob = await fileSystem.readFileBlob(path, mountId)
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl)
      currentObjectUrl = null
    }

    currentObjectUrl = URL.createObjectURL(blob)
    imageUrl.value = currentObjectUrl
    zoom.value = 1
    rotation.value = 0

    const name = path.split('/').filter(Boolean).at(-1) || 'image'
    imageInfo.value = {
      name,
      size: formatFileSize(blob.size)
    }

    if (isCompact.value) showBrowser.value = false
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function openEntry(entry: FileSystemEntry): Promise<void> {
  if (entry.kind === 'directory') {
    goTo(entry.path)
    return
  }
  await openPath(entry.path)
}

/** ファイルサイズを人間可読形式へ変換する */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function handleAddMount(): Promise<void> {
  addingMount.value = true
  try {
    const mount = await fileSystem.addMount()
    if (mount) {
      notify(t('apps.imageViewer.mountAdded', { name: mount.name }), { type: 'success' })
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    addingMount.value = false
  }
}

/** ズームインする */
function zoomIn(): void {
  zoom.value = Math.min(zoom.value + 0.1, 5)
}

/** ズームアウトする */
function zoomOut(): void {
  zoom.value = Math.max(zoom.value - 0.1, 0.1)
}

/** ズームと回転をリセットする */
function zoomReset(): void {
  zoom.value = 1
  rotation.value = 0
}

/** 画像を 90 度回転する */
function rotate(): void {
  rotation.value = (rotation.value + 90) % 360
}

/** 画像の CSS transform */
const imageTransform = computed(
  () => `scale(${zoom.value}) rotate(${rotation.value}deg)`
)

/** ズームパーセント表示 */
const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

watch(isCompact, (compact) => {
  if (compact) showBrowser.value = false
})

watch(() => fileSystem.activeMountId.value, async () => {
  browserPath.value = '/'
  await loadEntries()
})

watch(browserPath, async () => {
  await loadEntries()
})

watch(() => win.value?.args?.path, async (newPath) => {
  if (typeof newPath === 'string') {
    await openPath(newPath)
  }
})

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    resizeObserver.observe(containerRef.value)
    onUnmounted(() => resizeObserver.disconnect())
  }

  await fileSystem.restoreMounts()
  await loadEntries()

  if (typeof win.value?.args?.path === 'string') {
    await openPath(win.value.args.path)
  }
})

onBeforeUnmount(() => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="image-viewer"
    :class="{ compact: isCompact }"
  >
    <div class="iv-toolbar">
      <div class="iv-toolbar-left">
        <UButton
          icon="i-lucide-panel-left"
          :label="isCompact ? undefined : t('apps.imageViewer.browser')"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="showBrowser = !showBrowser"
        />
        <USelect
          v-model="selectedMountId"
          :items="mountOptions"
          value-key="value"
          class="mount-select"
          :placeholder="t('apps.imageViewer.mount')"
        />
        <UButton
          icon="i-lucide-folder-plus"
          :label="isCompact ? undefined : t('apps.imageViewer.addMount')"
          variant="ghost"
          color="primary"
          size="sm"
          :loading="addingMount"
          @click="handleAddMount"
        />
        <UButton
          icon="i-lucide-arrow-up"
          :label="isCompact ? undefined : t('apps.imageViewer.up')"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="!hasMount || browserPath === '/'"
          @click="goUp"
        />
        <UButton
          icon="i-lucide-refresh-cw"
          :label="isCompact ? undefined : t('apps.imageViewer.refresh')"
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="isLoadingEntries"
          :disabled="!hasMount"
          @click="loadEntries"
        />
        <span
          v-if="imageInfo && !isCompact"
          class="iv-filename"
        >{{ imageInfo.name }}</span>
      </div>

      <div class="iv-toolbar-right">
        <UButton
          icon="i-lucide-zoom-out"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="!imageUrl"
          @click="zoomOut"
        />
        <span class="iv-zoom">{{ zoomPercent }}</span>
        <UButton
          icon="i-lucide-zoom-in"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="!imageUrl"
          @click="zoomIn"
        />
        <UButton
          icon="i-lucide-rotate-cw"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="!imageUrl"
          @click="rotate"
        />
        <UButton
          icon="i-lucide-maximize"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="!imageUrl"
          @click="zoomReset"
        />
      </div>
    </div>

    <UAlert
      v-if="!fileSystem.isSupported.value"
      icon="i-lucide-info"
      color="neutral"
      variant="soft"
      :description="t('apps.imageViewer.unsupported')"
      class="state-alert"
    />

    <UAlert
      v-else-if="!hasMount"
      icon="i-lucide-folder-search"
      color="neutral"
      variant="soft"
      :description="t('apps.imageViewer.noMounts')"
      class="state-alert"
    />

    <UAlert
      v-if="localError"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="soft"
      :description="localError"
      class="state-alert"
    />

    <div
      v-if="showBrowser && isCompact"
      class="browser-backdrop"
      @click="showBrowser = false"
    />

    <div class="iv-body">
      <Transition name="browser-slide">
        <aside
          v-if="showBrowser && hasMount && fileSystem.isSupported.value"
          class="browser"
          :class="{ compact: isCompact }"
        >
          <p class="browser-path">
            {{ browserPath }}
          </p>

          <div
            v-if="isLoadingEntries"
            class="browser-empty"
          >
            {{ t('apps.imageViewer.loading') }}
          </div>

          <div
            v-else-if="entries.length === 0"
            class="browser-empty"
          >
            {{ t('apps.imageViewer.empty') }}
          </div>

          <button
            v-for="entry in entries"
            :key="entry.path"
            class="browser-item"
            @click="openEntry(entry)"
          >
            <UIcon :name="entry.kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-file-image'" />
            <span>{{ entry.name }}</span>
          </button>
        </aside>
      </Transition>

      <div class="iv-canvas">
        <template v-if="imageUrl">
          <img
            :src="imageUrl"
            alt=""
            class="iv-image"
            :style="{ transform: imageTransform }"
            draggable="false"
          >
        </template>

        <template v-else>
          <div class="iv-empty">
            <UIcon
              name="i-lucide-image"
              class="iv-empty-icon"
            />
            <p class="iv-empty-text">
              {{ t('apps.imageViewer.emptyHint') }}
            </p>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="imageInfo"
      class="iv-statusbar"
    >
      <span>{{ imageInfo.name }}</span>
      <span>{{ imageInfo.size }}</span>
      <span>{{ zoomPercent }}</span>
    </div>
  </div>
</template>

<style scoped>
.image-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  overflow: hidden;
  position: relative;
}

.iv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
  gap: 8px;
  flex-wrap: wrap;
}

.iv-toolbar-left,
.iv-toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mount-select {
  min-width: 12rem;
  max-width: 16rem;
}

.iv-filename {
  font-size: 0.8rem;
  color: var(--ui-text-muted);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iv-zoom {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  min-width: 42px;
  text-align: center;
}

.state-alert {
  margin: 0.5rem;
}

.iv-body {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.browser {
  width: 15rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  overflow-y: auto;
  padding: 0.5rem;
}

.browser.compact {
  position: absolute;
  inset: 0 auto 0 0;
  width: min(85%, 20rem);
  z-index: 20;
  box-shadow: 0 12px 24px rgb(0 0 0 / 25%);
}

.browser-path {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browser-empty {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  padding: 0.5rem 0;
}

.browser-item {
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.375rem;
  text-align: left;
  cursor: pointer;
}

.browser-item:hover {
  background: var(--ui-bg);
}

.browser-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}

.iv-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: var(--ui-bg-muted);
  position: relative;
  transition: background 0.2s;
}

.iv-image {
  max-width: none;
  max-height: none;
  transform-origin: center center;
  user-select: none;
  -webkit-user-drag: none;
}

.iv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--ui-text-muted);
  text-align: center;
  padding: 20px;
}

.iv-empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

.iv-empty-text {
  font-size: 0.8rem;
  max-width: 220px;
}

.iv-statusbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 10px;
  border-top: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  font-size: 0.72rem;
  color: var(--ui-text-muted);
}

.compact .iv-statusbar {
  gap: 10px;
  font-size: 0.7rem;
}

.browser-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 30%);
  z-index: 10;
}

.browser-slide-enter-active,
.browser-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.browser-slide-enter-from,
.browser-slide-leave-to {
  transform: translateX(-8px);
  opacity: 0;
}
</style>
