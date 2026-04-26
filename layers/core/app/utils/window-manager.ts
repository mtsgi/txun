export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export type SnapZone
  = | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'maximize'

const SNAP_THRESHOLD = 24

/**
 * Detect if a cursor position is within a snap zone.
 * Returns null when not near any snap zone.
 */
export function detectSnapZone(
  cursorX: number,
  cursorY: number,
  screenWidth: number,
  screenHeight: number
): SnapZone | null {
  const nearLeft = cursorX <= SNAP_THRESHOLD
  const nearRight = cursorX >= screenWidth - SNAP_THRESHOLD
  const nearTop = cursorY <= SNAP_THRESHOLD
  const nearBottom = cursorY >= screenHeight - SNAP_THRESHOLD

  if (nearTop && nearLeft) return 'top-left'
  if (nearTop && nearRight) return 'top-right'
  if (nearBottom && nearLeft) return 'bottom-left'
  if (nearBottom && nearRight) return 'bottom-right'
  if (nearTop) return 'maximize'
  if (nearLeft) return 'left'
  if (nearRight) return 'right'

  return null
}

/**
 * Compute the resulting window bounds for a given snap zone.
 */
export function applySnapZone(
  zone: SnapZone,
  screenWidth: number,
  screenHeight: number,
  taskbarHeight = 48
): WindowBounds {
  const availH = screenHeight - taskbarHeight
  const halfW = Math.floor(screenWidth / 2)
  const halfH = Math.floor(availH / 2)

  switch (zone) {
    case 'left':
      return { x: 0, y: 0, width: halfW, height: availH }
    case 'right':
      return { x: halfW, y: 0, width: screenWidth - halfW, height: availH }
    case 'top-left':
      return { x: 0, y: 0, width: halfW, height: halfH }
    case 'top-right':
      return { x: halfW, y: 0, width: screenWidth - halfW, height: halfH }
    case 'bottom-left':
      return { x: 0, y: halfH, width: halfW, height: availH - halfH }
    case 'bottom-right':
      return { x: halfW, y: halfH, width: screenWidth - halfW, height: availH - halfH }
    case 'maximize':
      return { x: 0, y: 0, width: screenWidth, height: availH }
  }
}

/**
 * Clamp window position so at least `minVisible` pixels remain on screen.
 */
export function clampPosition(
  bounds: WindowBounds,
  screenWidth: number,
  screenHeight: number,
  taskbarHeight = 48,
  minVisible = 60
): WindowBounds {
  const maxX = screenWidth - minVisible
  const maxY = screenHeight - taskbarHeight - minVisible
  const minX = minVisible - bounds.width
  const minY = 0

  return {
    ...bounds,
    x: Math.min(maxX, Math.max(minX, bounds.x)),
    y: Math.min(maxY, Math.max(minY, bounds.y))
  }
}

/**
 * Calculate a cascading initial position for a new window.
 */
export function cascadePosition(
  existingCount: number,
  defaultWidth: number,
  defaultHeight: number,
  screenWidth: number,
  screenHeight: number,
  taskbarHeight = 48
): WindowBounds {
  const STEP = 30
  const maxSteps = Math.max(1, Math.floor((Math.min(screenWidth, screenHeight) - 200) / STEP))
  const step = existingCount % maxSteps

  return {
    x: 80 + step * STEP,
    y: 40 + step * STEP,
    width: Math.min(defaultWidth, screenWidth - 120),
    height: Math.min(defaultHeight, screenHeight - taskbarHeight - 80)
  }
}
