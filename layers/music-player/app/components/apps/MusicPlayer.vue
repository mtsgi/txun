<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()

/** トラック情報 */
interface Track {
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
const tracks = ref<Track[]>([])
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
/** トラックの総再生時間（秒） */
const duration = ref(0)
/** 音量（0〜1） */
const volume = ref(0.8)
/** ドラッグ中フラグ */
const isDragging = ref(false)

// ─── DOM 参照 ─────────────────────────────────────────────

/** `<audio>` 要素への参照 */
const audioRef = ref<HTMLAudioElement | null>(null)
/** Canvas 要素への参照 */
const canvasRef = ref<HTMLCanvasElement | null>(null)
/** ファイル入力への参照 */
const fileInputRef = ref<HTMLInputElement | null>(null)

// ─── Web Audio API ────────────────────────────────────────

/** AudioContext（最初の再生操作で初期化） */
let audioCtx: AudioContext | null = null
/** AnalyserNode */
let analyser: AnalyserNode | null = null
/** MediaElementSource（`<audio>` との接続、1回だけ作成） */
let sourceNode: MediaElementAudioSourceNode | null = null
/** requestAnimationFrame ID */
let rafId: number | null = null

/** AudioContext と AnalyserNode を初期化する（冪等） */
function ensureAudioContext(): void {
  if (audioCtx) return
  audioCtx = new AudioContext()
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  analyser.connect(audioCtx.destination)

  if (audioRef.value && !sourceNode) {
    sourceNode = audioCtx.createMediaElementSource(audioRef.value)
    sourceNode.connect(analyser)
  }
}

/** Canvas にバーチャート（周波数スペクトラム）を描画する */
function drawVisualizer(): void {
  if (!analyser || !canvasRef.value) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  analyser.getByteFrequencyData(dataArray)

  const W = canvas.width
  const H = canvas.height
  ctx.clearRect(0, 0, W, H)

  const barCount = 48
  const step = Math.floor(bufferLength / barCount)
  const barW = W / barCount - 1

  for (let i = 0; i < barCount; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) {
      sum += dataArray[i * step + j] ?? 0
    }
    const avg = sum / step
    const barH = (avg / 255) * H

    const hue = 260 + (i / barCount) * 60
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`
    ctx.fillRect(i * (barW + 1), H - barH, barW, barH)
  }

  rafId = requestAnimationFrame(drawVisualizer)
}

/** ビジュアライザーのアニメーションを開始する */
function startVisualizer(): void {
  if (rafId !== null) return
  drawVisualizer()
}

/** ビジュアライザーのアニメーションを停止する */
function stopVisualizer(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  // Canvas をクリア
  if (canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d')
    ctx?.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  }
}

// ─── ファイル管理 ──────────────────────────────────────────

/** File オブジェクトからトラック名を生成する（拡張子除去） */
function trackNameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || t('apps.musicPlayer.unknownTrack')
}

/** File[] からトラックを追加する */
function addFiles(files: FileList | File[]): void {
  const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/'))
  for (const file of audioFiles) {
    const url = URL.createObjectURL(file)
    tracks.value.push({ name: trackNameFromFile(file), url, file })
  }
  // 追加直後にプレイリストが空だった場合は先頭を選択
  if (currentIndex.value === -1 && tracks.value.length > 0) {
    loadTrack(0)
  }
}

/** 指定インデックスのトラックをプレイリストから削除する */
function removeTrack(index: number): void {
  const track = tracks.value[index]
  if (!track) return
  URL.revokeObjectURL(track.url)
  tracks.value.splice(index, 1)

  if (index < currentIndex.value) {
    currentIndex.value--
  } else if (index === currentIndex.value) {
    stopVisualizer()
    isPlaying.value = false
    if (tracks.value.length > 0) {
      const next = Math.min(index, tracks.value.length - 1)
      loadTrack(next)
    } else {
      currentIndex.value = -1
      currentTime.value = 0
      duration.value = 0
    }
  }
}

// ─── 再生制御 ──────────────────────────────────────────────

/** 指定インデックスのトラックを `<audio>` にロードする */
function loadTrack(index: number): void {
  const track = tracks.value[index]
  if (!track || !audioRef.value) return
  currentIndex.value = index
  audioRef.value.src = track.url
  audioRef.value.load()
  currentTime.value = 0
  duration.value = 0
}

/** 再生 / 一時停止を切り替える */
async function togglePlay(): Promise<void> {
  if (!audioRef.value) return
  if (currentIndex.value === -1 && tracks.value.length > 0) {
    loadTrack(0)
  }
  ensureAudioContext()
  if (audioCtx?.state === 'suspended') {
    await audioCtx.resume()
  }

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    await audioRef.value.play()
  }
}

/** 次のトラックを再生する */
function nextTrack(): void {
  if (tracks.value.length === 0) return
  let next: number
  if (isShuffle.value) {
    next = Math.floor(Math.random() * tracks.value.length)
  } else {
    next = currentIndex.value + 1
    if (next >= tracks.value.length) next = 0
  }
  loadTrack(next)
  if (isPlaying.value) audioRef.value?.play()
}

/** 前のトラックを再生する（再生位置が 3 秒以上の場合は先頭へ戻る） */
function prevTrack(): void {
  if (tracks.value.length === 0) return
  if (currentTime.value > 3) {
    if (audioRef.value) audioRef.value.currentTime = 0
    return
  }
  let prev = currentIndex.value - 1
  if (prev < 0) prev = tracks.value.length - 1
  loadTrack(prev)
  if (isPlaying.value) audioRef.value?.play()
}

/** リピートモードを次のモードに切り替える */
function cycleRepeat(): void {
  const modes: RepeatMode[] = ['none', 'one', 'all']
  const idx = modes.indexOf(repeatMode.value)
  repeatMode.value = modes[(idx + 1) % modes.length] ?? 'none'
}

/** 現在のリピートアイコンクラスを返す */
const repeatIcon = computed(() => {
  if (repeatMode.value === 'one') return 'i-lucide-repeat-1'
  return 'i-lucide-repeat'
})

/** 現在のリピートアイコン色を返す */
const repeatActive = computed(() => repeatMode.value !== 'none')

// ─── シーク / 音量 ────────────────────────────────────────

/** シークバー操作時に再生位置を更新する */
function handleSeek(e: Event): void {
  const input = e.target as HTMLInputElement
  if (!audioRef.value) return
  audioRef.value.currentTime = Number(input.value)
}

/** 音量スライダー操作時に音量を更新する */
function handleVolumeChange(e: Event): void {
  const input = e.target as HTMLInputElement
  volume.value = Number(input.value)
  if (audioRef.value) audioRef.value.volume = volume.value
}

// ─── 時間フォーマット ──────────────────────────────────────

/** 秒数を mm:ss 形式の文字列に変換する */
function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── audio イベントハンドラ ────────────────────────────────

/** `<audio>` の timeupdate イベントで再生位置を同期する */
function onTimeUpdate(): void {
  if (audioRef.value) currentTime.value = audioRef.value.currentTime
}

/** `<audio>` の loadedmetadata イベントで総時間を取得する */
function onLoadedMetadata(): void {
  if (audioRef.value) duration.value = audioRef.value.duration
}

/** `<audio>` の play イベント */
function onPlay(): void {
  isPlaying.value = true
  startVisualizer()
}

/** `<audio>` の pause / ended イベント */
function onPause(): void {
  isPlaying.value = false
}

/** `<audio>` の ended イベント（トラック終了時の次曲処理） */
function onEnded(): void {
  isPlaying.value = false
  stopVisualizer()
  if (repeatMode.value === 'one') {
    audioRef.value?.play()
    return
  }
  if (repeatMode.value === 'all' || currentIndex.value < tracks.value.length - 1) {
    nextTrack()
  }
}

// ─── ドラッグ&ドロップ ─────────────────────────────────────

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(): void {
  isDragging.value = false
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  isDragging.value = false
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

// ─── ライフサイクル ──────────────────────────────────────────

onMounted(() => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }
})

onBeforeUnmount(() => {
  stopVisualizer()
  audioCtx?.close()
  for (const track of tracks.value) {
    URL.revokeObjectURL(track.url)
  }
})

// ─── 現在のトラック名 ──────────────────────────────────────

/** 現在再生中のトラック名を返す */
const currentTrackName = computed((): string => {
  const track = tracks.value[currentIndex.value]
  return track?.name ?? ''
})
</script>

<template>
  <div
    class="music-player flex flex-col h-full bg-(--ui-bg) select-none overflow-hidden"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- ビジュアライザー -->
    <div class="visualizer-area relative bg-(--ui-bg-muted) border-b border-(--ui-border)">
      <canvas
        ref="canvasRef"
        class="w-full h-full"
        width="480"
        height="80"
      />
      <!-- ドラッグオーバーレイ -->
      <Transition name="fade">
        <div
          v-if="isDragging"
          class="absolute inset-0 flex items-center justify-center bg-(--ui-primary)/20 border-2 border-dashed border-(--ui-primary) pointer-events-none"
        >
          <span class="text-(--ui-primary) font-medium text-sm">{{ t('apps.musicPlayer.noTracks') }}</span>
        </div>
      </Transition>
    </div>

    <!-- トラック情報 + コントロール -->
    <div class="px-4 pt-3 pb-2 flex flex-col gap-2 border-b border-(--ui-border)">
      <!-- トラック名 -->
      <div
        class="text-center truncate text-sm font-semibold text-(--ui-text)"
        :title="currentTrackName"
      >
        <span v-if="currentTrackName">{{ currentTrackName }}</span>
        <span
          v-else
          class="text-(--ui-text-muted) font-normal text-xs"
        >{{ t('apps.musicPlayer.noTracks') }}</span>
      </div>

      <!-- シークバー -->
      <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
        <span class="w-8 text-right">{{ formatTime(currentTime) }}</span>
        <input
          type="range"
          class="flex-1 accent-violet-500 h-1"
          :min="0"
          :max="duration || 0"
          :value="currentTime"
          step="0.1"
          @input="handleSeek"
        >
        <span class="w-8">{{ formatTime(duration) }}</span>
      </div>

      <!-- メインコントロール -->
      <div class="flex items-center justify-center gap-2">
        <!-- シャッフル -->
        <UButton
          :icon="'i-lucide-shuffle'"
          variant="ghost"
          size="sm"
          :color="isShuffle ? 'primary' : 'neutral'"
          :title="t('apps.musicPlayer.shuffle')"
          @click="isShuffle = !isShuffle"
        />
        <!-- 前へ -->
        <UButton
          icon="i-lucide-skip-back"
          variant="ghost"
          size="sm"
          color="neutral"
          :disabled="tracks.length === 0"
          @click="prevTrack"
        />
        <!-- 再生/一時停止 -->
        <UButton
          :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
          variant="solid"
          size="md"
          color="primary"
          :disabled="tracks.length === 0"
          @click="togglePlay"
        />
        <!-- 次へ -->
        <UButton
          icon="i-lucide-skip-forward"
          variant="ghost"
          size="sm"
          color="neutral"
          :disabled="tracks.length === 0"
          @click="nextTrack"
        />
        <!-- リピート -->
        <UButton
          :icon="repeatIcon"
          variant="ghost"
          size="sm"
          :color="repeatActive ? 'primary' : 'neutral'"
          :title="t(`apps.musicPlayer.repeat${repeatMode.charAt(0).toUpperCase() + repeatMode.slice(1)}`)"
          @click="cycleRepeat"
        />
      </div>

      <!-- 音量 -->
      <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
        <UIcon
          name="i-lucide-volume-2"
          class="shrink-0"
        />
        <input
          type="range"
          class="flex-1 accent-violet-500 h-1"
          :min="0"
          :max="1"
          step="0.01"
          :value="volume"
          @input="handleVolumeChange"
        >
      </div>
    </div>

    <!-- プレイリスト -->
    <div class="flex-1 overflow-y-auto">
      <!-- ヘッダー -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-(--ui-border)">
        <span class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">
          {{ t('apps.musicPlayer.playlist') }}
          <span class="ml-1 text-(--ui-text-muted)">({{ tracks.length }})</span>
        </span>
        <UButton
          icon="i-lucide-plus"
          size="xs"
          variant="ghost"
          color="neutral"
          :label="t('apps.musicPlayer.addFiles')"
          @click="openFilePicker"
        />
      </div>

      <!-- トラック一覧 -->
      <div
        v-if="tracks.length === 0"
        class="flex flex-col items-center justify-center h-32 gap-2 text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-music-2"
          class="text-3xl opacity-30"
        />
        <p class="text-xs text-center px-6">
          {{ t('apps.musicPlayer.noTracks') }}
        </p>
      </div>

      <ul v-else>
        <li
          v-for="(track, index) in tracks"
          :key="track.url"
          class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-(--ui-bg-elevated) transition-colors group"
          :class="{ 'bg-(--ui-bg-elevated)': index === currentIndex }"
          @click="loadTrack(index); if (!isPlaying) togglePlay()"
        >
          <!-- 再生中インジケーター -->
          <div class="w-4 shrink-0 flex items-center justify-center">
            <UIcon
              v-if="index === currentIndex && isPlaying"
              name="i-lucide-volume-2"
              class="text-violet-500 text-xs"
            />
            <span
              v-else
              class="text-xs text-(--ui-text-muted) group-hover:hidden"
            >{{ index + 1 }}</span>
            <UIcon
              v-if="index !== currentIndex || !isPlaying"
              name="i-lucide-play"
              class="text-xs text-(--ui-text-muted) hidden group-hover:block"
            />
          </div>
          <!-- トラック名 -->
          <span
            class="flex-1 text-sm truncate"
            :class="index === currentIndex ? 'text-violet-500 font-medium' : 'text-(--ui-text)'"
            :title="track.name"
          >{{ track.name }}</span>
          <!-- 削除ボタン -->
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            size="xs"
            color="neutral"
            class="opacity-0 group-hover:opacity-100 shrink-0"
            :title="t('apps.musicPlayer.removeTrack')"
            @click.stop="removeTrack(index)"
          />
        </li>
      </ul>
    </div>

    <!-- 非表示の audio 要素 -->
    <audio
      ref="audioRef"
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    />

    <!-- 非表示のファイル入力 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*"
      multiple
      class="hidden"
      @change="onFileInputChange"
    >
  </div>
</template>

<style scoped>
.music-player {
  min-height: 0;
}

.visualizer-area {
  height: 80px;
  flex-shrink: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
