<script setup lang="ts">
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

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(700)

let currentObjectUrl: string | null = null

const isCompact = computed(() => containerWidth.value < 860)

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.imageViewer.errorGeneric')
}

function isImageFile(path: string): boolean {
  const lower = path.toLowerCase()
  return Array.from(IMAGE_EXTENSIONS).some(ext => lower.endsWith(ext))
}

async function openPath(path: string, selectedMountId?: string): Promise<void> {
  if (!isImageFile(path)) {
    notify(t('apps.imageViewer.notImage'), { type: 'warning' })
    return
  }

  const mountId = selectedMountId || fileSystem.activeMountId.value
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
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function triggerOpenImage(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.imageViewer.emptyHint'),
    mode: 'open-file',
    filters: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif', '.tif', '.tiff'],
    multiple: false
  })
  if (res && !Array.isArray(res)) {
    await openPath(res.path, res.mountId)
  }
}

/** ファイルサイズを人間可読形式へ変換する */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
          icon="i-lucide-folder-open"
          :label="isCompact ? undefined : t('apps.fileManager.open')"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="triggerOpenImage"
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
      v-if="localError"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="soft"
      :description="localError"
      class="state-alert"
    />

    <div class="iv-body">
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
</style>
