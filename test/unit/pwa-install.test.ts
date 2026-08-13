import { describe, it, expect, beforeEach } from 'vitest'
import {
  usePwaInstall,
  setDeferredPrompt,
  setIsInstalled,
  setIsPwaSupported,
  type BeforeInstallPromptEvent
} from '../../layers/core/app/composables/usePwaInstall'

describe('usePwaInstall', () => {
  beforeEach(() => {
    setDeferredPrompt(null)
    setIsInstalled(false)
    setIsPwaSupported(false)
  })

  it('reports initial state correctly', () => {
    const { canInstall, isInstalled, isPwaSupported } = usePwaInstall()
    expect(canInstall.value).toBe(false)
    expect(isInstalled.value).toBe(false)
    expect(isPwaSupported.value).toBe(false)
  })

  it('enables canInstall when deferredPrompt is set and not installed', () => {
    const mockEvent = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      prompt: () => Promise.resolve()
    } as unknown as BeforeInstallPromptEvent

    setDeferredPrompt(mockEvent)
    const { canInstall, isInstalled } = usePwaInstall()
    expect(canInstall.value).toBe(true)
    expect(isInstalled.value).toBe(false)
  })

  it('handles promptInstall accepting installation', async () => {
    let promptCalled = false
    const mockEvent = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      prompt: () => {
        promptCalled = true
        return Promise.resolve()
      }
    } as unknown as BeforeInstallPromptEvent

    setDeferredPrompt(mockEvent)
    const { canInstall, isInstalled, promptInstall } = usePwaInstall()

    const result = await promptInstall()
    expect(promptCalled).toBe(true)
    expect(result).toBe(true)
    expect(isInstalled.value).toBe(true)
    expect(canInstall.value).toBe(false)
  })

  it('handles promptInstall dismissing installation', async () => {
    const mockEvent = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
      prompt: () => Promise.resolve()
    } as unknown as BeforeInstallPromptEvent

    setDeferredPrompt(mockEvent)
    const { canInstall, isInstalled, promptInstall } = usePwaInstall()

    const result = await promptInstall()
    expect(result).toBe(false)
    expect(isInstalled.value).toBe(false)
    expect(canInstall.value).toBe(true)
  })
})
