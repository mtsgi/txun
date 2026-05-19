// Pinia ストアと型を composables/ 経由で re-export し、Nuxt auto-import に載せる。
// @pinia/nuxt はレイヤーの app/stores/ を自動スキャンしないため、このファイルが必要。
export { useDesktopStore } from '../stores/desktop'
export type { WindowState, VirtualDesktop, AppMeta, DesktopState, AppFont } from '../stores/desktop'

export { useDeviceStore } from '../stores/device'
export type { BluetoothDeviceMeta, HidDeviceMeta, SerialPortMeta, GamepadState, DeviceState } from '../stores/device'
