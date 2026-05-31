<script setup lang="ts">
import type { FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'

defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.webm'
])

/** トラック情報 */
interface Track {
  /** 表示名（ファイル名から拡張子を除いた値） */
  name: string
  /** マウント内ルート基準パス */
  path: string
  /** 再生に使う Object URL */
  url: string
}

/** リピートモード */
type RepeatMode = 'none' | 'one' | 'all'

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

const localError = ref<string | null>(null)
const browserPath = ref('/')
const entries = ref<FileSystemEntry[]>([])
const isLoadingEntries = ref(false)
const addingMount = ref(false)
const showBrowser = ref(true)

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(900)

/** `<audio>` 要素への参照 */
const audioRef = ref<HTMLAudioElement | null>(null)

const isCompact = computed(() => containerWidth.value < 900)

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
  return t('apps.musicPlayer.errorGeneric')
}

function isAudioPath(path: string): boolean {
  const lower = path.toLowerCase()
  return Array.from(AUDIO_EXTENSIONS).some(ext => lower.endsWith(ext))
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

async function handleAddMount(): Promise<void> {
  addingMount.value = true
  try {
    const mount = await fileSystem.addMount()
    if (mount) {
      notify(t('apps.musicPlayer.mountAdded', { name: mount.name }), { type: 'success' })
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  } finally {
    addingMount.value = false
  }
}

/** ファイル名からトラック名を生成する（拡張子除去） */
function trackNameFromPath(path: string): string {
  const filename = path.split('/').filter(Boolean).at(-1) ?? ''
  return filename.replace(/\.[^.]+$/, '') || t('apps.musicPlayer.unknownTrack')
}

/** ファイルエントリーをプレイリストへ追加する */
async function addTrackFromEntry(entry: FileSystemEntry, autoPlay = false): Promise<void> {
  if (entry.kind !== 'file') return

  if (!isAudioPath(entry.path)) {
    notify(t('apps.musicPlayer.notAudio'), { type: 'warning' })
    return
  }

  const mountId = fileSystem.activeMountId.value
  if (!mountId) return

  const existingIndex = tracks.value.findIndex(track => track.path === entry.path)
  if (existingIndex >= 0) {
    if (autoPlay) {
      loadTrack(existingIndex)
      await togglePlay(true)
    }
    return
  }

  try {
    const blob = await fileSystem.readFileBlob(entry.path, mountId)
    const url = URL.createObjectURL(blob)
    const nextIndex = tracks.value.length
    tracks.value.push({
      name: trackNameFromPath(entry.path),
      path: entry.path,
      url
    })

    if (currentIndex.value === -1) {
      loadTrack(nextIndex)
    }

    if (autoPlay) {
      loadTrack(nextIndex)
      await togglePlay(true)
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

/** 現在ディレクトリの音声ファイルを全てプレイリストへ追加する */
async function addAllFromDirectory(): Promise<void> {
  const candidates = entries.value.filter(entry => entry.kind === 'file' && isAudioPath(entry.path))
  if (candidates.length === 0) return

  for (const entry of candidates) {
    await addTrackFromEntry(entry)
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
async function togglePlay(forcePlay = false): Promise<void> {
  if (!audioRef.value) return
  if (currentIndex.value === -1 && tracks.value.length > 0) {
    loadTrack(0)
  }

  if (!forcePlay && isPlaying.value) {
    audioRef.value.pause()
  } else {
    await audioRef.value.play()
  }
}

/** 次のトラックを再生する */
async function nextTrack(): Promise<void> {
  if (tracks.value.length === 0) return
  let next: number
  if (isShuffle.value) {
    next = Math.floor(Math.random() * tracks.value.length)
  } else {
    next = currentIndex.value + 1
    if (next >= tracks.value.length) next = 0
  }
  loadTrack(next)
  if (isPlaying.value) await togglePlay(true)
}

/** 前のトラックを再生する（再生位置が 3 秒以上なら先頭へ戻す） */
async function prevTrack(): Promise<void> {
  if (tracks.value.length === 0) return
  if (currentTime.value > 3) {
    if (audioRef.value) audioRef.value.currentTime = 0
    return
  }

  let prev = currentIndex.value - 1
  if (prev < 0) prev = tracks.value.length - 1
  loadTrack(prev)
  if (isPlaying.value) await togglePlay(true)
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

/** シークバー操作時に再生位置を更新する */
function handleSeek(event: Event): void {
  const input = event.target as HTMLInputElement
  if (!audioRef.value) return
  audioRef.value.currentTime = Number(input.value)
}

/** 音量スライダー操作時に音量を更新する */
function handleVolumeChange(event: Event): void {
  const input = event.target as HTMLInputElement
  volume.value = Number(input.value)
  if (audioRef.value) audioRef.value.volume = volume.value
}

/** 秒数を mm:ss 形式へ変換する */
function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

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
}

/** `<audio>` の pause イベント */
function onPause(): void {
  isPlaying.value = false
}

/** `<audio>` の ended イベント（トラック終了時の次曲処理） */
function onEnded(): void {
  isPlaying.value = false
  if (repeatMode.value === 'one') {
    void togglePlay(true)
    return
  }

  if (repeatMode.value === 'all' || currentIndex.value < tracks.value.length - 1) {
    void nextTrack()
  }
}

async function openEntry(entry: FileSystemEntry): Promise<void> {
  if (entry.kind === 'directory') {
    goTo(entry.path)
    return
  }
  await addTrackFromEntry(entry, true)
  if (isCompact.value) showBrowser.value = false
}

onMounted(() => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    resizeObserver.observe(containerRef.value)
    onUnmounted(() => resizeObserver.disconnect())
  }

  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }

  void fileSystem.restoreMounts().then(loadEntries)
})

onBeforeUnmount(() => {
  for (const track of tracks.value) {
    URL.revokeObjectURL(track.url)
  }
})

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

/** 現在再生中のトラック名を返す */
const currentTrackName = computed((): string => {
  const track = tracks.value[currentIndex.value]
  return track?.name ?? ''
})
</script>

<template>
  <div
    ref="containerRef"
    class="music-player"
  >
    <div class="toolbar">
      <div class="toolbar-left">
        <UButton
          icon="i-lucide-panel-right"
          :label="isCompact ? undefined : t('apps.musicPlayer.browser')"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="showBrowser = !showBrowser"
        />
        <USelect
          v-model="selectedMountId"
          :items="mountOptions"
          value-key="value"
          class="mount-select"
          :placeholder="t('apps.musicPlayer.mount')"
        />
        <UButton
          icon="i-lucide-folder-plus"
          :label="isCompact ? undefined : t('apps.musicPlayer.addMount')"
          size="sm"
          variant="ghost"
          color="primary"
          :loading="addingMount"
          @click="handleAddMount"
        />
        <UButton
          icon="i-lucide-arrow-up"
          :label="isCompact ? undefined : t('apps.musicPlayer.up')"
          size="sm"
          variant="ghost"
          color="neutral"
          :disabled="!hasMount || browserPath === '/'"
          @click="goUp"
        />
        <UButton
          icon="i-lucide-refresh-cw"
          :label="isCompact ? undefined : t('apps.musicPlayer.refresh')"
          size="sm"
          variant="ghost"
          color="neutral"
          :loading="isLoadingEntries"
          :disabled="!hasMount"
          @click="loadEntries"
        />
        <UButton
          icon="i-lucide-list-plus"
          :label="isCompact ? undefined : t('apps.musicPlayer.addAll')"
          size="sm"
          variant="ghost"
          color="neutral"
          :disabled="!hasMount"
          @click="addAllFromDirectory"
        />
      </div>
    </div>

    <UAlert
      v-if="!fileSystem.isSupported.value"
      icon="i-lucide-info"
      color="neutral"
      variant="soft"
      :description="t('apps.musicPlayer.unsupported')"
      class="state-alert"
    />

    <UAlert
      v-else-if="!hasMount"
      icon="i-lucide-folder-search"
      color="neutral"
      variant="soft"
      :description="t('apps.musicPlayer.noMounts')"
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

    <div class="content">
      <div class="player-panel">
        <div class="now-playing">
          <p class="now-title">
            {{ currentTrackName || t('apps.musicPlayer.noTracks') }}
          </p>
        </div>

        <div class="seek-row">
          <span>{{ formatTime(currentTime) }}</span>
          <input
            type="range"
            :min="0"
            :max="duration || 0"
            :value="currentTime"
            step="0.1"
            @input="handleSeek"
          >
          <span>{{ formatTime(duration) }}</span>
        </div>

        <div class="controls">
          <UButton
            icon="i-lucide-skip-back"
            variant="ghost"
            size="sm"
            color="neutral"
            :disabled="tracks.length === 0"
            @click="prevTrack"
          />
          <UButton
            :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
            variant="solid"
            size="md"
            color="primary"
            :disabled="tracks.length === 0"
            @click="togglePlay()"
          />
          <UButton
            icon="i-lucide-skip-forward"
            variant="ghost"
            size="sm"
            color="neutral"
            :disabled="tracks.length === 0"
            @click="nextTrack"
          />
          <UButton
            icon="i-lucide-shuffle"
            variant="ghost"
            size="sm"
            :color="isShuffle ? 'primary' : 'neutral'"
            @click="isShuffle = !isShuffle"
          />
          <UButton
            :icon="repeatIcon"
            variant="ghost"
            size="sm"
            :color="repeatActive ? 'primary' : 'neutral'"
            @click="cycleRepeat"
          />
        </div>

        <div class="volume-row">
          <UIcon name="i-lucide-volume-2" />
          <input
            type="range"
            :min="0"
            :max="1"
            step="0.01"
            :value="volume"
            @input="handleVolumeChange"
          >
        </div>

        <div class="playlist-header">
          <span>{{ t('apps.musicPlayer.playlist') }} ({{ tracks.length }})</span>
        </div>

        <ul
          v-if="tracks.length > 0"
          class="playlist"
        >
          <li
            v-for="(track, index) in tracks"
            :key="track.path"
            class="playlist-item"
            :class="{ active: index === currentIndex }"
            @click="loadTrack(index); if (!isPlaying) togglePlay(true)"
          >
            <span class="track-name">{{ track.name }}</span>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="xs"
              color="neutral"
              :title="t('apps.musicPlayer.removeTrack')"
              @click.stop="removeTrack(index)"
            />
          </li>
        </ul>
      </div>

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
            {{ t('apps.musicPlayer.loading') }}
          </div>

          <div
            v-else-if="entries.length === 0"
            class="browser-empty"
          >
            {{ t('apps.musicPlayer.empty') }}
          </div>

          <button
            v-for="entry in entries"
            :key="entry.path"
            class="browser-item"
            @click="openEntry(entry)"
          >
            <UIcon :name="entry.kind === 'directory' ? 'i-lucide-folder' : 'i-lucide-music-3'" />
            <span>{{ entry.name }}</span>
          </button>
        </aside>
      </Transition>
    </div>

    <audio
      ref="audioRef"
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    />
  </div>
</template>

<style scoped>
.music-player {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  min-height: 0;
  overflow: hidden;
}

.toolbar {
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  padding: 0.375rem 0.5rem;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.mount-select {
  min-width: 12rem;
  max-width: 16rem;
}

.state-alert {
  margin: 0.5rem;
}

.content {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.player-panel {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  gap: 0.75rem;
}

.now-playing {
  padding: 0.5rem 0.75rem;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
}

.now-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seek-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}

.seek-row input,
.volume-row input {
  width: 100%;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

.volume-row {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.5rem;
}

.playlist-header {
  padding-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  font-weight: 600;
}

.playlist {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  overflow: auto;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  cursor: pointer;
}

.playlist-item + .playlist-item {
  border-top: 1px solid var(--ui-border);
}

.playlist-item:hover {
  background: var(--ui-bg-elevated);
}

.playlist-item.active {
  background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
}

.track-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
}

.browser {
  width: 15rem;
  flex-shrink: 0;
  background: var(--ui-bg-elevated);
  border-left: 1px solid var(--ui-border);
  padding: 0.5rem;
  overflow: auto;
}

.browser.compact {
  position: absolute;
  inset: 0 0 0 auto;
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
  transform: translateX(8px);
  opacity: 0;
}
</style>
