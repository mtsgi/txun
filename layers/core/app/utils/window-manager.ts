/**
 * タスクバーによって削られる有効領域の四辺インセットを表す型。
 * 各値はタスクバーが占有する幅（px）。
 */
export type TaskbarInsets = {
  /** 上辺のインセット（px） */
  top: number
  /** 下辺のインセット（px） */
  bottom: number
  /** 左辺のインセット（px） */
  left: number
  /** 右辺のインセット（px） */
  right: number
}

/** ウィンドウの座標とサイズを表すインターフェース */
export interface WindowBounds {
  /** 左端の X 座標（px） */
  x: number
  /** 上端の Y 座標（px） */
  y: number
  /** ウィンドウの幅（px） */
  width: number
  /** ウィンドウの高さ（px） */
  height: number
}

/**
 * ウィンドウのスナップ先ゾーンを表す型。
 * 画面の 6 方向の端領域と最大化ゾーンが存在する。
 */
export type SnapZone
  = | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'maximize'

/** スナップゾーンと判定する画面端からのピクセル距離 */
const SNAP_THRESHOLD = 24

/**
 * カーソル位置がスナップゾーン内にあるかを検出する。
 * どのゾーンにも属さない場合は null を返す。
 * @param cursorX - カーソルの X 座標（px）
 * @param cursorY - カーソルの Y 座標（px）
 * @param screenWidth - 画面幅（px）
 * @param screenHeight - 画面高（px）
 * @returns スナップゾーン識別子、またはゾーン外の場合は null
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
 * 指定したスナップゾーンに対応するウィンドウ座標とサイズを計算して返す。
 * @param zone - スナップ先ゾーン
 * @param screenWidth - 画面幅（px）
 * @param screenHeight - 画面高（px）
 * @param taskbarHeight - タスクバーの高さ（px）。taskbarInsets 指定時は無視される。デフォルト 48
 * @param taskbarInsets - タスクバーによる四辺インセット（指定時は taskbarHeight より優先）
 * @returns スナップ後のウィンドウ境界
 */
export function applySnapZone(
  zone: SnapZone,
  screenWidth: number,
  screenHeight: number,
  taskbarHeight = 48,
  taskbarInsets?: TaskbarInsets
): WindowBounds {
  const insets = taskbarInsets ?? { top: 0, bottom: taskbarHeight, left: 0, right: 0 }
  const originX = insets.left
  const originY = insets.top
  const availW = screenWidth - insets.left - insets.right
  const availH = screenHeight - insets.top - insets.bottom
  const halfW = Math.floor(availW / 2)
  const halfH = Math.floor(availH / 2)

  switch (zone) {
    case 'left':
      return { x: originX, y: originY, width: halfW, height: availH }
    case 'right':
      return { x: originX + halfW, y: originY, width: availW - halfW, height: availH }
    case 'top-left':
      return { x: originX, y: originY, width: halfW, height: halfH }
    case 'top-right':
      return { x: originX + halfW, y: originY, width: availW - halfW, height: halfH }
    case 'bottom-left':
      return { x: originX, y: originY + halfH, width: halfW, height: availH - halfH }
    case 'bottom-right':
      return { x: originX + halfW, y: originY + halfH, width: availW - halfW, height: availH - halfH }
    case 'maximize':
      return { x: originX, y: originY, width: availW, height: availH }
  }
}

/**
 * ウィンドウが画面外にはみ出さないよう座標をクランプする。
 * `minVisible` ピクセル以上が常に画面内に収まることを保証する。
 * @param bounds - クランプ前のウィンドウ境界
 * @param screenWidth - 画面幅（px）
 * @param screenHeight - 画面高（px）
 * @param taskbarHeight - タスクバーの高さ（px）。taskbarInsets 指定時は無視される。デフォルト 48
 * @param minVisible - 画面内に残す最小ピクセル数。デフォルト 60
 * @param taskbarInsets - タスクバーによる四辺インセット（指定時は taskbarHeight より優先）
 * @returns クランプ後のウィンドウ境界
 */
export function clampPosition(
  bounds: WindowBounds,
  screenWidth: number,
  screenHeight: number,
  taskbarHeight = 48,
  minVisible = 60,
  taskbarInsets?: TaskbarInsets
): WindowBounds {
  const insets = taskbarInsets ?? { top: 0, bottom: taskbarHeight, left: 0, right: 0 }
  const maxX = screenWidth - insets.right - minVisible
  const maxY = screenHeight - insets.bottom - minVisible
  const minX = insets.left + minVisible - bounds.width
  const minY = insets.top

  return {
    ...bounds,
    x: Math.min(maxX, Math.max(minX, bounds.x)),
    y: Math.min(maxY, Math.max(minY, bounds.y))
  }
}

/**
 * 新規ウィンドウのカスケード初期位置を計算して返す。
 * 既存ウィンドウ数に応じてオフセットをずらし、重なりを軽減する。
 * @param existingCount - 同アプリの既存ウィンドウ数
 * @param defaultWidth - ウィンドウのデフォルト幅（px）
 * @param defaultHeight - ウィンドウのデフォルト高さ（px）
 * @param screenWidth - 画面幅（px）
 * @param screenHeight - 画面高（px）
 * @param taskbarHeight - タスクバーの高さ（px）。taskbarInsets 指定時は無視される。デフォルト 48
 * @param taskbarInsets - タスクバーによる四辺インセット（指定時は taskbarHeight より優先）
 * @returns 初期ウィンドウ境界
 */
export function cascadePosition(
  existingCount: number,
  defaultWidth: number,
  defaultHeight: number,
  screenWidth: number,
  screenHeight: number,
  taskbarHeight = 48,
  taskbarInsets?: TaskbarInsets
): WindowBounds {
  const insets = taskbarInsets ?? { top: 0, bottom: taskbarHeight, left: 0, right: 0 }
  const STEP = 30
  const availW = screenWidth - insets.left - insets.right
  const availH = screenHeight - insets.top - insets.bottom
  const maxSteps = Math.max(1, Math.floor((Math.min(availW, availH) - 200) / STEP))
  const step = existingCount % maxSteps

  return {
    x: insets.left + 80 + step * STEP,
    y: insets.top + 40 + step * STEP,
    width: Math.min(defaultWidth, availW - 120),
    height: Math.min(defaultHeight, availH - 80)
  }
}
