<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'
import { clearMediaCache } from './GalleryItemCard.vue'

const props = defineProps<{ windowId: string }>()

const { t } = useI18n()
const fileSystem = useFileSystem()
const desktopStore = useDesktopStore()
const { saveState, loadState } = useDesktopStorage()

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg'])

// --- State ---
interface MediaItem {
  name: string
  path: string
  kind: 'file'
  size: number
  lastModified: number
  type: 'image' | 'video'
}

interface MediaMetadata {
  favorite: boolean
  tags: string[]
}

const mediaItems = ref<MediaItem[]>([])
const isScanning = ref(false)
const scanCount = ref(0)
const metadataStore = ref<Record<string, MediaMetadata>>({})
const activeFilter = ref<{ type: 'all' | 'favorite' | 'tag'; tag?: string }>({ type: 'all' })

// 複数選択
const isMultiSelectMode = ref(false)
const selectedPaths = ref<Set<string>>(new Set())

// ライトボックス / スライドショー
const activeLightboxIndex = ref<number | null>(null)
const lightboxMediaUrl = ref<string | null>(null)
const isSlideshowRunning = ref(false)
const slideshowInterval = ref(3000) // 3s
const slideshowShuffle = ref(false)
let slideshowTimer: NodeJS.Timeout | null = null
const isDetailPanelOpen = ref(true)

// ライトボックス内での新規タグ入力
const newTagInput = ref('')

// 一括タグ操作用
const batchTagInput = ref('')
const isBatchTagOpen = ref(false)

// レスポンシブ用
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(900)
const isCompact = computed(() => containerWidth.value < 768)
const isSidebarOpen = ref(false) // モバイル用ドロワー

// --- Metadata Helper ---
function getMetadata(itemPath: string): MediaMetadata {
  const mountId = fileSystem.activeMountId.value || ''
  const key = `${mountId}:${itemPath}`
  return metadataStore.value[key] || { favorite: false, tags: [] }
}

async function saveMetadata() {
  await saveState('gallery-metadata', metadataStore.value)
}

function toggleFavorite(itemPath: string) {
  const mountId = fileSystem.activeMountId.value || ''
  const key = `${mountId}:${itemPath}`
  if (!metadataStore.value[key]) {
    metadataStore.value[key] = { favorite: false, tags: [] }
  }
  const meta = metadataStore.value[key]
  meta.favorite = !meta.favorite
  saveMetadata()
}

function addTag(itemPath: string, tag: string) {
  const trimmed = tag.trim()
  if (!trimmed) return
  const mountId = fileSystem.activeMountId.value || ''
  const key = `${mountId}:${itemPath}`
  if (!metadataStore.value[key]) {
    metadataStore.value[key] = { favorite: false, tags: [] }
  }
  const meta = metadataStore.value[key]
  if (!meta.tags.includes(trimmed)) {
    meta.tags.push(trimmed)
    saveMetadata()
  }
}

function removeTag(itemPath: string, tag: string) {
  const mountId = fileSystem.activeMountId.value || ''
  const key = `${mountId}:${itemPath}`
  if (!metadataStore.value[key]) return
  const meta = metadataStore.value[key]
  meta.tags = meta.tags.filter(t => t !== tag)
  saveMetadata()
}

// すべてのタグ
const allTags = computed(() => {
  const tagsSet = new Set<string>()
  const mountId = fileSystem.activeMountId.value || ''
  for (const [key, meta] of Object.entries(metadataStore.value)) {
    if (key.startsWith(`${mountId}:`) && meta.tags) {
      meta.tags.forEach(t => tagsSet.add(t))
    }
  }
  return Array.from(tagsSet).sort()
})

// --- Scanner ---
async function startScan() {
  clearMediaCache()
  const win = computed(() => desktopStore.getWindowById(props.windowId))
  const targetMountId = (win.value?.args?.mountId as string) || fileSystem.activeMountId.value
  if (!targetMountId) {
    mediaItems.value = []
    return
  }

  if (targetMountId !== fileSystem.activeMountId.value && fileSystem.mounts.value.some(m => m.id === targetMountId)) {
    await fileSystem.setActiveMount(targetMountId)
    return
  }

  isScanning.value = true
  scanCount.value = 0
  const tempItems: MediaItem[] = []
  const startPath = (win.value?.args?.path as string) || '/'

  try {
    await scanDirectory(startPath, targetMountId, tempItems)
    // 更新日時で降順ソート
    tempItems.sort((a, b) => b.lastModified - a.lastModified)
    mediaItems.value = tempItems
  } catch (err) {
    console.error('Failed to scan media:', err)
  } finally {
    isScanning.value = false
  }
}

async function scanDirectory(path: string, mountId: string, acc: MediaItem[]) {
  try {
    const entries = await fileSystem.listDirectory(path, mountId)
    const subDirPromises: Promise<void>[] = []
    for (const entry of entries) {
      if (entry.kind === 'directory') {
        subDirPromises.push(scanDirectory(entry.path, mountId, acc))
      } else {
        const dotIndex = entry.name.lastIndexOf('.')
        if (dotIndex === -1) continue
        const ext = entry.name.substring(dotIndex).toLowerCase()
        if (IMAGE_EXTENSIONS.has(ext)) {
          acc.push({ ...entry, type: 'image' } as MediaItem)
          scanCount.value++
        } else if (VIDEO_EXTENSIONS.has(ext)) {
          acc.push({ ...entry, type: 'video' } as MediaItem)
          scanCount.value++
        }
      }
    }
    if (subDirPromises.length > 0) {
      await Promise.all(subDirPromises)
    }
  } catch (err) {
    console.error('Scan error at path:', path, err)
  }
}

// --- Filtering ---
const filteredItems = computed(() => {
  return mediaItems.value.filter(item => {
    const meta = getMetadata(item.path)
    if (activeFilter.value.type === 'favorite') {
      return meta.favorite
    }
    if (activeFilter.value.type === 'tag') {
      return meta.tags.includes(activeFilter.value.tag || '')
    }
    return true
  })
})

// タイムライングループ化
const groupedItems = computed(() => {
  const groupsMap = new Map<string, MediaItem[]>()
  
  for (const item of filteredItems.value) {
    const date = new Date(item.lastModified)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const key = `${year}年${month}月`
    
    let items = groupsMap.get(key)
    if (!items) {
      items = []
      groupsMap.set(key, items)
    }
    items.push(item)
  }

  const groups: { title: string; items: MediaItem[] }[] = []
  for (const [title, items] of groupsMap.entries()) {
    groups.push({ title, items })
  }
  return groups
})

// --- Selection Operations ---
function handleItemClick(item: MediaItem, index: number) {
  if (isMultiSelectMode.value) {
    if (selectedPaths.value.has(item.path)) {
      selectedPaths.value.delete(item.path)
    } else {
      selectedPaths.value.add(item.path)
    }
  } else {
    // ライトボックス表示
    openLightbox(index)
  }
}

function handleItemDblClick(item: MediaItem, index: number) {
  if (!isMultiSelectMode.value) {
    openLightbox(index)
  }
}

function toggleMultiSelectMode() {
  isMultiSelectMode.value = !isMultiSelectMode.value
  selectedPaths.value.clear()
}

function selectAllFiltered() {
  filteredItems.value.forEach(item => {
    selectedPaths.value.add(item.path)
  })
}

function clearSelection() {
  selectedPaths.value.clear()
}

function batchToggleFavorite() {
  if (selectedPaths.value.size === 0) return
  const mountId = fileSystem.activeMountId.value || ''
  // 全てがお気に入りなら解除、そうでなければお気に入り
  const allFav = Array.from(selectedPaths.value).every(path => getMetadata(path).favorite)
  selectedPaths.value.forEach(path => {
    const key = `${mountId}:${path}`
    if (!metadataStore.value[key]) {
      metadataStore.value[key] = { favorite: false, tags: [] }
    }
    metadataStore.value[key].favorite = !allFav
  })
  saveMetadata()
}

function batchAddTag() {
  const tag = batchTagInput.value.trim()
  if (!tag || selectedPaths.value.size === 0) return
  const mountId = fileSystem.activeMountId.value || ''
  selectedPaths.value.forEach(path => {
    const key = `${mountId}:${path}`
    if (!metadataStore.value[key]) {
      metadataStore.value[key] = { favorite: false, tags: [] }
    }
    const meta = metadataStore.value[key]
    if (!meta.tags.includes(tag)) {
      meta.tags.push(tag)
    }
  })
  saveMetadata()
  batchTagInput.value = ''
  isBatchTagOpen.value = false
}

function batchRemoveTag() {
  const tag = batchTagInput.value.trim()
  if (!tag || selectedPaths.value.size === 0) return
  const mountId = fileSystem.activeMountId.value || ''
  selectedPaths.value.forEach(path => {
    const key = `${mountId}:${path}`
    if (!metadataStore.value[key]) return
    const meta = metadataStore.value[key]
    meta.tags = meta.tags.filter(t => t !== tag)
  })
  saveMetadata()
  batchTagInput.value = ''
  isBatchTagOpen.value = false
}

// --- Lightbox & Slideshow ---
const currentLightboxItem = computed(() => {
  if (activeLightboxIndex.value === null) return null
  return filteredItems.value[activeLightboxIndex.value] || null
})

async function openLightbox(index: number) {
  activeLightboxIndex.value = index
  newTagInput.value = ''
  await loadLightboxMedia()
}

function closeLightbox() {
  stopSlideshow()
  activeLightboxIndex.value = null
  if (lightboxMediaUrl.value) {
    URL.revokeObjectURL(lightboxMediaUrl.value)
    lightboxMediaUrl.value = null
  }
}

async function loadLightboxMedia() {
  if (lightboxMediaUrl.value) {
    URL.revokeObjectURL(lightboxMediaUrl.value)
    lightboxMediaUrl.value = null
  }

  const item = currentLightboxItem.value
  if (!item) return

  try {
    const blob = await fileSystem.readFileBlob(item.path, fileSystem.activeMountId.value || '')
    lightboxMediaUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    console.error('Failed to load full media in lightbox:', item.path, err)
  }
}

async function prevItem() {
  if (activeLightboxIndex.value === null) return
  let prevIndex = activeLightboxIndex.value - 1
  if (prevIndex < 0) {
    prevIndex = filteredItems.value.length - 1
  }
  await openLightbox(prevIndex)
}

async function nextItem() {
  if (activeLightboxIndex.value === null) return
  
  let nextIndex: number
  if (isSlideshowRunning.value && slideshowShuffle.value) {
    // ランダム選択
    nextIndex = Math.floor(Math.random() * filteredItems.value.length)
  } else {
    nextIndex = activeLightboxIndex.value + 1
    if (nextIndex >= filteredItems.value.length) {
      nextIndex = 0
    }
  }
  await openLightbox(nextIndex)
}

function startSlideshow() {
  if (isSlideshowRunning.value) return
  isSlideshowRunning.value = true
  
  slideshowTimer = setInterval(() => {
    const item = currentLightboxItem.value
    // 動画再生中の場合は、タイマー側での次へ遷移を一時見送り、endedイベントに委ねる構成とする
    if (item && item.type === 'video') {
      return
    }
    nextItem()
  }, slideshowInterval.value)
}

function stopSlideshow() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer)
    slideshowTimer = null
  }
  isSlideshowRunning.value = false
}

function toggleSlideshow() {
  if (isSlideshowRunning.value) {
    stopSlideshow()
  } else {
    startSlideshow()
  }
}

// ビデオ終了時のハンドリング
function handleVideoEnded() {
  if (isSlideshowRunning.value) {
    nextItem()
  }
}

// スライドショー間隔変更時のタイマーリスタート
watch(slideshowInterval, () => {
  if (isSlideshowRunning.value) {
    stopSlideshow()
    startSlideshow()
  }
})

// マウント変更を検知してスキャン
watch(() => fileSystem.activeMountId.value, async () => {
  await startScan()
})

// 起動引数の変更を検知してスキャン
watch(() => {
  const win = desktopStore.getWindowById(props.windowId)
  return [win?.args?.path, win?.args?.mountId]
}, async () => {
  await startScan()
}, { deep: true })

// キーボードナビゲーション
function handleKeyDown(e: KeyboardEvent) {
  if (activeLightboxIndex.value === null) return
  if (e.key === 'ArrowLeft') {
    prevItem()
  } else if (e.key === 'ArrowRight') {
    nextItem()
  } else if (e.key === 'Escape') {
    closeLightbox()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)

  // レスポンシブ監視
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        containerWidth.value = entry.contentRect.width
      }
    })
    resizeObserver.observe(containerRef.value)
    onBeforeUnmount(() => {
      clearMediaCache()
      resizeObserver.disconnect()
      window.removeEventListener('keydown', handleKeyDown)
      if (slideshowTimer) clearInterval(slideshowTimer)
    })
  }

  // メタデータ復元
  const savedMeta = await loadState<Record<string, MediaMetadata>>('gallery-metadata')
  if (savedMeta) {
    metadataStore.value = savedMeta
  }

  await fileSystem.restoreMounts()
  await startScan()
})

onBeforeUnmount(() => {
  clearMediaCache()
  if (lightboxMediaUrl.value) {
    URL.revokeObjectURL(lightboxMediaUrl.value)
  }
})

const itemsCountText = computed(() => {
  return t('apps.gallery.itemsCount', { count: filteredItems.value.length })
})
</script>

<template>
  <div
    ref="containerRef"
    class="gallery-app"
    :class="{ compact: isCompact }"
  >
    <!-- 上部ヘッダー -->
    <header class="app-header">
      <div class="header-left">
        <UIcon name="i-lucide-images" class="app-logo-icon" />
        <h1 class="app-title">{{ t('apps.gallery.name') }}</h1>
        
        <span v-if="isScanning" class="scan-status-pill">
          <UIcon name="i-lucide-loader-2" class="spin-icon" />
          {{ t('apps.gallery.scanning', { count: scanCount }) }}
        </span>
        <span v-else-if="fileSystem.activeMountId.value" class="items-count-badge">
          {{ itemsCountText }}
        </span>
      </div>

      <div class="header-right">
        <!-- コンパクト幅時のフィルターボタン -->
        <UButton
          v-if="isCompact"
          icon="i-lucide-filter"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="isSidebarOpen = true"
        />

        <UButton
          icon="i-lucide-folder-open"
          :label="isCompact ? undefined : t('apps.gallery.selectDirectory')"
          variant="subtle"
          color="primary"
          size="sm"
          @click="fileSystem.addMount()"
        />

        <UButton
          :icon="isMultiSelectMode ? 'i-lucide-check-square' : 'i-lucide-square'"
          :label="isCompact ? undefined : (isMultiSelectMode ? '選択解除' : '選択')"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="filteredItems.length === 0"
          @click="toggleMultiSelectMode"
        />

        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="isScanning || !fileSystem.activeMountId.value"
          @click="startScan"
        />
      </div>
    </header>

    <!-- メインボディ -->
    <div class="app-body">
      <!-- 通常のサイドバー (PC用) -->
      <aside v-if="!isCompact" class="sidebar">
        <nav class="sidebar-nav">
          <UButton
            icon="i-lucide-images"
            :label="t('apps.gallery.allMedia')"
            variant="ghost"
            block
            class="justify-start nav-item"
            :class="{ active: activeFilter.type === 'all' }"
            @click="activeFilter = { type: 'all' }"
          />
          <UButton
            icon="i-lucide-star"
            :label="t('apps.gallery.favorites')"
            variant="ghost"
            block
            class="justify-start nav-item"
            :class="{ active: activeFilter.type === 'favorite' }"
            @click="activeFilter = { type: 'favorite' }"
          />

          <div class="tags-section">
            <h2 class="section-title">
              <UIcon name="i-lucide-tag" />
              <span>{{ t('apps.gallery.tags') }}</span>
            </h2>
            <div class="tags-list">
              <UButton
                v-for="tag in allTags"
                :key="tag"
                icon="i-lucide-hash"
                :label="tag"
                variant="ghost"
                block
                class="justify-start tag-item"
                :class="{ active: activeFilter.type === 'tag' && activeFilter.tag === tag }"
                @click="activeFilter = { type: 'tag', tag }"
              />
              <span v-if="allTags.length === 0" class="no-tags">タグはありません</span>
            </div>
          </div>
        </nav>
      </aside>



      <!-- メディアグリッド領域 -->
      <main class="content-area">
        <template v-if="!fileSystem.activeMountId.value">
          <div class="empty-state">
            <UIcon name="i-lucide-folder-open" class="empty-icon" />
            <p class="empty-text">{{ t('apps.gallery.noDirectory') }}</p>
            <UButton
              label="マウントディレクトリを追加"
              color="primary"
              @click="fileSystem.addMount()"
            />
          </div>
        </template>

        <template v-else-if="isScanning && mediaItems.length === 0">
          <div class="loading-state animate-pulse">
            <UIcon name="i-lucide-loader-2" class="loading-spinner spin-icon" />
            <p>{{ t('apps.gallery.scanning', { count: scanCount }) }}</p>
          </div>
        </template>

        <template v-else-if="filteredItems.length === 0">
          <div class="empty-state">
            <UIcon name="i-lucide-image-off" class="empty-icon" />
            <p class="empty-text">{{ t('apps.gallery.empty') }}</p>
          </div>
        </template>

        <template v-else>
          <div class="grid-container">
            <div
              v-for="group in groupedItems"
              :key="group.title"
              class="timeline-group"
            >
              <h3 class="timeline-header">{{ group.title }}</h3>
              <div class="media-grid">
                <AppsGalleryItemCard
                  v-for="item in group.items"
                  :key="item.path"
                  :item="item"
                  :mount-id="fileSystem.activeMountId.value || ''"
                  :selected="selectedPaths.has(item.path)"
                  :favorite="getMetadata(item.path).favorite"
                  :is-multi-select-mode="isMultiSelectMode"
                  @click="handleItemClick(item, filteredItems.indexOf(item))"
                  @dblclick="handleItemDblClick(item, filteredItems.indexOf(item))"
                  @toggle-favorite="toggleFavorite(item.path)"
                />
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- 複数選択一括操作バー -->
    <transition name="slide-up">
      <div v-if="isMultiSelectMode && selectedPaths.size > 0" class="batch-bar animate-slide-up">
        <div class="batch-info">
          <span>{{ t('apps.gallery.selectedCount', { count: selectedPaths.size }) }}</span>
        </div>

        <div class="batch-actions">
          <UButton
            icon="i-lucide-select-all"
            label="すべて選択"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="selectAllFiltered"
          />
          <UButton
            icon="i-lucide-star"
            label="お気に入り切替"
            variant="subtle"
            color="warning"
            size="sm"
            @click="batchToggleFavorite"
          />

          <!-- タグ追加/削除ポップオーバー -->
          <UPopover v-model:open="isBatchTagOpen">
            <UButton
              icon="i-lucide-tag"
              label="タグ一括操作"
              variant="subtle"
              color="primary"
              size="sm"
            />
            
            <template #content>
              <div class="batch-tag-popover">
                <UInput
                  v-model="batchTagInput"
                  :placeholder="t('apps.gallery.newTagPlaceholder')"
                  size="sm"
                  class="mb-2"
                  @keyup.enter="batchAddTag"
                />
                <div class="flex gap-2">
                  <UButton label="追加" color="primary" size="xs" @click="batchAddTag" />
                  <UButton label="削除" color="neutral" variant="subtle" size="xs" @click="batchRemoveTag" />
                </div>
              </div>
            </template>
          </UPopover>

          <UButton
            icon="i-lucide-x"
            label="クリア"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="clearSelection"
          />
        </div>
      </div>
    </transition>

    <!-- ライトボックス (全画面オーバーレイプレビュー) -->
    <div v-if="currentLightboxItem" class="lightbox-overlay">
      <!-- ツールバー -->
      <div class="lightbox-toolbar">
        <div class="lt-left">
          <span class="lt-filename">{{ currentLightboxItem.name }}</span>
        </div>
        <div class="lt-right">
          <!-- スライドショーコントロール -->
          <div class="slideshow-controls">
            <UButton
              :icon="isSlideshowRunning ? 'i-lucide-pause' : 'i-lucide-play'"
              :color="isSlideshowRunning ? 'primary' : 'neutral'"
              variant="ghost"
              size="sm"
              @click="toggleSlideshow"
            />
            <USelect
              v-model="slideshowInterval"
              :items="[
                { label: '3秒', value: 3000 },
                { label: '5秒', value: 5000 },
                { label: '10秒', value: 10000 }
              ]"
              size="sm"
              class="w-20"
            />
            <UButton
              icon="i-lucide-shuffle"
              :color="slideshowShuffle ? 'primary' : 'neutral'"
              variant="ghost"
              size="sm"
              @click="slideshowShuffle = !slideshowShuffle"
            />
          </div>

          <UButton
            icon="i-lucide-info"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="isDetailPanelOpen = !isDetailPanelOpen"
          />
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="closeLightbox"
          />
        </div>
      </div>

      <!-- 本体 (画像/動画 + 左右ナビゲーション) -->
      <div class="lightbox-body" :class="{ 'detail-open': isDetailPanelOpen && !isCompact }">
        <button class="nav-arrow prev animate-pulse" @click="prevItem">
          <UIcon name="i-lucide-chevron-left" />
        </button>

        <div class="lightbox-canvas">
          <template v-if="lightboxMediaUrl">
            <img
              v-if="currentLightboxItem.type === 'image'"
              :src="lightboxMediaUrl"
              class="lightbox-img"
              alt=""
            >
            <video
              v-else-if="currentLightboxItem.type === 'video'"
              :src="lightboxMediaUrl"
              class="lightbox-video"
              controls
              autoplay
              @ended="handleVideoEnded"
            ></video>
          </template>
          <div v-else class="lightbox-loading">
            <UIcon name="i-lucide-loader-2" class="spin-icon" />
          </div>
        </div>

        <button class="nav-arrow next animate-pulse" @click="nextItem">
          <UIcon name="i-lucide-chevron-right" />
        </button>

        <!-- メタデータ＆詳細パネル (PC時は右、コンパクト時は画面下部かトグルで表示) -->
        <transition name="slide-left">
          <aside v-if="isDetailPanelOpen" class="detail-panel">
            <div class="detail-header">
              <h3>詳細情報</h3>
            </div>

            <div class="detail-content">
              <div class="info-group">
                <span class="info-label">ファイル名</span>
                <span class="info-value">{{ currentLightboxItem.name }}</span>
              </div>
              <div class="info-group">
                <span class="info-label">更新日時</span>
                <span class="info-value">{{ new Date(currentLightboxItem.lastModified).toLocaleString() }}</span>
              </div>
              <div class="info-group">
                <span class="info-label">サイズ</span>
                <span class="info-value">{{ (currentLightboxItem.size / 1024 / 1024).toFixed(2) }} MB</span>
              </div>
              <div class="info-group">
                <span class="info-label">パス</span>
                <span class="info-value break-all">{{ currentLightboxItem.path }}</span>
              </div>

              <hr class="panel-divider" />

              <!-- お気に入りトグル -->
              <div class="fav-section">
                <UButton
                  :icon="getMetadata(currentLightboxItem.path).favorite ? 'i-lucide-star-solid' : 'i-lucide-star'"
                  :label="getMetadata(currentLightboxItem.path).favorite ? 'お気に入りから外す' : 'お気に入りに追加'"
                  :color="getMetadata(currentLightboxItem.path).favorite ? 'warning' : 'neutral'"
                  variant="subtle"
                  block
                  @click="toggleFavorite(currentLightboxItem.path)"
                />
              </div>

              <!-- タグセクション -->
              <div class="tags-edit-section">
                <h4>タグ</h4>
                <div class="lightbox-tags-list">
                  <span
                    v-for="tag in getMetadata(currentLightboxItem.path).tags"
                    :key="tag"
                    class="tag-badge"
                  >
                    #{{ tag }}
                    <button class="remove-tag-btn" @click="removeTag(currentLightboxItem.path, tag)">
                      <UIcon name="i-lucide-x" />
                    </button>
                  </span>
                </div>

                <div class="tag-input-row">
                  <UInput
                    v-model="newTagInput"
                    :placeholder="t('apps.gallery.newTagPlaceholder')"
                    size="sm"
                    class="flex-1"
                    @keyup.enter="addTag(currentLightboxItem.path, newTagInput); newTagInput = ''"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    color="primary"
                    size="sm"
                    @click="addTag(currentLightboxItem.path, newTagInput); newTagInput = ''"
                  />
                </div>
              </div>
            </div>
          </aside>
        </transition>
      </div>
    </div>

    <!-- 自前モバイル用サイドバー (インウィンドウ・ドロワー) -->
    <transition name="slide-right">
      <div v-if="isCompact && isSidebarOpen" class="mobile-drawer-backdrop" @click="isSidebarOpen = false">
        <div class="mobile-drawer-content" @click.stop>
          <div class="drawer-header">
            <h3>フィルター</h3>
            <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" @click="isSidebarOpen = false" />
          </div>
          <div class="mobile-sidebar-content">
            <UButton
              icon="i-lucide-images"
              :label="t('apps.gallery.allMedia')"
              variant="ghost"
              block
              class="justify-start nav-item"
              :class="{ active: activeFilter.type === 'all' }"
              @click="activeFilter = { type: 'all' }; isSidebarOpen = false"
            />
            <UButton
              icon="i-lucide-star"
              :label="t('apps.gallery.favorites')"
              variant="ghost"
              block
              class="justify-start nav-item"
              :class="{ active: activeFilter.type === 'favorite' }"
              @click="activeFilter = { type: 'favorite' }; isSidebarOpen = false"
            />

            <div class="tags-section">
              <h2 class="section-title">
                <UIcon name="i-lucide-tag" />
                <span>{{ t('apps.gallery.tags') }}</span>
              </h2>
              <div class="tags-list">
                <UButton
                  v-for="tag in allTags"
                  :key="tag"
                  icon="i-lucide-hash"
                  :label="tag"
                  variant="ghost"
                  block
                  class="justify-start tag-item"
                  :class="{ active: activeFilter.type === 'tag' && activeFilter.tag === tag }"
                  @click="activeFilter = { type: 'tag', tag }; isSidebarOpen = false"
                />
                <span v-if="allTags.length === 0" class="no-tags">タグはありません</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.gallery-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
  position: relative;
}

/* ヘッダー */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo-icon {
  font-size: 1.4rem;
  color: var(--ui-primary);
}

.app-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.scan-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(244, 63, 94, 0.1);
  color: var(--ui-primary);
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 9999px;
  font-weight: 500;
}

.items-count-badge {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
  padding: 2px 8px;
  border-radius: 9999px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* メインボディ */
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

/* サイドバー */
.sidebar {
  width: 200px;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  padding: 12px;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  color: var(--ui-text);
  font-size: 0.85rem;
  font-weight: 500;
}

.nav-item.active {
  background: rgba(244, 63, 94, 0.1);
  color: var(--ui-primary);
}

.tags-section {
  margin-top: 16px;
  border-top: 1px solid var(--ui-border);
  padding-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--ui-text-muted);
  margin-bottom: 8px;
  padding-left: 8px;
}

.tags-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-item {
  font-size: 0.8rem;
  color: var(--ui-text-muted);
}

.tag-item.active {
  color: var(--ui-primary);
  background: rgba(244, 63, 94, 0.05);
}

.no-tags {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  padding-left: 8px;
  font-style: italic;
}

/* モバイル用サイドバーコンテンツ */
.mobile-sidebar-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* コンテンツエリア */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--ui-bg-muted);
  position: relative;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80%;
  text-align: center;
  color: var(--ui-text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 0.9rem;
  margin-bottom: 16px;
  max-width: 320px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80%;
  gap: 12px;
  color: var(--ui-text-muted);
}

.loading-spinner {
  font-size: 2.5rem;
}

.grid-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.timeline-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-header {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ui-text);
  border-left: 4px solid var(--ui-primary);
  padding-left: 8px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

/* 一括操作バー */
.batch-bar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
  padding: 8px 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 50;
  max-width: 90%;
}

.dark .batch-bar {
  background: rgba(30, 30, 30, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
}

.batch-info {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ui-text);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-tag-popover {
  padding: 10px;
  display: flex;
  flex-direction: column;
  width: 180px;
}

/* ライトボックス */
.lightbox-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #000;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.lightbox-toolbar {
  height: 48px;
  background: rgba(15, 15, 15, 0.9);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.lt-filename {
  font-size: 0.85rem;
  font-weight: 500;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lt-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slideshow-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding-right: 12px;
  margin-right: 4px;
}

.lightbox-body {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.lightbox-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.lightbox-img,
.lightbox-video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.lightbox-loading {
  color: #fff;
  font-size: 2rem;
}

.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: background 0.2s;
  z-index: 10;
}

.nav-arrow:hover {
  background: rgba(255, 255, 255, 0.25);
}

.nav-arrow.prev {
  left: 20px;
}

.nav-arrow.next {
  right: 20px;
}

/* 詳細パネル */
.detail-panel {
  width: 300px;
  background: #151515;
  color: #eee;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s;
}

.detail-header {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
}

.detail-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
}

.info-value {
  font-size: 0.8rem;
  word-break: break-all;
}

.panel-divider {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.tags-edit-section h4 {
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #888;
}

.lightbox-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.tag-badge {
  background: rgba(244, 63, 94, 0.2);
  color: #fda4af;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.remove-tag-btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
}

.remove-tag-btn:hover {
  color: #fff;
}

.tag-input-row {
  display: flex;
  gap: 6px;
}

/* アニメーション用スピン */
.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* レスポンシブ調整 */
.compact .sidebar {
  display: none;
}

.compact .media-grid {
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 6px;
}

.compact .lightbox-body {
  flex-direction: column;
}

.compact .detail-panel {
  width: 100%;
  height: 200px;
  border-left: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.compact .nav-arrow {
  width: 36px;
  height: 36px;
  font-size: 1.2rem;
}

.compact .nav-arrow.prev {
  left: 10px;
}

.compact .nav-arrow.next {
  right: 10px;
}

/* トランジション */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}

/* 自前ドロワー */
.mobile-drawer-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
}

.mobile-drawer-content {
  width: 240px;
  height: 100%;
  background: var(--ui-bg-elevated);
  border-right: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ui-border);
}

.drawer-header h3 {
  font-size: 0.9rem;
  font-weight: 600;
}

/* スライドアニメーション */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity 0.25s ease;
}
.slide-right-enter-active .mobile-drawer-content,
.slide-right-leave-active .mobile-drawer-content {
  transition: transform 0.25s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
}
.slide-right-enter-from .mobile-drawer-content {
  transform: translateX(-100%);
}
.slide-right-leave-to .mobile-drawer-content {
  transform: translateX(-100%);
}
</style>
