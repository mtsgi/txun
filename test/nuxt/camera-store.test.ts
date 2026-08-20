import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

describe('camera store - checkImageCaptureSupport', () => {
  let checkImageCaptureSupport: () => boolean

  beforeEach(async () => {
    vi.resetModules()
    checkImageCaptureSupport = (await import('../../layers/core/app/stores/camera')).checkImageCaptureSupport
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when import.meta.client is true and ImageCapture is in globalThis', () => {
    vi.stubGlobal('ImageCapture', class {
      // Dummy property to avoid no-extraneous-class rule
      dummy = true
    })
    expect(checkImageCaptureSupport()).toBe(true)
  })

  it('returns false when ImageCapture is not in globalThis', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalGlobal = globalThis as any
    const originalImageCapture = originalGlobal.ImageCapture
    delete originalGlobal.ImageCapture

    expect(checkImageCaptureSupport()).toBe(false)

    if (originalImageCapture !== undefined) {
      originalGlobal.ImageCapture = originalImageCapture
    }
  })
})
