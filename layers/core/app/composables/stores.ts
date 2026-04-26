// Re-export Pinia store and types through composables/ so Nuxt auto-import picks them up.
export { useDesktopStore } from '../stores/desktop'
export type { WindowState, VirtualDesktop, AppMeta, DesktopState, AppFont } from '../stores/desktop'
