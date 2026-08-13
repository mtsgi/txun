<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.webm'
])

interface Track {
  name: string
  path: string
  url: string
}

type RepeatMode = 'none' | 'one' | 'all'

const tracks = ref<Track[]>([])
const currentIndex = ref<number>(-1)
const isPlaying = ref(false)
const isShuffle = ref(false)
const repeatMode = ref<RepeatMode>('none')
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)

const localError = ref<string | null>(null)
const isLoadingEntries = ref(false)

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(900)
const audioRef = ref<HTMLAudioElement | null>(null)

const isCompact = computed(() => containerWidth.value < 900)

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.musicPlayer.errorGeneric')
}

function isAudioPath(path: string): boolean {
  const lower = path.toLowerCase()
  return Array.from(AUDIO_EXTENSIONS).some(ext => lower.endsWith(ext))
}

function trackNameFromPath(path: string): string {
  const filename = path.split('/').filter(Boolean).at(-1) ?? ''
  return filename.replace(/\.[^.]+$/, '') || t('apps.musicPlayer.unknownTrack')
}

async function addTrackFromPath(path: string, mountId: string, autoPlay = false): Promise<void> {
  if (!isAudioPath(path)) {
    notify(t('apps.musicPlayer.notAudio'), { type: 'warning' })
    return
  }

  const existingIndex = tracks.value.findIndex(track => track.path === path)
  if (existingIndex >= 0) {
    if (autoPlay) {
      loadTrack(existingIndex)
      await togglePlay(true)
    }
    return
  }

  try {
    const blob = await fileSystem.readFileBlob(path, mountId)
    const url = URL.createObjectURL(blob)
    const nextIndex = tracks.value.length
    tracks.value.push({
      name: trackNameFromPath(path),
      path: path,
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

async function triggerAddTracks(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.musicPlayer.playlist'),
    mode: 'open-file',
    filters: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.webm'],
    multiple: true
  })
  if (res) {
    if (Array.isArray(res)) {
      for (const item of res) {
        await addTrackFromPath(item.path, item.mountId)
      }
    } else {
      await addTrackFromPath(res.path, res.mountId)
    }
  }
}

async function triggerAddDirectory(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.musicPlayer.addAll'),
    mode: 'open-directory'
  })
  if (res && !Array.isArray(res)) {
    isLoadingEntries.value = true
    try {
      const list = await fileSystem.listDirectory(res.path, res.mountId)
      const candidates = list.filter(entry => entry.kind === 'file' && isAudioPath(entry.path))
      for (const entry of candidates) {
        await addTrackFromPath(entry.path, res.mountId)
      }
    } catch (err) {
      localError.value = toErrorMessage(err)
    } finally {
      isLoadingEntries.value = false
    }
  }
}

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

function loadTrack(index: number): void {
  const track = tracks.value[index]
  if (!track || !audioRef.value) return
  currentIndex.value = index
  audioRef.value.src = track.url
  audioRef.value.load()
  currentTime.value = 0
  duration.value = 0
}

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

function cycleRepeat(): void {
  const modes: RepeatMode[] = ['none', 'one', 'all']
  const idx = modes.indexOf(repeatMode.value)
  repeatMode.value = modes[(idx + 1) % modes.length] ?? 'none'
}

const repeatIcon = computed(() => {
  if (repeatMode.value === 'one') return 'i-lucide-repeat-1'
  return 'i-lucide-repeat'
})

const repeatActive = computed(() => repeatMode.value !== 'none')

function handleSeek(event: Event): void {
  const input = event.target as HTMLInputElement
  if (!audioRef.value) return
  audioRef.value.currentTime = Number(input.value)
}

function handleVolumeChange(event: Event): void {
  const input = event.target as HTMLInputElement
  volume.value = Number(input.value)
  if (audioRef.value) audioRef.value.volume = volume.value
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function onTimeUpdate(): void {
  if (audioRef.value) currentTime.value = audioRef.value.currentTime
}

function onLoadedMetadata(): void {
  if (audioRef.value) duration.value = audioRef.value.duration
}

function onPlay(): void {
  isPlaying.value = true
}

function onPause(): void {
  isPlaying.value = false
}

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

  void fileSystem.restoreMounts()
})

onBeforeUnmount(() => {
  for (const track of tracks.value) {
    URL.revokeObjectURL(track.url)
  }
})

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
          icon="i-lucide-music"
          :label="isCompact ? undefined : t('apps.musicPlayer.playlist')"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="triggerAddTracks"
        />
        <UButton
          icon="i-lucide-folder-open"
          :label="isCompact ? undefined : t('apps.musicPlayer.addAll')"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="triggerAddDirectory"
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
</style>
