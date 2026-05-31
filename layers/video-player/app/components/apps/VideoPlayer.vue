<script setup lang="ts">
const props = defineProps<{ windowId: string }>()

const { t } = useI18n()
const store = useDesktopStore()

/** ビデオアイテム情報 */
interface VideoItem {
  /** 表示名（ファイル名から拡張子を除いた値） */
  name: string
  /** Object URL */
  url: string
  /** 元の File オブジェクト */
  file: File
}

/** リピートモード */
type RepeatMode = 'none' | 'one' | 'all'

// ─── 状態 ──────────────────────────────────────────────────

/** プレイリスト */
const videos = ref<VideoItem[]>([])
/** 現在再生中のインデックス */
const currentIndex = ref<number>(-1)
/** 再生中かどうか */
const isPlaying = ref(false)
/** シャッフルモードかどうか */
const isShuffle = ref(false)
/** リピートモード */
const repeatMode = ref<RepeatMode>('none')
/** 再生位置（秒） */
const currentTime = ref(0)
/** ビデオの総再生時間（秒） */
const duration = ref(0)
/** 音量（0〜1） */
const volume = ref(0.8)
/** ミュート状態 */
const isMuted = ref(false)
/** 再生速度 */
const playbackRate = ref(1)
/** ドラッグオーバー中フラグ */
const isDragOver = ref(false)
/** プレイリストパネル表示フラグ */
const showPlaylist = ref(true)
/** コントロールバー表示フラグ（自動非表示） */
const showControls = ref(true)
/** ビデオのメタ情報（幅・高さ） */
const videoInfo = ref<{ width: number, height: number } | null>(null)
/** コンテナ幅（ResizeObserver で更新） */
const containerWidth = ref(800)

// ─── DOM 参照 ─────────────────────────────────────────────

/** `<video>` 要素への参照 */
const videoRef = ref<HTMLVideoElement | null>(null)
/** ファイル入力への参照 */
const fileInputRef = ref<HTMLInputElement | null>(null)
/** コンテナ要素への参照 */
const containerRef = ref<HTMLDivElement | null>(null)

// ─── 自動非表示タイマー ────────────────────────────────────

/** コントロール自動非表示タイマー ID */
let hideControlsTimer: ReturnType<typeof setTimeout> | null = null

/** コントロールのアクティビティをリセットし 3 秒後に非表示にする */
function resetHideControlsTimer(): void {
  showControls.value = true
  if (hideControlsTimer !== null) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }
  if (isPlaying.value) {
    hideControlsTimer = setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

// ─── ResizeObserver ────────────────────────────────────────

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

/** 幅が 600px 未満をコンパクトモードと判定 */
const isCompact = computed(() => containerWidth.value < 600)

// コンパクトモード時にプレイリストを自動非表示
watch(isCompact, (compact) => {
  if (compact) showPlaylist.value = false
})

// ─── ファイル管理 ──────────────────────────────────────────

/** File オブジェクトからビデオ名を生成する（拡張子除去） */
function videoNameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || t('apps.videoPlayer.unknownVideo')
}

/** FileList / File[] からビデオをプレイリストに追加する */
function addFiles(files: FileList | File[]): void {
  const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'))
  for (const file of videoFiles) {
    const url = URL.createObjectURL(file)
    videos.value.push({ name: videoNameFromFile(file), url, file })
  }
  // 初回追加時は先頭を選択
  if (currentIndex.value === -1 && videos.value.length > 0) {
    loadVideo(0)
  }
}

/** 指定インデックスのビデオをプレイリストから削除する */
function removeVideo(index: number): void {
  const item = videos.value[index]
  if (!item) return
  URL.revokeObjectURL(item.url)
  videos.value.splice(index, 1)

  if (index < currentIndex.value) {
    currentIndex.value--
  } else if (index === currentIndex.value) {
    isPlaying.value = false
    if (videos.value.length > 0) {
      const next = Math.min(index, videos.value.length - 1)
      loadVideo(next)
    } else {
      currentIndex.value = -1
      currentTime.value = 0
      duration.value = 0
      videoInfo.value = null
      if (videoRef.value) videoRef.value.src = ''
    }
  }
}

// ─── 再生制御 ──────────────────────────────────────────────

/** 指定インデックスのビデオを `<video>` にロードする */
function loadVideo(index: number): void {
  const item = videos.value[index]
  if (!item || !videoRef.value) return
  currentIndex.value = index
  videoRef.value.src = item.url
  videoRef.value.load()
  videoRef.value.playbackRate = playbackRate.value
  currentTime.value = 0
  duration.value = 0
  videoInfo.value = null
}

/** 再生 / 一時停止を切り替える */
async function togglePlay(): Promise<void> {
  if (!videoRef.value) return
  if (currentIndex.value === -1 && videos.value.length > 0) {
    loadVideo(0)
  }
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    try {
      await videoRef.value.play()
    } catch {
      // 自動再生ポリシーやユーザー操作なし等で再生が拒否された場合は状態を維持
      isPlaying.value = false
      showControls.value = true
    }
  }
}

/** 次のビデオを再生する */
function nextVideo(): void {
  if (videos.value.length === 0) return
  let next: number
  if (isShuffle.value) {
    next = Math.floor(Math.random() * videos.value.length)
  } else {
    next = currentIndex.value + 1
    if (next >= videos.value.length) next = 0
  }
  loadVideo(next)
  if (isPlaying.value) videoRef.value?.play()
}

/** 前のビデオを再生する（再生位置が 3 秒以上の場合は先頭へ戻る） */
function prevVideo(): void {
  if (videos.value.length === 0) return
  if (currentTime.value > 3) {
    if (videoRef.value) videoRef.value.currentTime = 0
    return
  }
  let prev = currentIndex.value - 1
  if (prev < 0) prev = videos.value.length - 1
  loadVideo(prev)
  if (isPlaying.value) videoRef.value?.play()
}

/** 再生速度を変更する */
function setPlaybackRate(rate: number): void {
  playbackRate.value = rate
  if (videoRef.value) videoRef.value.playbackRate = rate
}

/** ミュートを切り替える */
function toggleMute(): void {
  isMuted.value = !isMuted.value
  if (videoRef.value) videoRef.value.muted = isMuted.value
}

/** リピートモードを次のモードに切り替える */
function cycleRepeat(): void {
  const modes: RepeatMode[] = ['none', 'one', 'all']
  const idx = modes.indexOf(repeatMode.value)
  repeatMode.value = modes[(idx + 1) % modes.length] ?? 'none'
}

/** リピートアイコン名を返す */
const repeatIcon = computed(() => {
  if (repeatMode.value === 'one') return 'i-lucide-repeat-1'
  return 'i-lucide-repeat'
})

/** リピートがアクティブかどうか */
const repeatActive = computed(() => repeatMode.value !== 'none')

// ─── Picture-in-Picture ───────────────────────────────────

/** PiP をトグルする */
async function togglePiP(): Promise<void> {
  if (!videoRef.value) return
  if (!document.pictureInPictureEnabled || !('requestPictureInPicture' in videoRef.value)) return
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      await videoRef.value.requestPictureInPicture()
    }
  } catch {
    // 未対応環境やセキュリティ制約で失敗した場合は無視
  }
}

// ─── フルスクリーン ────────────────────────────────────────

/** フルスクリーンをトグルする */
async function toggleFullscreen(): Promise<void> {
  if (!videoRef.value || !document.fullscreenEnabled) return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await videoRef.value.requestFullscreen()
    }
  } catch {
    // 未対応環境やセキュリティ制約で失敗した場合は無視
  }
}

// ─── シーク / 音量 ────────────────────────────────────────

/** シークバー操作時に再生位置を更新する */
function handleSeek(e: Event): void {
  const input = e.target as HTMLInputElement
  if (!videoRef.value) return
  videoRef.value.currentTime = Number(input.value)
}

/** 音量スライダー操作時に音量を更新する */
function handleVolumeChange(e: Event): void {
  const input = e.target as HTMLInputElement
  volume.value = Number(input.value)
  if (videoRef.value) {
    videoRef.value.volume = volume.value
    if (volume.value > 0) isMuted.value = false
  }
}

// ─── 時間フォーマット ──────────────────────────────────────

/** 秒数を mm:ss 形式の文字列に変換する */
function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── キーボードショートカット ──────────────────────────────

/** キーボードショートカットを処理する（このウィンドウが最前面の場合のみ動作） */
function handleKeydown(e: KeyboardEvent): void {
  // このウィンドウが最前面でない場合は無視
  if (store.topWindow?.id !== props.windowId) return
  // フォーム要素内の操作は無視
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  switch (e.key) {
    case ' ':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (videoRef.value) {
        videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime - 5)
      }
      break
    case 'ArrowRight':
      e.preventDefault()
      if (videoRef.value) {
        videoRef.value.currentTime = Math.min(duration.value, videoRef.value.currentTime + 5)
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      volume.value = Math.min(1, volume.value + 0.1)
      if (videoRef.value) {
        videoRef.value.volume = volume.value
        if (volume.value > 0) {
          isMuted.value = false
          videoRef.value.muted = false
        }
      }
      break
    case 'ArrowDown':
      e.preventDefault()
      volume.value = Math.max(0, volume.value - 0.1)
      if (videoRef.value) {
        videoRef.value.volume = volume.value
        if (volume.value === 0) {
          isMuted.value = true
          videoRef.value.muted = true
        }
      }
      break
  }
  resetHideControlsTimer()
}

// ─── video イベントハンドラ ────────────────────────────────

function onTimeUpdate(): void {
  if (videoRef.value) currentTime.value = videoRef.value.currentTime
}

function onLoadedMetadata(): void {
  if (!videoRef.value) return
  duration.value = videoRef.value.duration
  videoInfo.value = { width: videoRef.value.videoWidth, height: videoRef.value.videoHeight }
  videoRef.value.volume = volume.value
  videoRef.value.muted = isMuted.value
  videoRef.value.playbackRate = playbackRate.value
}

function onPlay(): void {
  isPlaying.value = true
  resetHideControlsTimer()
}

function onPause(): void {
  isPlaying.value = false
  showControls.value = true
  if (hideControlsTimer !== null) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }
}

function onEnded(): void {
  isPlaying.value = false
  if (repeatMode.value === 'one') {
    videoRef.value?.play()
    return
  }
  if (repeatMode.value === 'all' || currentIndex.value < videos.value.length - 1) {
    nextVideo()
  }
}

// ─── ドラッグ&ドロップ ─────────────────────────────────────

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave(): void {
  isDragOver.value = false
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) addFiles(files)
}

// ─── ファイルピッカー ──────────────────────────────────────

function openFilePicker(): void {
  fileInputRef.value?.click()
}

function onFileInputChange(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    addFiles(input.files)
    input.value = ''
  }
}

// ─── ライフサイクル ────────────────────────────────────────

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (hideControlsTimer !== null) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }
  for (const item of videos.value) {
    URL.revokeObjectURL(item.url)
  }
})

// ─── 現在のビデオ名 ────────────────────────────────────────

/** 現在再生中のビデオ名を返す */
const currentVideoName = computed((): string => {
  const item = videos.value[currentIndex.value]
  return item?.name ?? ''
})

/** 再生速度の選択肢 */
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

/** 再生速度メニュー項目 */
const playbackRateItems = computed(() =>
  playbackRates.map(rate => ({
    label: rate === 1 ? `${rate}x (標準)` : `${rate}x`,
    onSelect: () => setPlaybackRate(rate)
  }))
)
</script>

<template>
  <div
    ref="containerRef"
    class="video-player flex h-full bg-black select-none overflow-hidden"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 非表示ファイル入力 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="video/*"
      multiple
      class="hidden"
      @change="onFileInputChange"
    >

    <!-- メインビデオエリア -->
    <div
      class="relative flex-1 flex items-center justify-center bg-black overflow-hidden"
      @mousemove="resetHideControlsTimer"
      @click="togglePlay"
    >
      <!-- ビデオ未読込み時: ドロップゾーン -->
      <div
        v-if="videos.length === 0"
        class="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer"
        :class="isDragOver ? 'bg-purple-500/10 border-2 border-dashed border-purple-500' : 'border-2 border-dashed border-white/10'"
        @click.stop="openFilePicker"
      >
        <UIcon
          name="i-lucide-video"
          class="text-5xl text-white/30"
        />
        <p class="text-white/50 text-sm text-center px-6">
          {{ t('apps.videoPlayer.noVideos') }}
        </p>
        <UButton
          icon="i-lucide-plus"
          :label="t('apps.videoPlayer.addFiles')"
          color="neutral"
          variant="outline"
          @click.stop="openFilePicker"
        />
      </div>

      <!-- ビデオ要素 -->
      <video
        ref="videoRef"
        class="max-w-full max-h-full object-contain"
        :class="{ hidden: videos.length === 0 }"
        preload="metadata"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
      />

      <!-- ドラッグオーバーレイ（ビデオ読込み後） -->
      <Transition name="fade">
        <div
          v-if="isDragOver && videos.length > 0"
          class="absolute inset-0 flex items-center justify-center bg-purple-500/20 border-2 border-dashed border-purple-400 pointer-events-none z-10"
        >
          <span class="text-white font-medium text-sm bg-black/50 px-4 py-2 rounded-lg">
            {{ t('apps.videoPlayer.addFiles') }}
          </span>
        </div>
      </Transition>

      <!-- コントロールバー（自動非表示） -->
      <Transition name="controls">
        <div
          v-if="videos.length > 0 && showControls"
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-3 flex flex-col gap-2 z-10"
          @click.stop
        >
          <!-- プログレスバー -->
          <div class="flex items-center gap-2 text-xs text-white/70">
            <span class="w-10 text-right tabular-nums">{{ formatTime(currentTime) }}</span>
            <input
              type="range"
              class="flex-1 accent-purple-400 h-1 cursor-pointer"
              :min="0"
              :max="duration || 0"
              :value="currentTime"
              step="0.1"
              @input="handleSeek"
              @click.stop
            >
            <span class="w-10 tabular-nums">{{ formatTime(duration) }}</span>
          </div>

          <!-- コントロールボタン群 -->
          <div class="flex items-center gap-1">
            <!-- 再生/一時停止 -->
            <UButton
              :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
              variant="ghost"
              size="sm"
              color="neutral"
              class="text-white hover:bg-white/20"
              @click.stop="togglePlay"
            />
            <!-- 前へ -->
            <UButton
              icon="i-lucide-skip-back"
              variant="ghost"
              size="sm"
              color="neutral"
              :disabled="videos.length === 0"
              class="text-white hover:bg-white/20"
              @click.stop="prevVideo"
            />
            <!-- 次へ -->
            <UButton
              icon="i-lucide-skip-forward"
              variant="ghost"
              size="sm"
              color="neutral"
              :disabled="videos.length === 0"
              class="text-white hover:bg-white/20"
              @click.stop="nextVideo"
            />

            <!-- 音量 -->
            <UButton
              :icon="isMuted || volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              variant="ghost"
              size="sm"
              color="neutral"
              class="text-white hover:bg-white/20"
              :title="isMuted ? t('apps.videoPlayer.unmute') : t('apps.videoPlayer.mute')"
              @click.stop="toggleMute"
            />
            <input
              type="range"
              class="w-20 accent-purple-400 h-1 cursor-pointer"
              :min="0"
              :max="1"
              step="0.05"
              :value="isMuted ? 0 : volume"
              @input="handleVolumeChange"
              @click.stop
            >

            <!-- ビデオ名（中央） -->
            <span
              v-if="currentVideoName && !isCompact"
              class="flex-1 text-xs text-white/80 truncate text-center px-2"
              :title="currentVideoName"
            >{{ currentVideoName }}</span>
            <span
              v-else
              class="flex-1"
            />

            <!-- 再生速度 -->
            <UDropdownMenu
              :items="playbackRateItems"
              :content="{ align: 'end' }"
            >
              <UButton
                variant="ghost"
                size="xs"
                color="neutral"
                class="text-white/70 hover:bg-white/20 tabular-nums font-mono"
                :label="`${playbackRate}x`"
                @click.stop
              />
            </UDropdownMenu>

            <!-- シャッフル -->
            <UButton
              icon="i-lucide-shuffle"
              variant="ghost"
              size="sm"
              color="neutral"
              :class="['hover:bg-white/20', isShuffle ? 'text-purple-400' : 'text-white']"
              :title="t('apps.videoPlayer.shuffle')"
              @click.stop="isShuffle = !isShuffle"
            />

            <!-- リピート -->
            <UButton
              :icon="repeatIcon"
              variant="ghost"
              size="sm"
              color="neutral"
              :class="['hover:bg-white/20', repeatActive ? 'text-purple-400' : 'text-white']"
              :title="t(`apps.videoPlayer.repeat${repeatMode.charAt(0).toUpperCase() + repeatMode.slice(1)}`)"
              @click.stop="cycleRepeat"
            />

            <!-- プレイリストトグル -->
            <UButton
              icon="i-lucide-list-video"
              variant="ghost"
              size="sm"
              color="neutral"
              :class="['hover:bg-white/20', showPlaylist ? 'text-purple-400' : 'text-white']"
              :title="showPlaylist ? t('apps.videoPlayer.hidePlaylist') : t('apps.videoPlayer.showPlaylist')"
              @click.stop="showPlaylist = !showPlaylist"
            />

            <!-- PiP -->
            <UButton
              icon="i-lucide-picture-in-picture"
              variant="ghost"
              size="sm"
              color="neutral"
              class="text-white hover:bg-white/20"
              :title="t('apps.videoPlayer.pip')"
              @click.stop="togglePiP"
            />

            <!-- フルスクリーン -->
            <UButton
              icon="i-lucide-maximize"
              variant="ghost"
              size="sm"
              color="neutral"
              class="text-white hover:bg-white/20"
              :title="t('apps.videoPlayer.fullscreen')"
              @click.stop="toggleFullscreen"
            />
          </div>
        </div>
      </Transition>
    </div>

    <!-- プレイリストパネル -->
    <Transition name="slide-right">
      <div
        v-if="showPlaylist"
        class="flex flex-col bg-(--ui-bg) border-l border-(--ui-border) overflow-hidden"
        :style="{ width: isCompact ? '100%' : '220px' }"
      >
        <!-- パネルヘッダー -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-(--ui-border) shrink-0">
          <span class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">
            {{ t('apps.videoPlayer.playlist') }}
            <span class="ml-1">({{ videos.length }})</span>
          </span>
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-plus"
              size="xs"
              variant="ghost"
              color="neutral"
              :title="t('apps.videoPlayer.addFiles')"
              @click="openFilePicker"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="showPlaylist = false"
            />
          </div>
        </div>

        <!-- ビデオ一覧 -->
        <div
          v-if="videos.length === 0"
          class="flex flex-col items-center justify-center flex-1 gap-2 text-(--ui-text-muted)"
        >
          <UIcon
            name="i-lucide-video-off"
            class="text-3xl opacity-30"
          />
          <p class="text-xs text-center px-4">
            {{ t('apps.videoPlayer.noVideos') }}
          </p>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            variant="outline"
            color="neutral"
            :label="t('apps.videoPlayer.addFiles')"
            @click="openFilePicker"
          />
        </div>

        <ul
          v-else
          class="flex-1 overflow-y-auto"
        >
          <li
            v-for="(item, index) in videos"
            :key="item.url"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--ui-bg-elevated) transition-colors group"
            :class="{ 'bg-(--ui-bg-elevated)': index === currentIndex }"
            @click="loadVideo(index); if (!isPlaying) togglePlay()"
          >
            <!-- 再生中インジケーター -->
            <div class="w-4 shrink-0 flex items-center justify-center">
              <UIcon
                v-if="index === currentIndex && isPlaying"
                name="i-lucide-volume-2"
                class="text-purple-500 text-xs"
              />
              <span
                v-else-if="index !== currentIndex"
                class="text-xs text-(--ui-text-muted) group-hover:hidden"
              >{{ index + 1 }}</span>
              <UIcon
                v-if="index !== currentIndex || !isPlaying"
                name="i-lucide-play"
                class="text-xs text-(--ui-text-muted) hidden group-hover:block"
              />
            </div>

            <!-- ビデオ名 -->
            <span
              class="flex-1 text-xs truncate"
              :class="index === currentIndex ? 'text-purple-500 font-medium' : 'text-(--ui-text)'"
              :title="item.name"
            >{{ item.name }}</span>

            <!-- 削除ボタン -->
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="xs"
              color="neutral"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              :title="t('apps.videoPlayer.removeVideo')"
              @click.stop="removeVideo(index)"
            />
          </li>
        </ul>

        <!-- フッター: ファイル追加 -->
        <div class="shrink-0 px-3 py-2 border-t border-(--ui-border)">
          <UButton
            icon="i-lucide-plus"
            :label="t('apps.videoPlayer.addFiles')"
            size="xs"
            variant="outline"
            color="neutral"
            class="w-full justify-center"
            @click="openFilePicker"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.controls-enter-active,
.controls-leave-active {
  transition: opacity 0.3s ease;
}
.controls-enter-from,
.controls-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
