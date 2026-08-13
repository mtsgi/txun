<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv', '.mkv', '.avi'
])

interface VideoItem {
  name: string
  path: string
  url: string
}

type RepeatMode = 'none' | 'one' | 'all'

const videos = ref<VideoItem[]>([])
const currentIndex = ref<number>(-1)
const isPlaying = ref(false)
const isShuffle = ref(false)
const repeatMode = ref<RepeatMode>('none')
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)
const isMuted = ref(false)
const playbackRate = ref(1)
const localError = ref<string | null>(null)
const isLoadingEntries = ref(false)

const showPlaylist = ref(true)
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(900)
const videoRef = ref<HTMLVideoElement | null>(null)

const isCompact = computed(() => containerWidth.value < 980)
const overlayVisible = computed(() => isCompact.value && showPlaylist.value)

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

const playbackRateItems = computed(() =>
  playbackRates.map(rate => ({
    label: rate === 1 ? `${rate}x (標準)` : `${rate}x`,
    onSelect: () => setPlaybackRate(rate)
  }))
)

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return t('apps.videoPlayer.errorGeneric')
}

function isVideoPath(path: string): boolean {
  const lower = path.toLowerCase()
  return Array.from(VIDEO_EXTENSIONS).some(ext => lower.endsWith(ext))
}

function videoNameFromPath(path: string): string {
  const filename = path.split('/').filter(Boolean).at(-1) ?? ''
  return filename.replace(/\.[^.]+$/, '') || t('apps.videoPlayer.unknownVideo')
}

async function addVideoFromPath(path: string, mountId: string, autoPlay = false): Promise<void> {
  if (!isVideoPath(path)) {
    notify(t('apps.videoPlayer.notVideo'), { type: 'warning' })
    return
  }

  const existingIndex = videos.value.findIndex(item => item.path === path)
  if (existingIndex >= 0) {
    if (autoPlay) {
      loadVideo(existingIndex)
      await togglePlay(true)
    }
    return
  }

  try {
    const blob = await fileSystem.readFileBlob(path, mountId)
    const url = URL.createObjectURL(blob)
    const nextIndex = videos.value.length
    videos.value.push({
      name: videoNameFromPath(path),
      path: path,
      url
    })

    if (currentIndex.value === -1) {
      loadVideo(nextIndex)
    }

    if (autoPlay) {
      loadVideo(nextIndex)
      await togglePlay(true)
    }
  } catch (error) {
    localError.value = toErrorMessage(error)
  }
}

async function triggerAddVideos(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.videoPlayer.playlist'),
    mode: 'open-file',
    filters: ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv', '.mkv', '.avi'],
    multiple: true
  })
  if (res) {
    if (Array.isArray(res)) {
      for (const item of res) {
        await addVideoFromPath(item.path, item.mountId)
      }
    } else {
      await addVideoFromPath(res.path, res.mountId)
    }
  }
}

async function triggerAddDirectory(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.videoPlayer.addAll'),
    mode: 'open-directory'
  })
  if (res && !Array.isArray(res)) {
    isLoadingEntries.value = true
    try {
      const list = await fileSystem.listDirectory(res.path, res.mountId)
      const candidates = list.filter(entry => entry.kind === 'file' && isVideoPath(entry.path))
      for (const entry of candidates) {
        await addVideoFromPath(entry.path, res.mountId)
      }
    } catch (err) {
      localError.value = toErrorMessage(err)
    } finally {
      isLoadingEntries.value = false
    }
  }
}

function removeVideo(index: number): void {
  const item = videos.value[index]
  if (!item) return
  const wasPlaying = isPlaying.value
  URL.revokeObjectURL(item.url)
  videos.value.splice(index, 1)

  if (index < currentIndex.value) {
    currentIndex.value--
  } else if (index === currentIndex.value) {
    isPlaying.value = false
    if (videos.value.length > 0) {
      const next = Math.min(index, videos.value.length - 1)
      loadVideo(next)
      if (wasPlaying) void togglePlay(true)
    } else {
      currentIndex.value = -1
      currentTime.value = 0
      duration.value = 0
      if (videoRef.value) videoRef.value.src = ''
    }
  }
}

function loadVideo(index: number): void {
  const item = videos.value[index]
  if (!item || !videoRef.value) return
  currentIndex.value = index
  videoRef.value.src = item.url
  videoRef.value.load()
  videoRef.value.volume = volume.value
  videoRef.value.muted = isMuted.value
  videoRef.value.playbackRate = playbackRate.value
  currentTime.value = 0
  duration.value = 0
}

async function togglePlay(forcePlay = false): Promise<void> {
  if (!videoRef.value) return
  if (currentIndex.value === -1 && videos.value.length > 0) {
    loadVideo(0)
  }

  if (!forcePlay && isPlaying.value) {
    videoRef.value.pause()
  } else {
    try {
      await videoRef.value.play()
    } catch {
      isPlaying.value = false
    }
  }
}

async function nextVideo(): Promise<void> {
  if (videos.value.length === 0) return
  let next: number
  if (isShuffle.value) {
    next = Math.floor(Math.random() * videos.value.length)
  } else {
    next = currentIndex.value + 1
    if (next >= videos.value.length) next = 0
  }
  loadVideo(next)
  if (isPlaying.value) await togglePlay(true)
}

async function prevVideo(): Promise<void> {
  if (videos.value.length === 0) return
  if (currentTime.value > 3) {
    if (videoRef.value) videoRef.value.currentTime = 0
    return
  }

  let prev = currentIndex.value - 1
  if (prev < 0) prev = videos.value.length - 1
  loadVideo(prev)
  if (isPlaying.value) await togglePlay(true)
}

function setPlaybackRate(rate: number): void {
  playbackRate.value = rate
  if (videoRef.value) videoRef.value.playbackRate = rate
}

function toggleMute(): void {
  isMuted.value = !isMuted.value
  if (videoRef.value) videoRef.value.muted = isMuted.value
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
  if (!videoRef.value) return
  videoRef.value.currentTime = Number(input.value)
}

function handleVolumeChange(event: Event): void {
  const input = event.target as HTMLInputElement
  volume.value = Number(input.value)
  if (videoRef.value) {
    videoRef.value.volume = volume.value
    if (volume.value > 0) {
      isMuted.value = false
      videoRef.value.muted = false
    }
  }
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

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
    // Ignore PiP errors
  }
}

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

function onTimeUpdate(): void {
  if (videoRef.value) currentTime.value = videoRef.value.currentTime
}

function onLoadedMetadata(): void {
  if (!videoRef.value) return
  duration.value = videoRef.value.duration
  videoRef.value.volume = volume.value
  videoRef.value.muted = isMuted.value
  videoRef.value.playbackRate = playbackRate.value
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

  if (repeatMode.value === 'all' || currentIndex.value < videos.value.length - 1) {
    void nextVideo()
  }
}

function togglePlaylistPanel(): void {
  showPlaylist.value = !showPlaylist.value
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

  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }

  void fileSystem.restoreMounts()
})

onBeforeUnmount(() => {
  for (const item of videos.value) {
    URL.revokeObjectURL(item.url)
  }
})

watch(isCompact, (compact) => {
  if (compact) {
    showPlaylist.value = false
  }
})

const currentVideoName = computed((): string => {
  const item = videos.value[currentIndex.value]
  return item?.name ?? ''
})
</script>

<template>
  <div
    ref="containerRef"
    class="video-player"
  >
    <div class="toolbar">
      <div class="toolbar-left">
        <UButton
          icon="i-lucide-list-video"
          :label="isCompact ? undefined : (showPlaylist ? t('apps.videoPlayer.hidePlaylist') : t('apps.videoPlayer.showPlaylist'))"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="togglePlaylistPanel"
        />
        <UButton
          icon="i-lucide-video"
          :label="isCompact ? undefined : t('apps.videoPlayer.playlist')"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="triggerAddVideos"
        />
        <UButton
          icon="i-lucide-folder-open"
          :label="isCompact ? undefined : t('apps.videoPlayer.addAll')"
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

    <div
      v-if="overlayVisible"
      class="overlay-backdrop"
      @click="showPlaylist = false"
    />

    <div class="content">
      <div class="main-panel">
        <div class="video-stage">
          <video
            ref="videoRef"
            class="video-element"
            :class="{ hidden: videos.length === 0 }"
            preload="metadata"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
          />

          <div
            v-if="videos.length === 0"
            class="empty-state"
          >
            <UIcon
              name="i-lucide-video-off"
              class="empty-icon"
            />
            <p>{{ t('apps.videoPlayer.noVideos') }}</p>
          </div>
        </div>

        <div class="timeline-row">
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

        <div class="control-row">
          <UButton
            icon="i-lucide-skip-back"
            variant="ghost"
            size="sm"
            color="neutral"
            :disabled="videos.length === 0"
            @click="prevVideo"
          />
          <UButton
            :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
            variant="solid"
            size="md"
            color="primary"
            :disabled="videos.length === 0"
            @click="togglePlay()"
          />
          <UButton
            icon="i-lucide-skip-forward"
            variant="ghost"
            size="sm"
            color="neutral"
            :disabled="videos.length === 0"
            @click="nextVideo"
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
          <UButton
            :icon="isMuted || volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
            variant="ghost"
            size="sm"
            color="neutral"
            :title="isMuted ? t('apps.videoPlayer.unmute') : t('apps.videoPlayer.mute')"
            @click="toggleMute"
          />
          <input
            type="range"
            class="volume-slider"
            :min="0"
            :max="1"
            step="0.05"
            :value="isMuted ? 0 : volume"
            @input="handleVolumeChange"
          >

          <UDropdownMenu
            :items="playbackRateItems"
            :content="{ align: 'end' }"
          >
            <UButton
              variant="ghost"
              size="xs"
              color="neutral"
              :label="`${playbackRate}x`"
            />
          </UDropdownMenu>

          <UButton
            icon="i-lucide-picture-in-picture"
            variant="ghost"
            size="sm"
            color="neutral"
            :title="t('apps.videoPlayer.pip')"
            @click="togglePiP"
          />
          <UButton
            icon="i-lucide-maximize"
            variant="ghost"
            size="sm"
            color="neutral"
            :title="t('apps.videoPlayer.fullscreen')"
            @click="toggleFullscreen"
          />
        </div>

        <p
          v-if="currentVideoName"
          class="current-name"
        >
          {{ currentVideoName }}
        </p>
      </div>

      <Transition name="panel-slide">
        <aside
          v-if="showPlaylist"
          class="playlist-panel"
          :class="{ compact: isCompact }"
        >
          <div class="panel-header">
            <span>{{ t('apps.videoPlayer.playlist') }} ({{ videos.length }})</span>
            <UButton
              v-if="isCompact"
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="showPlaylist = false"
            />
          </div>

          <div
            v-if="videos.length === 0"
            class="panel-empty"
          >
            {{ t('apps.videoPlayer.noVideos') }}
          </div>

          <ul
            v-else
            class="playlist"
          >
            <li
              v-for="(item, index) in videos"
              :key="item.path"
              class="playlist-item"
              :class="{ active: index === currentIndex }"
              @click="loadVideo(index); if (!isPlaying) togglePlay(true)"
            >
              <span>{{ item.name }}</span>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                color="neutral"
                :title="t('apps.videoPlayer.removeVideo')"
                @click.stop="removeVideo(index)"
              />
            </li>
          </ul>
        </aside>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.video-player {
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

.overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  z-index: 10;
}

.content {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

.main-panel {
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  gap: 0.75rem;
}

.video-stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-element.hidden {
  display: none;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: rgb(255 255 255 / 70%);
  text-align: center;
  padding: 1rem;
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.7;
}

.timeline-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}

.timeline-row input {
  width: 100%;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.volume-slider {
  width: 6rem;
}

.current-name {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ui-text-muted);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-panel {
  width: 16rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-elevated);
  border-left: 1px solid var(--ui-border);
  overflow: auto;
  padding: 0.5rem;
}

.playlist-panel.compact {
  position: absolute;
  top: 0;
  bottom: 0;
  width: min(88%, 22rem);
  z-index: 20;
  box-shadow: 0 14px 28px rgb(0 0 0 / 25%);
}

.playlist-panel.compact {
  left: 0;
  border-left: none;
  border-right: 1px solid var(--ui-border);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  margin-bottom: 0.5rem;
  min-height: 1.5rem;
}

.panel-header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-empty {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  padding: 0.5rem 0;
}

.playlist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.35rem;
  cursor: pointer;
}

.playlist-item:hover {
  background: var(--ui-bg);
}

.playlist-item.active {
  background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
}

.playlist-item span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(-10px);
  opacity: 0;
}
</style>
