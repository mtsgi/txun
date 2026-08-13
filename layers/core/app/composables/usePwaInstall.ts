import { ref, computed, readonly } from 'vue'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isInstalled = ref(false)
const isPwaSupported = ref(false)

export function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt.value = event
}

export function setIsInstalled(value: boolean) {
  isInstalled.value = value
}

export function setIsPwaSupported(value: boolean) {
  isPwaSupported.value = value
}

export function usePwaInstall() {
  const canInstall = computed(() => !!deferredPrompt.value && !isInstalled.value)

  async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt.value) return false
    try {
      await deferredPrompt.value.prompt()
      const choiceResult = await deferredPrompt.value.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        deferredPrompt.value = null
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    canInstall,
    isInstalled: readonly(isInstalled),
    isPwaSupported: readonly(isPwaSupported),
    promptInstall
  }
}
