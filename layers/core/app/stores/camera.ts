import { defineStore } from 'pinia'

// ─────────────────────────────────────────────────────────
// ImageCapture API の型定義
// TypeScript 標準 lib に含まれないため、W3C 仕様に基づきインライン定義
// ─────────────────────────────────────────────────────────

/** ImageCapture API のフォト capabilities */
interface ImageCapturePhotoCapabilities {
  redEyeReduction?: 'never' | 'always' | 'controllable'
  imageHeight?: MediaSettingsRange
  imageWidth?: MediaSettingsRange
  fillLightMode?: string[]
}

/** ImageCapture API のフォト設定 */
interface ImageCapturePhotoSettings {
  fillLightMode?: string
  imageHeight?: number
  imageWidth?: number
  redEyeReduction?: boolean
}

/** ImageCapture インスタンスのインターフェース */
interface ImageCaptureInstance {
  readonly track: MediaStreamTrack
  takePhoto(photoSettings?: ImageCapturePhotoSettings): Promise<Blob>
  getPhotoCapabilities(): Promise<ImageCapturePhotoCapabilities>
  grabFrame(): Promise<ImageBitmap>
}

/** window に ImageCapture が存在するか確認する型ガード用 Window 拡張 */
interface WindowWithImageCapture extends Window {
  ImageCapture?: new(videoTrack: MediaStreamTrack) => ImageCaptureInstance
}

// ─────────────────────────────────────────────────────────
// カメラ API 拡張型（ImageCapture API / W3C Media Capture 拡張）
// ─────────────────────────────────────────────────────────

/** カメラデバイス情報 */
export interface CameraDevice {
  /** デバイス固有の ID */
  deviceId: string
  /** デバイス表示名 */
  label: string
  /** デバイスグループ ID */
  groupId: string
}

/**
 * カメラトラックの capabilities（ImageCapture API 拡張フィールド含む）
 * 実行時は MediaStreamTrack.getCapabilities() の結果を as unknown as CameraCapabilities でキャストして使用する。
 */
export interface CameraCapabilities {
  zoom?: MediaSettingsRange
  torch?: boolean
  exposureMode?: string[]
  exposureTime?: MediaSettingsRange
  exposureCompensation?: MediaSettingsRange
  focusMode?: string[]
  focusDistance?: MediaSettingsRange
  whiteBalanceMode?: string[]
  colorTemperature?: MediaSettingsRange
  iso?: MediaSettingsRange
  brightness?: MediaSettingsRange
  contrast?: MediaSettingsRange
  facingMode?: string[]
  width?: MediaSettingsRange
  height?: MediaSettingsRange
  frameRate?: MediaSettingsRange
}

/**
 * カメラトラックの現在の settings（ImageCapture API 拡張フィールド含む）
 * 実行時は MediaStreamTrack.getSettings() の結果を as unknown as CameraSettings でキャストして使用する。
 */
export interface CameraSettings {
  zoom?: number
  torch?: boolean
  exposureMode?: string
  exposureTime?: number
  exposureCompensation?: number
  focusMode?: string
  focusDistance?: number
  whiteBalanceMode?: string
  colorTemperature?: number
  iso?: number
  brightness?: number
  contrast?: number
  facingMode?: string
  deviceId?: string
  width?: number
  height?: number
  frameRate?: number
}

/**
 * カメラに適用する制御値（ImageCapture API 拡張フィールド含む）
 * 実行時は MediaTrackConstraintSet として advanced 配列経由でブラウザ API に渡す。
 */
export interface CameraConstraints {
  zoom?: number
  torch?: boolean
  exposureMode?: string
  exposureTime?: number
  exposureCompensation?: number
  focusMode?: string
  focusDistance?: number
  whiteBalanceMode?: string
  colorTemperature?: number
  iso?: number
  brightness?: number
  contrast?: number
}

/** カメラストアの状態 */
export interface CameraState {
  /** 列挙されたビデオ入力デバイス一覧 */
  devices: CameraDevice[]
  /** 使用中のデバイス ID（null = デフォルト） */
  activeDeviceId: string | null
  /** カメラトラックの capabilities */
  capabilities: CameraCapabilities
  /** カメラトラックの現在の settings */
  settings: CameraSettings
  /** カメラストリーム中かどうか */
  isStreaming: boolean
  /** 撮影処理中かどうか */
  isTakingPhoto: boolean
  /** カメラ権限の状態（null = 未確認） */
  hasPermission: boolean | null
  /** ImageCapture API 対応かどうか */
  hasImageCaptureSupport: boolean
  /** キャプチャした写真の Blob URL 一覧（揮発性） */
  capturedPhotos: string[]
}

// ─────────────────────────────────────────────────────────
// 非リアクティブハンドル（Vue Proxy の影響を避けるためストア外に配置）
// ─────────────────────────────────────────────────────────

let _stream: MediaStream | null = null
let _imageCapture: ImageCaptureInstance | null = null
let _videoEl: HTMLVideoElement | null = null

// ─────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────

/** ImageCapture API がブラウザでサポートされているか確認する */
function checkImageCaptureSupport(): boolean {
  return import.meta.client && 'ImageCapture' in globalThis
}

/** ImageCapture インスタンスを生成する */
function createImageCapture(track: MediaStreamTrack): ImageCaptureInstance {
  return new (globalThis as unknown as WindowWithImageCapture).ImageCapture!(track)
}

// ─────────────────────────────────────────────────────────
// Pinia ストア
// ─────────────────────────────────────────────────────────

export const useCameraStore = defineStore('camera', {
  state: (): CameraState => ({
    devices: [],
    activeDeviceId: null,
    capabilities: {},
    settings: {},
    isStreaming: false,
    isTakingPhoto: false,
    hasPermission: null,
    hasImageCaptureSupport: false,
    capturedPhotos: []
  }),

  actions: {
    /**
     * 利用可能なビデオ入力デバイスを列挙する。
     * デバイスラベルが取得できた場合はカメラ権限が付与済みと判定する。
     */
    async enumerateDevices(): Promise<void> {
      if (!import.meta.client || !navigator.mediaDevices) return
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        this.devices = allDevices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label, groupId: d.groupId }))
        // ラベルが取得できていれば権限付与済み、空なら未確認（null）に正規化する
        if (this.devices.length > 0 && this.devices.some(d => d.label !== '')) {
          this.hasPermission = true
        } else {
          if (this.hasPermission !== false) this.hasPermission = null
        }
      } catch {
        this.devices = []
        if (this.hasPermission !== false) this.hasPermission = null
      }
    },

    /**
     * カメラ権限をユーザーに要求する。
     * 承認後にデバイス一覧を再取得してデバイスラベルを更新する。
     */
    async requestPermission(): Promise<boolean> {
      if (!import.meta.client || !navigator.mediaDevices) return false
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
        this.hasPermission = true
        await this.enumerateDevices()
        return true
      } catch {
        this.hasPermission = false
        return false
      }
    },

    /**
     * カメラストリームを開始する。
     * @param deviceId - 使用するデバイス ID（省略時はデフォルト）
     */
    async startStream(deviceId?: string): Promise<void> {
      if (!import.meta.client || !navigator.mediaDevices) return
      this.stopStream()
      const targetId = deviceId ?? this.activeDeviceId ?? undefined
      const constraints: MediaStreamConstraints = {
        video: targetId ? { deviceId: { exact: targetId } } : true
      }
      try {
        _stream = await navigator.mediaDevices.getUserMedia(constraints)
        this.hasPermission = true
        this.isStreaming = true
        const track = _stream.getVideoTracks()[0]
        if (track) {
          this.activeDeviceId = track.getSettings().deviceId ?? targetId ?? null
          this.refreshCapabilitiesAndSettings()
          // ImageCapture の初期化
          if (checkImageCaptureSupport()) {
            _imageCapture = createImageCapture(track)
            this.hasImageCaptureSupport = true
          } else {
            _imageCapture = null
            this.hasImageCaptureSupport = false
          }
        }
        // マウント済みの video 要素に srcObject をセット
        if (_videoEl) {
          _videoEl.srcObject = _stream
        }
      } catch {
        this.hasPermission = false
        this.isStreaming = false
      }
    },

    /**
     * カメラストリームを停止する。
     */
    stopStream(): void {
      if (_stream) {
        _stream.getTracks().forEach(t => t.stop())
        _stream = null
      }
      _imageCapture = null
      if (_videoEl) {
        _videoEl.srcObject = null
      }
      this.isStreaming = false
      this.capabilities = {}
      this.settings = {}
    },

    /**
     * 使用するカメラデバイスを切り替える。
     * @param deviceId - 切り替え先のデバイス ID
     */
    async switchDevice(deviceId: string): Promise<void> {
      await this.startStream(deviceId)
    },

    /**
     * video 要素をストアに登録し、srcObject を現在の stream にセットする。
     * 複数の CameraApp ウィンドウが開かれた場合は最後に登録した要素が使用される。
     * @param el - バインドする HTMLVideoElement
     */
    mountVideoElement(el: HTMLVideoElement): void {
      _videoEl = el
      if (_stream) {
        el.srcObject = _stream
      }
    },

    /**
     * 写真を撮影し、Blob URL を capturedPhotos に追加して返す。
     * ImageCapture 非対応時は canvas を使ったフォールバックを使用する。
     */
    async capturePhoto(): Promise<string | null> {
      if (!this.isStreaming) return null
      this.isTakingPhoto = true
      try {
        let blob: Blob | null = null
        if (_imageCapture && this.hasImageCaptureSupport) {
          blob = await _imageCapture.takePhoto()
        } else if (_videoEl) {
          // Canvas フォールバック（ImageCapture 非対応ブラウザ用）
          const canvas = document.createElement('canvas')
          canvas.width = _videoEl.videoWidth || 640
          canvas.height = _videoEl.videoHeight || 480
          canvas.getContext('2d')?.drawImage(_videoEl, 0, 0, canvas.width, canvas.height)
          blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95))
        }
        if (!blob) return null
        const url = URL.createObjectURL(blob)
        this.capturedPhotos.push(url)
        return url
      } finally {
        this.isTakingPhoto = false
      }
    },

    /**
     * カメラトラックに constraints を適用し、capabilities / settings を更新する。
     * advanced 配列経由で ImageCapture API 拡張フィールドを送信する。
     * @param constraints - 適用するカメラ制御値
     */
    async applyConstraints(constraints: CameraConstraints): Promise<void> {
      const track = _stream?.getVideoTracks()[0]
      if (!track) return
      try {
        await track.applyConstraints({
          advanced: [constraints as unknown as MediaTrackConstraintSet]
        })
        this.refreshCapabilitiesAndSettings()
      } catch {
        // 制約値が非対応の場合などは無視して現在の settings を再取得する
        this.refreshCapabilitiesAndSettings()
      }
    },

    /**
     * 現在のカメラトラックから capabilities と settings を再取得して状態を更新する。
     */
    refreshCapabilitiesAndSettings(): void {
      const track = _stream?.getVideoTracks()[0]
      if (!track) return
      this.capabilities = track.getCapabilities() as unknown as CameraCapabilities
      this.settings = track.getSettings() as unknown as CameraSettings
    },

    /**
     * 指定した Blob URL の写真をブラウザのダウンロード機能でダウンロードする。
     * @param blobUrl - ダウンロードする Blob URL
     * @param filename - 保存ファイル名（省略時は日時から自動生成）
     */
    downloadPhoto(blobUrl: string, filename?: string): void {
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename ?? `photo_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`
      a.click()
    },

    /**
     * 指定した Blob URL の写真をギャラリーから削除し、URL リソースを解放する。
     * @param blobUrl - 削除する Blob URL
     */
    removePhoto(blobUrl: string): void {
      const idx = this.capturedPhotos.indexOf(blobUrl)
      if (idx !== -1) {
        this.capturedPhotos.splice(idx, 1)
        URL.revokeObjectURL(blobUrl)
      }
    },

    /**
     * キャプチャ済み写真を全て削除し、Blob URL リソースを解放する。
     */
    clearPhotos(): void {
      for (const url of this.capturedPhotos) {
        URL.revokeObjectURL(url)
      }
      this.capturedPhotos = []
    }
  }
})
