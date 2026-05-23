<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()
const cameraStore = useCameraStore()

/** カメラ API 対応チェック */
const hasCameraSupport = computed(() => import.meta.client && !!navigator.mediaDevices)

/** video 要素への参照 */
const videoRef = ref<HTMLVideoElement | null>(null)

/** デバイス選択用リスト */
const deviceItems = computed(() =>
  cameraStore.devices.map(d => ({
    label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
    value: d.deviceId
  }))
)

/** アクティブデバイス ID の双方向バインディング */
const selectedDeviceId = computed({
  get: (): string => cameraStore.activeDeviceId ?? cameraStore.devices[0]?.deviceId ?? '',
  set: (v: string) => { cameraStore.switchDevice(v) }
})

// ─── カメラ制御: computed setters ──────────────────────────

const zoomValue = computed({
  get: (): number => cameraStore.settings.zoom ?? cameraStore.capabilities.zoom?.min ?? 1,
  set: (v: number) => { cameraStore.applyConstraints({ zoom: v }) }
})

const exposureModeValue = computed({
  get: (): string => cameraStore.settings.exposureMode ?? cameraStore.capabilities.exposureMode?.[0] ?? '',
  set: (v: string) => { cameraStore.applyConstraints({ exposureMode: v }) }
})

const exposureCompValue = computed({
  get: (): number => cameraStore.settings.exposureCompensation ?? cameraStore.capabilities.exposureCompensation?.min ?? 0,
  set: (v: number) => { cameraStore.applyConstraints({ exposureCompensation: v }) }
})

const focusModeValue = computed({
  get: (): string => cameraStore.settings.focusMode ?? cameraStore.capabilities.focusMode?.[0] ?? '',
  set: (v: string) => { cameraStore.applyConstraints({ focusMode: v }) }
})

const focusDistanceValue = computed({
  get: (): number => cameraStore.settings.focusDistance ?? cameraStore.capabilities.focusDistance?.min ?? 0,
  set: (v: number) => { cameraStore.applyConstraints({ focusDistance: v }) }
})

const wbModeValue = computed({
  get: (): string => cameraStore.settings.whiteBalanceMode ?? cameraStore.capabilities.whiteBalanceMode?.[0] ?? '',
  set: (v: string) => { cameraStore.applyConstraints({ whiteBalanceMode: v }) }
})

const isoValue = computed({
  get: (): number => cameraStore.settings.iso ?? cameraStore.capabilities.iso?.min ?? 0,
  set: (v: number) => { cameraStore.applyConstraints({ iso: v }) }
})

const torchValue = computed({
  get: (): boolean => cameraStore.settings.torch ?? false,
  set: (v: boolean) => { cameraStore.applyConstraints({ torch: v }) }
})

const brightnessValue = computed({
  get: (): number => cameraStore.settings.brightness ?? cameraStore.capabilities.brightness?.min ?? 0,
  set: (v: number) => { cameraStore.applyConstraints({ brightness: v }) }
})

const contrastValue = computed({
  get: (): number => cameraStore.settings.contrast ?? cameraStore.capabilities.contrast?.min ?? 0,
  set: (v: number) => { cameraStore.applyConstraints({ contrast: v }) }
})

// ─── フォーカス距離スライダー表示条件 ───────────────────────

/** マニュアルフォーカス時のみフォーカス距離スライダーを表示する */
const showFocusDistance = computed(() =>
  !!cameraStore.capabilities.focusDistance && cameraStore.settings.focusMode === 'manual'
)

// ─── アクション ────────────────────────────────────────────

/** カメラを起動する（権限未取得の場合は要求する） */
async function handleStartCamera(): Promise<void> {
  if (cameraStore.hasPermission !== true) {
    const granted = await cameraStore.requestPermission()
    if (!granted) return
  }
  const targetId = cameraStore.devices[0]?.deviceId
  await cameraStore.startStream(targetId)
}

/** 写真を撮影する */
async function handleCapture(): Promise<void> {
  await cameraStore.capturePhoto()
}

/** 前後カメラを切り替える */
async function handleFlip(): Promise<void> {
  if (cameraStore.devices.length <= 1) return
  const currentIdx = cameraStore.devices.findIndex(d => d.deviceId === cameraStore.activeDeviceId)
  const nextIdx = (currentIdx + 1) % cameraStore.devices.length
  const nextDevice = cameraStore.devices[nextIdx]
  if (nextDevice) {
    await cameraStore.switchDevice(nextDevice.deviceId)
  }
}

// ─── ライフサイクル ──────────────────────────────────────────

onMounted(async () => {
  if (!hasCameraSupport.value) return
  await cameraStore.enumerateDevices()
  if (videoRef.value) {
    cameraStore.mountVideoElement(videoRef.value)
  }
  // 権限が既に付与済みならカメラを自動起動する
  if (cameraStore.hasPermission === true && cameraStore.devices.length > 0) {
    await cameraStore.startStream(cameraStore.devices[0]?.deviceId)
  }
})

onUnmounted(() => {
  cameraStore.stopStream()
})

// ストリーム開始後に video 要素へ srcObject を再バインドする
watch(() => cameraStore.isStreaming, (streaming) => {
  if (streaming && videoRef.value) {
    cameraStore.mountVideoElement(videoRef.value)
  }
})
</script>

<template>
  <div class="camera-app">
    <!-- ブラウザ非対応 -->
    <div
      v-if="!hasCameraSupport"
      class="camera-state"
    >
      <UIcon
        name="i-lucide-camera-off"
        class="state-icon"
      />
      <p class="state-title">
        {{ $t('apps.camera.notSupported') }}
      </p>
    </div>

    <!-- 権限未確認 -->
    <div
      v-else-if="cameraStore.hasPermission === null"
      class="camera-state"
    >
      <UIcon
        name="i-lucide-camera"
        class="state-icon state-icon--primary"
      />
      <p class="state-title">
        {{ $t('apps.camera.permissionRequired') }}
      </p>
      <p class="state-desc">
        {{ $t('apps.camera.permissionRequiredDesc') }}
      </p>
      <UButton
        icon="i-lucide-shield-check"
        :label="$t('apps.camera.allowCamera')"
        color="primary"
        @click="handleStartCamera"
      />
    </div>

    <!-- 権限拒否 -->
    <div
      v-else-if="cameraStore.hasPermission === false"
      class="camera-state"
    >
      <UIcon
        name="i-lucide-camera-off"
        class="state-icon state-icon--error"
      />
      <p class="state-title">
        {{ $t('apps.camera.permissionDenied') }}
      </p>
      <p class="state-desc">
        {{ $t('apps.camera.permissionDeniedDesc') }}
      </p>
    </div>

    <!-- デバイスなし -->
    <div
      v-else-if="cameraStore.devices.length === 0"
      class="camera-state"
    >
      <UIcon
        name="i-lucide-camera-off"
        class="state-icon"
      />
      <p class="state-title">
        {{ $t('apps.camera.noDevices') }}
      </p>
      <p class="state-desc">
        {{ $t('apps.camera.noDevicesDesc') }}
      </p>
    </div>

    <!-- カメラ UI -->
    <div
      v-else
      class="camera-main"
    >
      <!-- ツールバー -->
      <div class="camera-toolbar">
        <USelect
          v-if="cameraStore.devices.length > 1"
          v-model="selectedDeviceId"
          :items="deviceItems"
          size="xs"
          class="camera-device-select"
        />
        <div
          v-else
          class="camera-device-label"
        >
          <UIcon
            name="i-lucide-camera"
            class="toolbar-icon"
          />
          <span>{{ deviceItems[0]?.label }}</span>
        </div>
        <div class="toolbar-spacer" />
        <UButton
          v-if="cameraStore.devices.length > 1"
          icon="i-lucide-flip-horizontal-2"
          size="xs"
          variant="ghost"
          color="neutral"
          :title="$t('apps.camera.switchCamera')"
          @click="handleFlip"
        />
      </div>

      <!-- プレビュー + コントロール -->
      <div class="camera-content">
        <!-- ビデオプレビュー -->
        <div class="camera-preview-wrapper">
          <video
            ref="videoRef"
            class="camera-video"
            autoplay
            muted
            playsinline
          />
          <!-- 未起動オーバーレイ -->
          <Transition name="fade">
            <div
              v-if="!cameraStore.isStreaming"
              class="camera-start-overlay"
            >
              <UButton
                icon="i-lucide-video"
                :label="$t('apps.camera.startCamera')"
                color="primary"
                size="lg"
                @click="handleStartCamera"
              />
            </div>
          </Transition>
        </div>

        <!-- コントロールパネル（ImageCapture 対応時のみ表示） -->
        <div
          v-if="cameraStore.hasImageCaptureSupport && cameraStore.isStreaming"
          class="camera-controls"
        >
          <div class="controls-inner">
            <!-- ズーム -->
            <div
              v-if="cameraStore.capabilities.zoom"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.zoom') }}</label>
              <div class="control-row">
                <USlider
                  v-model="zoomValue"
                  :min="cameraStore.capabilities.zoom.min ?? 1"
                  :max="cameraStore.capabilities.zoom.max ?? 10"
                  :step="cameraStore.capabilities.zoom.step ?? 0.1"
                  size="xs"
                  class="control-slider"
                />
                <span class="control-value">{{ zoomValue.toFixed(1) }}x</span>
              </div>
            </div>

            <!-- 露出モード -->
            <div
              v-if="cameraStore.capabilities.exposureMode"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.exposureMode') }}</label>
              <USelect
                v-model="exposureModeValue"
                :items="cameraStore.capabilities.exposureMode"
                size="xs"
              />
            </div>

            <!-- 露出補正 -->
            <div
              v-if="cameraStore.capabilities.exposureCompensation"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.exposureCompensation') }}</label>
              <div class="control-row">
                <USlider
                  v-model="exposureCompValue"
                  :min="cameraStore.capabilities.exposureCompensation.min ?? -3"
                  :max="cameraStore.capabilities.exposureCompensation.max ?? 3"
                  :step="cameraStore.capabilities.exposureCompensation.step ?? 0.1"
                  size="xs"
                  class="control-slider"
                />
                <span class="control-value">{{ exposureCompValue.toFixed(1) }}</span>
              </div>
            </div>

            <!-- フォーカスモード -->
            <div
              v-if="cameraStore.capabilities.focusMode"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.focusMode') }}</label>
              <USelect
                v-model="focusModeValue"
                :items="cameraStore.capabilities.focusMode"
                size="xs"
              />
            </div>

            <!-- フォーカス距離（マニュアルフォーカス時のみ） -->
            <div
              v-if="showFocusDistance && cameraStore.capabilities.focusDistance"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.focusDistance') }}</label>
              <div class="control-row">
                <USlider
                  v-model="focusDistanceValue"
                  :min="cameraStore.capabilities.focusDistance.min ?? 0"
                  :max="cameraStore.capabilities.focusDistance.max ?? 1"
                  :step="cameraStore.capabilities.focusDistance.step ?? 0.01"
                  size="xs"
                  class="control-slider"
                />
                <span class="control-value">{{ focusDistanceValue.toFixed(2) }}</span>
              </div>
            </div>

            <!-- ホワイトバランス -->
            <div
              v-if="cameraStore.capabilities.whiteBalanceMode"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.whiteBalance') }}</label>
              <USelect
                v-model="wbModeValue"
                :items="cameraStore.capabilities.whiteBalanceMode"
                size="xs"
              />
            </div>

            <!-- ISO -->
            <div
              v-if="cameraStore.capabilities.iso"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.iso') }}</label>
              <div class="control-row">
                <USlider
                  v-model="isoValue"
                  :min="cameraStore.capabilities.iso.min ?? 0"
                  :max="cameraStore.capabilities.iso.max ?? 3200"
                  :step="cameraStore.capabilities.iso.step ?? 1"
                  size="xs"
                  class="control-slider"
                />
                <span class="control-value">{{ isoValue }}</span>
              </div>
            </div>

            <!-- 明るさ -->
            <div
              v-if="cameraStore.capabilities.brightness"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.brightness') }}</label>
              <div class="control-row">
                <USlider
                  v-model="brightnessValue"
                  :min="cameraStore.capabilities.brightness.min ?? 0"
                  :max="cameraStore.capabilities.brightness.max ?? 255"
                  :step="cameraStore.capabilities.brightness.step ?? 1"
                  size="xs"
                  class="control-slider"
                />
                <span class="control-value">{{ brightnessValue }}</span>
              </div>
            </div>

            <!-- コントラスト -->
            <div
              v-if="cameraStore.capabilities.contrast"
              class="control-field"
            >
              <label class="control-label">{{ $t('apps.camera.controls.contrast') }}</label>
              <div class="control-row">
                <USlider
                  v-model="contrastValue"
                  :min="cameraStore.capabilities.contrast.min ?? 0"
                  :max="cameraStore.capabilities.contrast.max ?? 255"
                  :step="cameraStore.capabilities.contrast.step ?? 1"
                  size="xs"
                  class="control-slider"
                />
                <span class="control-value">{{ contrastValue }}</span>
              </div>
            </div>

            <!-- ライト（トーチ） -->
            <div
              v-if="cameraStore.capabilities.torch !== undefined"
              class="control-field"
            >
              <div class="control-row control-row--between">
                <label class="control-label">{{ $t('apps.camera.controls.torch') }}</label>
                <USwitch v-model="torchValue" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- アクションバー -->
      <div class="camera-actions">
        <UButton
          icon="i-lucide-circle"
          :label="t('apps.camera.capture')"
          color="primary"
          size="lg"
          :loading="cameraStore.isTakingPhoto"
          :disabled="!cameraStore.isStreaming"
          class="shutter-btn"
          @click="handleCapture"
        />
      </div>

      <!-- 撮影ギャラリー -->
      <div class="camera-gallery">
        <p
          v-if="cameraStore.capturedPhotos.length === 0"
          class="gallery-empty"
        >
          {{ $t('apps.camera.noPhotos') }}
        </p>
        <TransitionGroup
          v-else
          name="gallery-item"
          tag="div"
          class="gallery-grid"
        >
          <div
            v-for="(photo, i) in cameraStore.capturedPhotos"
            :key="photo"
            class="gallery-item"
          >
            <img
              :src="photo"
              :alt="`${t('apps.camera.capture')} ${i + 1}`"
              class="gallery-thumb"
            >
            <div class="gallery-item-actions">
              <UButton
                icon="i-lucide-download"
                size="xs"
                variant="solid"
                color="primary"
                :title="t('apps.camera.download')"
                @click="cameraStore.downloadPhoto(photo)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="error"
                :title="t('apps.camera.delete')"
                @click="cameraStore.removePhoto(photo)"
              />
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.camera-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--ui-bg);
}

// ─── 状態表示 ──────────────────────────────────────────────

.camera-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  height: 100%;
  padding: 2rem;
  text-align: center;

  .state-icon {
    font-size: 3rem;
    color: var(--ui-text-muted);

    &--primary {
      color: var(--ui-primary);
    }

    &--error {
      color: var(--ui-error);
    }
  }

  .state-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .state-desc {
    font-size: 0.875rem;
    color: var(--ui-text-muted);
    margin: 0;
    max-width: 28rem;
  }
}

// ─── メイン UI ──────────────────────────────────────────────

.camera-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ─── ツールバー ────────────────────────────────────────────

.camera-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;

  .toolbar-spacer {
    flex: 1;
  }

  .toolbar-icon {
    font-size: 0.875rem;
    color: var(--ui-primary);
  }
}

.camera-device-select {
  max-width: 14rem;
}

.camera-device-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
}

// ─── コンテンツ（プレビュー + コントロール） ──────────────────

.camera-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

// ─── ビデオプレビュー ──────────────────────────────────────

.camera-preview-wrapper {
  position: relative;
  flex: 1;
  background: #000;
  overflow: hidden;
  min-width: 0;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.camera-start-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

// ─── コントロールパネル ────────────────────────────────────

.camera-controls {
  width: 13rem;
  flex-shrink: 0;
  border-left: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  overflow-y: auto;
}

.controls-inner {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.control-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ui-text-muted);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &--between {
    justify-content: space-between;
  }
}

.control-slider {
  flex: 1;
}

.control-value {
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  color: var(--ui-text-muted);
  min-width: 2.5rem;
  text-align: right;
}

// ─── アクションバー ───────────────────────────────────────

.camera-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem;
  border-top: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  flex-shrink: 0;
}

.shutter-btn {
  min-width: 8rem;
}

// ─── ギャラリー ───────────────────────────────────────────

.camera-gallery {
  border-top: 1px solid var(--ui-border);
  padding: 0.5rem 0.75rem;
  background: var(--ui-bg);
  max-height: 8rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.gallery-empty {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  margin: 0;
  text-align: center;
  padding: 0.25rem 0;
}

.gallery-grid {
  display: flex;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.gallery-item {
  position: relative;
  flex-shrink: 0;
  width: 5rem;
  height: 5rem;
  border-radius: var(--ui-radius);
  overflow: hidden;
  border: 1px solid var(--ui-border);
  cursor: pointer;

  &:hover .gallery-item-actions {
    opacity: 1;
  }
}

.gallery-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gallery-item-actions {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.15s ease;
}

// ─── アニメーション ───────────────────────────────────────

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.gallery-item-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.gallery-item-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.gallery-item-leave-active {
  transition: opacity 0.15s ease;
}

.gallery-item-leave-to {
  opacity: 0;
}

// ─── レスポンシブ（コンテナクエリ） ──────────────────────────

// 480px 以下: コントロールパネルを下部の横スクロールストリップに移動
@container (max-width: 480px) {
  .camera-content {
    flex-direction: column;
  }

  .camera-controls {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--ui-border);
    max-height: 6rem;
    overflow-y: hidden;
    overflow-x: auto;
  }

  .controls-inner {
    flex-direction: row;
    flex-wrap: nowrap;
    padding: 0.5rem 0.75rem;
    gap: 0.75rem;
    min-width: max-content;
    align-items: flex-end;
  }

  .control-field {
    min-width: 7.5rem;
    flex-shrink: 0;
  }

  .camera-toolbar {
    padding: 0.25rem 0.5rem;
  }
}

// 360px 以下: さらにコンパクト
@container (max-width: 360px) {
  .camera-device-select {
    max-width: 9rem;
  }

  .gallery-item {
    width: 4rem;
    height: 4rem;
  }

  .shutter-btn {
    min-width: 6rem;
  }
}
</style>
