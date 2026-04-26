import { useDesktopStore } from '../stores/desktop'

export function useVirtualDesktop() {
  const store = useDesktopStore()

  function addDesktop(): void {
    store.addVirtualDesktop()
  }

  function removeDesktop(id: string): void {
    store.removeVirtualDesktop(id)
  }

  function switchDesktop(id: string): void {
    store.switchVirtualDesktop(id)
  }

  return {
    desktops: computed(() => store.virtualDesktops),
    activeId: computed(() => store.activeVirtualDesktopId),
    addDesktop,
    removeDesktop,
    switchDesktop
  }
}
