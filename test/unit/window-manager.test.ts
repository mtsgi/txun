import { describe, it, expect } from 'vitest'
import {
  detectSnapZone,
  applySnapZone,
  clampPosition,
  cascadePosition
} from '../../layers/core/app/utils/window-manager'

const W = 1920
const H = 1080
const TH = 48

describe('detectSnapZone', () => {
  it('returns null in the center of the screen', () => {
    expect(detectSnapZone(960, 540, W, H)).toBeNull()
  })

  it('detects left edge', () => {
    expect(detectSnapZone(10, 400, W, H)).toBe('left')
  })

  it('detects right edge', () => {
    expect(detectSnapZone(W - 5, 400, W, H)).toBe('right')
  })

  it('detects top-center as maximize', () => {
    expect(detectSnapZone(800, 5, W, H)).toBe('maximize')
  })

  it('detects top-left corner', () => {
    expect(detectSnapZone(5, 5, W, H)).toBe('top-left')
  })

  it('detects top-right corner', () => {
    expect(detectSnapZone(W - 5, 5, W, H)).toBe('top-right')
  })

  it('detects bottom-left corner', () => {
    expect(detectSnapZone(5, H - 5, W, H)).toBe('bottom-left')
  })

  it('detects bottom-right corner', () => {
    expect(detectSnapZone(W - 5, H - 5, W, H)).toBe('bottom-right')
  })
})

describe('applySnapZone', () => {
  it('left snap fills left half', () => {
    const b = applySnapZone('left', W, H, TH)
    expect(b.x).toBe(0)
    expect(b.y).toBe(0)
    expect(b.width).toBe(W / 2)
    expect(b.height).toBe(H - TH)
  })

  it('right snap fills right half', () => {
    const b = applySnapZone('right', W, H, TH)
    expect(b.x).toBe(W / 2)
    expect(b.width).toBe(W / 2)
  })

  it('maximize fills full desktop area', () => {
    const b = applySnapZone('maximize', W, H, TH)
    expect(b).toEqual({ x: 0, y: 0, width: W, height: H - TH })
  })

  it('top-left fills top-left quarter', () => {
    const b = applySnapZone('top-left', W, H, TH)
    expect(b.x).toBe(0)
    expect(b.y).toBe(0)
    expect(b.width).toBe(W / 2)
    expect(b.height).toBe(Math.floor((H - TH) / 2))
  })

  it('sum of top-left and bottom-left heights equals desktop height', () => {
    const tl = applySnapZone('top-left', W, H, TH)
    const bl = applySnapZone('bottom-left', W, H, TH)
    expect(tl.height + bl.height).toBe(H - TH)
  })
})

describe('clampPosition', () => {
  it('does not change an already valid position', () => {
    const b = { x: 200, y: 100, width: 600, height: 400 }
    const result = clampPosition(b, W, H, TH)
    expect(result.x).toBe(200)
    expect(result.y).toBe(100)
  })

  it('clamps y to 0 when above the top edge', () => {
    const b = { x: 200, y: -50, width: 600, height: 400 }
    const result = clampPosition(b, W, H, TH)
    expect(result.y).toBe(0)
  })

  it('prevents the window from going below the taskbar', () => {
    const b = { x: 200, y: H, width: 600, height: 400 }
    const result = clampPosition(b, W, H, TH)
    expect(result.y).toBeLessThan(H - TH)
  })
})

describe('cascadePosition', () => {
  it('first window starts at base offset', () => {
    const b = cascadePosition(0, 800, 600, W, H, TH)
    expect(b.x).toBeGreaterThanOrEqual(80)
    expect(b.y).toBeGreaterThanOrEqual(40)
  })

  it('subsequent windows are offset from previous', () => {
    const b0 = cascadePosition(0, 800, 600, W, H, TH)
    const b1 = cascadePosition(1, 800, 600, W, H, TH)
    expect(b1.x).toBeGreaterThan(b0.x)
    expect(b1.y).toBeGreaterThan(b0.y)
  })

  it('width does not exceed screen', () => {
    const b = cascadePosition(0, 9999, 9999, W, H, TH)
    expect(b.width).toBeLessThanOrEqual(W)
    expect(b.height).toBeLessThanOrEqual(H - TH)
  })
})
