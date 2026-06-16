<script lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const mediaUrlCache = new Map<string, string>()
const mediaUrlKeys: string[] = []
const MAX_CACHE_SIZE = 256

export function clearMediaCache() {
  for (const url of mediaUrlCache.values()) {
    try {
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to revoke object URL:', e)
    }
  }
  mediaUrlCache.clear()
  mediaUrlKeys.length = 0
}

function getCachedMediaUrl(path: string): string | null {
  if (mediaUrlCache.has(path)) {
    const index = mediaUrlKeys.indexOf(path)
    if (index !== -1) {
      mediaUrlKeys.splice(index, 1)
    }
    mediaUrlKeys.push(path)
    return mediaUrlCache.get(path) || null
  }
  return null
}

function cacheMediaUrl(path: string, url: string) {
  if (mediaUrlCache.has(path)) {
    return
  }
  if (mediaUrlKeys.length >= MAX_CACHE_SIZE) {
    const oldestPath = mediaUrlKeys.shift()
    if (oldestPath) {
      const oldestUrl = mediaUrlCache.get(oldestPath)
      if (oldestUrl) {
        try {
          URL.revokeObjectURL(oldestUrl)
        } catch (e) {
          console.error('Failed to revoke oldest URL:', e)
        }
      }
      mediaUrlCache.delete(oldestPath)
    }
  }
  mediaUrlCache.set(path, url)
  mediaUrlKeys.push(path)
}
</script>

<script setup lang="ts">
const props = defineProps<{
  item: {
    name: string
    path: string
    kind: 'file'
    size: number
    lastModified: number
    type: 'image' | 'video'
  }
  mountId: string
  selected: boolean
  favorite: boolean
  isMultiSelectMode: boolean
}>()

defineEmits<{
  (e: 'click' | 'dblclick' | 'toggle-favorite'): void
}>()

const fileSystem = useFileSystem()

const elRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const isLoading = ref(false)
const srcUrl = ref<string | null>(null)
let observer: IntersectionObserver | null = null

async function loadMedia() {
  if (isLoading.value) return

  const cachedUrl = getCachedMediaUrl(props.item.path)
  if (cachedUrl) {
    srcUrl.value = cachedUrl
    return
  }

  isLoading.value = true
  try {
    const blob = await fileSystem.readFileBlob(props.item.path, props.mountId)
    if (isVisible.value) {
      const url = URL.createObjectURL(blob)
      cacheMediaUrl(props.item.path, url)
      srcUrl.value = url
    }
  } catch (err) {
    console.error('Failed to load gallery item:', props.item.path, err)
  } finally {
    isLoading.value = false
  }
}

function releaseMedia() {
  srcUrl.value = null
}

onMounted(() => {
  if (props.item.type === 'video') {
    // 動画はサムネイル取得がブラウザ互換性の観点から重いため、初期状態では読み込まずアイコン表示にする
    isVisible.value = true
    return
  }

  // 画像はIntersectionObserverで遅延ロード
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0]
    if (entry?.isIntersecting) {
      isVisible.value = true
      loadMedia()
    } else {
      isVisible.value = false
      releaseMedia()
    }
  }, {
    rootMargin: '200px'
  })

  if (elRef.value) {
    observer.observe(elRef.value)
  }
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
  }
  releaseMedia()
})
</script>

<template>
  <div
    ref="elRef"
    class="gallery-item-card"
    :class="{
      'selected': selected,
      'multi-select': isMultiSelectMode,
      'video': item.type === 'video'
    }"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <div class="card-aspect">
      <div v-if="item.type === 'image'" class="media-container">
        <img
          v-if="srcUrl"
          :src="srcUrl"
          class="thumbnail-img animate-fade-in"
          alt=""
          loading="lazy"
        >
        <div v-else class="placeholder-skeleton">
          <UIcon name="i-lucide-image" class="placeholder-icon" />
        </div>
      </div>

      <div v-else class="media-container video-placeholder">
        <UIcon name="i-lucide-video" class="video-main-icon" />
        <span class="video-badge">VIDEO</span>
      </div>

      <!-- オーバーレイ表示 (選択状態、お気に入り状態など) -->
      <div class="card-overlay">
        <!-- 複数選択チェックボックス（または丸型インジケータ） -->
        <div v-if="isMultiSelectMode" class="select-indicator" :class="{ checked: selected }">
          <UIcon v-if="selected" name="i-lucide-check" class="check-icon" />
        </div>

        <div class="bottom-actions" @click.stop>
          <UButton
            :icon="favorite ? 'i-lucide-star-solid' : 'i-lucide-star'"
            :color="favorite ? 'warning' : 'neutral'"
            variant="ghost"
            size="xs"
            class="fav-btn"
            @click="$emit('toggle-favorite')"
          />
        </div>
      </div>
    </div>

    <div class="card-info">
      <span class="item-name" :title="item.name">{{ item.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.gallery-item-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  user-select: none;
}

.gallery-item-card:hover {
  transform: translateY(-2px);
  border-color: var(--ui-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.gallery-item-card.selected {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 2px var(--ui-primary);
}

.card-aspect {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 Aspect Ratio */
  background: var(--ui-bg-muted);
  overflow: hidden;
}

.media-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-skeleton {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
}

.placeholder-icon {
  font-size: 1.5rem;
  opacity: 0.3;
  animation: pulse 1.5s infinite ease-in-out;
}

.video-placeholder {
  background: linear-gradient(135deg, var(--ui-bg-muted), var(--ui-bg-elevated));
  color: var(--ui-text-muted);
}

.video-main-icon {
  font-size: 2rem;
  opacity: 0.7;
}

.video-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0);
  transition: background 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
  opacity: 0;
}

.gallery-item-card:hover .card-overlay,
.gallery-item-card.selected .card-overlay,
.gallery-item-card.multi-select .card-overlay {
  background: rgba(0, 0, 0, 0.15);
  opacity: 1;
}

.select-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}

.select-indicator.checked {
  background: var(--ui-primary);
  border-color: var(--ui-primary);
}

.check-icon {
  color: #fff;
  font-size: 0.8rem;
}

.bottom-actions {
  display: flex;
  justify-content: flex-end;
}

.fav-btn {
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  border-radius: 50%;
  padding: 4px;
}

.fav-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

.card-info {
  padding: 6px 8px;
  font-size: 0.75rem;
  background: var(--ui-bg-elevated);
  border-top: 1px solid var(--ui-border);
}

.item-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text);
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
