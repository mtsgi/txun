<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()

/** 表示中の画像 data URL */
const imageUrl = ref<string | null>(null)
/** ズーム倍率 */
const zoom = ref(1)
/** 回転角度（度） */
const rotation = ref(0)
/** ドラッグオーバー中か */
const isDragOver = ref(false)
/** 隠しファイル入力 */
const fileInput = ref<HTMLInputElement | null>(null)
/** 画像のオリジナル情報 */
const imageInfo = ref<{ name: string, size: string } | null>(null)

/** コンテナ幅によるレスポンシブ判定 */
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(700)

onMounted(() => {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) containerWidth.value = entry.contentRect.width
  })
  ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})

/** 幅が 480px 未満をコンパクトモードと判定 */
const isCompact = computed(() => containerWidth.value < 480)

/** ファイルを読み込んで表示する */
function loadFile(file: File): void {
  if (!file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = (e) => {
    imageUrl.value = e.target?.result as string
    zoom.value = 1
    rotation.value = 0
    imageInfo.value = {
      name: file.name,
      size: formatFileSize(file.size)
    }
  }
  reader.readAsDataURL(file)
}

/** ファイルサイズを人間可読形式にフォーマットする */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** ドロップ時の処理 */
function handleDrop(event: DragEvent): void {
  isDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) loadFile(file)
}

/** ファイル選択ダイアログから読み込む */
function handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) loadFile(file)
}

/** ズームイン */
function zoomIn(): void {
  zoom.value = Math.min(zoom.value * 1.25, 8)
}

/** ズームアウト */
function zoomOut(): void {
  zoom.value = Math.max(zoom.value / 1.25, 0.1)
}

/** ズームをリセット */
function zoomReset(): void {
  zoom.value = 1
  rotation.value = 0
}

/** 90度回転 */
function rotate(): void {
  rotation.value = (rotation.value + 90) % 360
}

/** 画像の CSS transform */
const imageTransform = computed(
  () => `scale(${zoom.value}) rotate(${rotation.value}deg)`
)

/** ズームパーセント表示 */
const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)
</script>

<template>
  <div
    ref="containerRef"
    class="image-viewer"
    :class="{ compact: isCompact }"
  >
    <!-- ツールバー -->
    <div class="iv-toolbar">
      <div class="iv-toolbar-left">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden-input"
          @change="handleFileInput"
        >
        <UButton
          icon="i-lucide-folder-open"
          :label="isCompact ? undefined : t('apps.imageViewer.open')"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="fileInput?.click()"
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

    <!-- 画像表示エリア -->
    <div
      class="iv-canvas"
      :class="{ dragover: isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @drop.prevent="handleDrop"
    >
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
            {{ t('apps.imageViewer.dropHere') }}
          </p>
          <UButton
            :label="t('apps.imageViewer.open')"
            variant="outline"
            color="neutral"
            @click="fileInput?.click()"
          />
        </div>
      </template>
    </div>

    <!-- ステータスバー -->
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
}

.hidden-input {
  display: none;
}

.iv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
  gap: 8px;
}

.iv-toolbar-left, .iv-toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.iv-filename {
  font-size: 0.8rem;
  color: var(--ui-text-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iv-zoom {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  min-width: 44px;
  text-align: center;
  color: var(--ui-text-muted);
}

.iv-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--ui-bg-muted);
  position: relative;
  transition: background 0.2s;
}

.iv-canvas.dragover {
  background: color-mix(in srgb, var(--ui-color-primary-500) 10%, var(--ui-bg-muted));
  outline: 2px dashed var(--ui-color-primary-500);
  outline-offset: -4px;
}

.iv-image {
  max-width: none;
  max-height: none;
  transform-origin: center center;
  transition: transform 0.2s ease;
  pointer-events: none;
  user-select: none;
}

.iv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--ui-text-muted);
}

.iv-empty-icon {
  font-size: 3rem;
  opacity: 0.4;
}

.iv-empty-text {
  font-size: 0.9rem;
}

.iv-statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  border-top: 1px solid var(--ui-border);
  flex-shrink: 0;
}

.compact .iv-statusbar {
  gap: 10px;
  font-size: 0.7rem;
}
</style>
