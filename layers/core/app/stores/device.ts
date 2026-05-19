/// <reference types="@types/web-bluetooth" />
/// <reference types="@types/w3c-web-serial" />
import { defineStore } from 'pinia'
import { markRaw } from 'vue'

// ─────────────────────────────────────────────────────────
// WebHID の型定義（@types/wicg-webhid は npmに存在しないためインライン定義）
// ─────────────────────────────────────────────────────────

/** WebHID デバイスフィルター */
export interface HIDDeviceFilter {
  vendorId?: number
  productId?: number
  usagePage?: number
  usage?: number
}

/** WebHID デバイスオブジェクト（ブラウザ API） */
export interface HIDDevice extends EventTarget {
  readonly opened: boolean
  readonly vendorId: number
  readonly productId: number
  readonly productName: string
  readonly collections: HIDCollectionInfo[]
  open(): Promise<void>
  close(): Promise<void>
  forget(): Promise<void>
  sendReport(reportId: number, data: BufferSource): Promise<void>
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>
  receiveFeatureReport(reportId: number): Promise<DataView>
}

/** WebHID コレクション情報 */
export interface HIDCollectionInfo {
  readonly usagePage?: number
  readonly usage?: number
  readonly type?: number
  readonly children: HIDCollectionInfo[]
  readonly inputReports: HIDReportInfo[]
  readonly outputReports: HIDReportInfo[]
  readonly featureReports: HIDReportInfo[]
}

/** WebHID レポート情報 */
export interface HIDReportInfo {
  readonly reportId?: number
  readonly items: HIDReportItem[]
}

/** WebHID レポートアイテム */
export interface HIDReportItem {
  readonly isAbsolute?: boolean
  readonly isArray?: boolean
  readonly isBufferedBytes?: boolean
  readonly isConstant?: boolean
  readonly isLinear?: boolean
  readonly isRange?: boolean
  readonly isVolatile?: boolean
  readonly hasNull?: boolean
  readonly hasPreferredState?: boolean
  readonly wrap?: boolean
  readonly usages?: number[]
  readonly usageMinimum?: number
  readonly usageMaximum?: number
  readonly reportSize?: number
  readonly reportCount?: number
  readonly unitExponent?: number
  readonly unitSystem?: string
  readonly unitFactorMassExponent?: number
  readonly unitFactorLengthExponent?: number
  readonly unitFactorTimeExponent?: number
  readonly unitFactorTemperatureExponent?: number
  readonly unitFactorCurrentExponent?: number
  readonly unitFactorLuminousIntensityExponent?: number
  readonly logicalMinimum?: number
  readonly logicalMaximum?: number
  readonly physicalMinimum?: number
  readonly physicalMaximum?: number
  readonly strings?: string[]
}

// ─────────────────────────────────────────────────────────
// アプリ側で使用するメタデータ型
// ─────────────────────────────────────────────────────────

/** Bluetooth デバイスのメタデータ */
export interface BluetoothDeviceMeta {
  /** デバイス固有の ID */
  id: string
  /** デバイス表示名 */
  name: string
}

/** HID デバイスのメタデータ */
export interface HidDeviceMeta {
  /** デバイス識別用の内部 ID (vendorId:productId:productName の結合) */
  id: string
  /** USB ベンダー ID */
  vendorId: number
  /** USB プロダクト ID */
  productId: number
  /** デバイス製品名 */
  productName: string
}

/** シリアルポートのメタデータ */
export interface SerialPortMeta {
  /** シリアルポート識別用の内部 ID */
  id: string
  /** ポート表示ラベル */
  label: string
  /** USB ベンダー ID（USB シリアルの場合） */
  usbVendorId?: number
  /** USB プロダクト ID（USB シリアルの場合） */
  usbProductId?: number
}

/** ゲームパッドの接続状態とリアルタイム入力情報 */
export interface GamepadState {
  /** Gamepad API の index */
  index: number
  /** ゲームパッドの識別子文字列 */
  id: string
  /** 接続中かどうか */
  connected: boolean
  /** 各ボタンの状態 */
  buttons: readonly GamepadButton[]
  /** 各アナログ軸の値 (-1.0〜1.0) */
  axes: readonly number[]
}

/** デバイス管理ストアの状態 */
export interface DeviceState {
  /** 接続中の Bluetooth デバイス一覧 */
  bluetoothDevices: BluetoothDeviceMeta[]
  /** 接続中の HID デバイス一覧 */
  hidDevices: HidDeviceMeta[]
  /** 接続中のシリアルポート一覧 */
  serialPorts: SerialPortMeta[]
  /** 検出済みゲームパッド一覧 */
  gamepads: GamepadState[]
}

// ─────────────────────────────────────────────────────────
// Pinia ストア
// ─────────────────────────────────────────────────────────

export const useDeviceStore = defineStore('device', {
  state: (): DeviceState & {
    /** Bluetooth デバイスハンドル（非リアクティブ） */
    _bluetoothHandles: Map<string, BluetoothDevice>
    /** HID デバイスハンドル（非リアクティブ） */
    _hidHandles: Map<string, HIDDevice>
    /** シリアルポートハンドル（非リアクティブ） */
    _serialHandles: Map<string, SerialPort>
    /** Gamepad イベントハンドラ参照（解除用） */
    _gamepadConnectedHandler: ((e: GamepadEvent) => void) | null
    _gamepadDisconnectedHandler: ((e: GamepadEvent) => void) | null
  } => ({
    bluetoothDevices: [],
    hidDevices: [],
    serialPorts: [],
    gamepads: [],
    _bluetoothHandles: markRaw(new Map<string, BluetoothDevice>()),
    _hidHandles: markRaw(new Map<string, HIDDevice>()),
    _serialHandles: markRaw(new Map<string, SerialPort>()),
    _gamepadConnectedHandler: null,
    _gamepadDisconnectedHandler: null
  }),

  actions: {
    /**
     * Web Bluetooth API でデバイスに接続する。
     * @param options - requestDevice のオプション（省略時は acceptAllDevices: true）
     */
    async connectBluetooth(options?: RequestDeviceOptions): Promise<void> {
      if (!('bluetooth' in navigator)) throw new Error('Web Bluetooth is not supported')
      const device = await navigator.bluetooth.requestDevice(
        options ?? { acceptAllDevices: true }
      )
      const id = device.id
      if (!this.bluetoothDevices.some(d => d.id === id)) {
        this.bluetoothDevices.push({ id, name: device.name ?? id })
        this._bluetoothHandles.set(id, device)
        device.addEventListener('gattserverdisconnected', () => {
          this.disconnectBluetooth(id)
        })
      }
    },

    /**
     * 指定した Bluetooth デバイスを切断して一覧から削除する。
     * @param id - 切断するデバイスの ID
     */
    disconnectBluetooth(id: string): void {
      const handle = this._bluetoothHandles.get(id)
      if (handle?.gatt?.connected) {
        handle.gatt.disconnect()
      }
      this._bluetoothHandles.delete(id)
      const idx = this.bluetoothDevices.findIndex(d => d.id === id)
      if (idx !== -1) this.bluetoothDevices.splice(idx, 1)
    },

    /**
     * WebHID API でデバイスに接続する。
     * @param filters - HID デバイスフィルター（省略時は全デバイス）
     */
    async connectHid(filters?: HIDDeviceFilter[]): Promise<void> {
      if (!('hid' in navigator)) throw new Error('WebHID is not supported')
      // navigator.hid は @types に含まれていないため unknown 経由でアクセス
      const hid = (navigator as unknown as { hid: { requestDevice(opts: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]> } }).hid
      const devices = await hid.requestDevice({ filters: filters ?? [] })
      for (const device of devices) {
        const id = `${device.vendorId}:${device.productId}:${device.productName}`
        if (!this.hidDevices.some(d => d.id === id)) {
          this.hidDevices.push({
            id,
            vendorId: device.vendorId,
            productId: device.productId,
            productName: device.productName
          })
          this._hidHandles.set(id, device)
        }
      }
    },

    /**
     * 指定した HID デバイスを切断して一覧から削除する。
     * @param id - 切断するデバイスの内部 ID
     */
    async disconnectHid(id: string): Promise<void> {
      const handle = this._hidHandles.get(id)
      if (handle?.opened) {
        await handle.close()
      }
      this._hidHandles.delete(id)
      const idx = this.hidDevices.findIndex(d => d.id === id)
      if (idx !== -1) this.hidDevices.splice(idx, 1)
    },

    /**
     * Web Serial API でシリアルポートに接続する。
     * @param options - requestPort のオプション
     */
    async connectSerial(options?: SerialPortRequestOptions): Promise<void> {
      if (!('serial' in navigator)) throw new Error('Web Serial is not supported')
      const port = await navigator.serial.requestPort(options)
      const info = port.getInfo()
      const id = crypto.randomUUID()
      const label = info.usbVendorId != null
        ? `USB Serial (${info.usbVendorId.toString(16).padStart(4, '0')}:${(info.usbProductId ?? 0).toString(16).padStart(4, '0')})`
        : 'Serial Port'
      this.serialPorts.push({
        id,
        label,
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId
      })
      this._serialHandles.set(id, port)
    },

    /**
     * 指定したシリアルポートを切断して一覧から削除する。
     * @param id - 切断するポートの内部 ID
     */
    async disconnectSerial(id: string): Promise<void> {
      const handle = this._serialHandles.get(id)
      if (handle) {
        try {
          await handle.close()
        } catch {
          // 既に切断済みの場合は無視
        }
      }
      this._serialHandles.delete(id)
      const idx = this.serialPorts.findIndex(p => p.id === id)
      if (idx !== -1) this.serialPorts.splice(idx, 1)
    },

    /**
     * Gamepad API のイベントリスナーを登録する。
     * SettingsApp の onMounted で呼び出すこと。
     */
    initGamepad(): void {
      if (typeof window === 'undefined') return
      const onConnected = (e: GamepadEvent) => {
        const gp = e.gamepad
        const existing = this.gamepads.findIndex(g => g.index === gp.index)
        const state: GamepadState = {
          index: gp.index,
          id: gp.id,
          connected: true,
          buttons: gp.buttons,
          axes: gp.axes
        }
        if (existing !== -1) {
          this.gamepads[existing] = state
        } else {
          this.gamepads.push(state)
        }
      }
      const onDisconnected = (e: GamepadEvent) => {
        const idx = this.gamepads.findIndex(g => g.index === e.gamepad.index)
        if (idx !== -1) {
          this.gamepads.splice(idx, 1)
        }
      }
      this._gamepadConnectedHandler = onConnected
      this._gamepadDisconnectedHandler = onDisconnected
      window.addEventListener('gamepadconnected', onConnected)
      window.addEventListener('gamepaddisconnected', onDisconnected)
      // すでに接続されているゲームパッドを取得
      this.updateGamepads()
    },

    /**
     * Gamepad API のイベントリスナーを解除する。
     * SettingsApp の onUnmounted で呼び出すこと。
     */
    destroyGamepad(): void {
      if (typeof window === 'undefined') return
      if (this._gamepadConnectedHandler) {
        window.removeEventListener('gamepadconnected', this._gamepadConnectedHandler)
        this._gamepadConnectedHandler = null
      }
      if (this._gamepadDisconnectedHandler) {
        window.removeEventListener('gamepaddisconnected', this._gamepadDisconnectedHandler)
        this._gamepadDisconnectedHandler = null
      }
    },

    /**
     * 現在接続されているゲームパッドの状態を更新する。
     * requestAnimationFrame ループから呼び出すこと。
     */
    updateGamepads(): void {
      if (typeof navigator === 'undefined') return
      const raw = navigator.getGamepads()
      const active: GamepadState[] = []
      for (const gp of raw) {
        if (!gp) continue
        active.push({
          index: gp.index,
          id: gp.id,
          connected: gp.connected,
          buttons: gp.buttons,
          axes: gp.axes
        })
      }
      // 既存の状態を更新（追加・削除）
      for (const gp of active) {
        const existing = this.gamepads.findIndex(g => g.index === gp.index)
        if (existing !== -1) {
          this.gamepads[existing] = gp
        } else {
          this.gamepads.push(gp)
        }
      }
      // 切断されたゲームパッドを削除
      const activeIndices = new Set(active.map(g => g.index))
      for (let i = this.gamepads.length - 1; i >= 0; i--) {
        if (!activeIndices.has(this.gamepads[i]!.index)) {
          this.gamepads.splice(i, 1)
        }
      }
    }
  }
})
