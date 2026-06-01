<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'

defineProps<{ windowId: string }>()

const { t, locale } = useI18n()
const { saveState, loadState } = useDesktopStorage()

/** ボード背景に使用するプリセット種別 */
type BoardBackground = 'plain' | 'grid' | 'dots'

/** 描画時に選択できるツール種別 */
type WhiteboardTool = 'pen' | 'eraser'

/** キャンバス上の一点を表す座標 */
interface WhiteboardPoint {
  /** X 座標 */
  x: number
  /** Y 座標 */
  y: number
}

/** 一本分の描画履歴を表すストローク */
interface WhiteboardStroke {
  /** ストローク固有の ID */
  id: string
  /** 描画に使用したツール */
  tool: WhiteboardTool
  /** 線色 */
  color: string
  /** 線幅 */
  width: number
  /** 構成点一覧 */
  points: WhiteboardPoint[]
}

/** 一枚分の作業ボードを表すデータ */
interface WhiteboardBoard {
  /** ボード固有の ID */
  id: string
  /** ボード名 */
  name: string
  /** 背景プリセット */
  background: BoardBackground
  /** 描画履歴 */
  strokes: WhiteboardStroke[]
  /** 作成日時 */
  createdAt: number
  /** 更新日時 */
  updatedAt: number
}

/** 永続化対象のホワイトボード状態 */
interface WhiteboardState {
  /** ボード一覧 */
  boards: WhiteboardBoard[]
  /** 現在選択中のボード ID */
  activeBoardId: string | null
}

const STORAGE_KEY = 'whiteboard'
const PALETTE_COLORS = ['#111827', '#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c']
const MIN_STROKE_WIDTH = 2
const MAX_STROKE_WIDTH = 24

const containerRef = ref<HTMLElement | null>(null)
const surfaceRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const containerWidth = ref(960)
const boards = ref<WhiteboardBoard[]>([])
const activeBoardId = ref<string | null>(null)
const currentTool = ref<WhiteboardTool>('pen')
const currentColor = ref(PALETTE_COLORS[0] ?? '#111827')
const currentLineWidth = ref(5)
const currentStroke = ref<WhiteboardStroke | null>(null)
const activePointerId = ref<number | null>(null)
const redoStacks = ref<Record<string, WhiteboardStroke[]>>({})

const isCompact = computed(() => containerWidth.value < 860)

const activeBoard = computed<WhiteboardBoard | null>(() =>
  boards.value.find(board => board.id === activeBoardId.value) ?? null
)

const canUndo = computed(() => (activeBoard.value?.strokes.length ?? 0) > 0)

const canRedo = computed(() => {
  const board = activeBoard.value
  if (!board) return false
  return (redoStacks.value[board.id]?.length ?? 0) > 0
})

const boardName = computed({
  get: (): string => activeBoard.value?.name ?? '',
  set: (value: string): void => {
    const board = activeBoard.value
    if (!board) return
    board.name = value.trim() || createBoardName(boards.value.length)
    board.updatedAt = Date.now()
    schedulePersist()
  }
})

const selectedBackground = computed({
  get: (): BoardBackground => activeBoard.value?.background ?? 'grid',
  set: (value: BoardBackground): void => {
    const board = activeBoard.value
    if (!board) return
    board.background = value
    board.updatedAt = Date.now()
    schedulePersist()
  }
})

const backgroundOptions = computed<SelectItem[]>(() => [
  { label: t('apps.whiteboard.backgroundPlain'), value: 'plain' },
  { label: t('apps.whiteboard.backgroundGrid'), value: 'grid' },
  { label: t('apps.whiteboard.backgroundDots'), value: 'dots' }
])

const boardSurfaceClass = computed(() => {
  const board = activeBoard.value
  return {
    'background-plain': !board || board.background === 'plain',
    'background-grid': board?.background === 'grid',
    'background-dots': board?.background === 'dots'
  }
})

let containerObserver: ResizeObserver | null = null
let surfaceObserver: ResizeObserver | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(activeBoardId, () => {
  currentStroke.value = null
  activePointerId.value = null
  renderBoard()
})

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    containerObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    containerObserver.observe(containerRef.value)
  }

  if (surfaceRef.value) {
    surfaceObserver = new ResizeObserver(() => {
      syncCanvasSize()
    })
    surfaceObserver.observe(surfaceRef.value)
  }

  const saved = await loadState<WhiteboardState>(STORAGE_KEY)
  if (saved?.boards.length) {
    boards.value = saved.boards
    activeBoardId.value = saved.boards.some(board => board.id === saved.activeBoardId)
      ? saved.activeBoardId
      : saved.boards[0]?.id ?? null
  } else {
    const board = createBoardDefinition(1)
    boards.value = [board]
    activeBoardId.value = board.id
  }

  await nextTick()
  syncCanvasSize()
  renderBoard()
})

onUnmounted(() => {
  containerObserver?.disconnect()
  surfaceObserver?.disconnect()
  if (saveTimer) clearTimeout(saveTimer)
})

/** 指定インデックスに対応する初期ボード名を生成する */
function createBoardName(index: number): string {
  return `${t('apps.whiteboard.newBoard')} ${index}`
}

/** 新規ボード定義を生成する */
function createBoardDefinition(index: number): WhiteboardBoard {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: createBoardName(index),
    background: 'grid',
    strokes: [],
    createdAt: now,
    updatedAt: now
  }
}

/** ストロークを描画用に複製する */
function cloneStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  return {
    ...stroke,
    points: stroke.points.map(point => ({ ...point }))
  }
}

/** 現在の状態を IndexedDB に保存する */
async function persistBoards(): Promise<void> {
  const state: WhiteboardState = {
    boards: boards.value,
    activeBoardId: activeBoardId.value
  }
  await saveState(STORAGE_KEY, state)
}

/** 保存を短いディレイで予約する */
function schedulePersist(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await persistBoards()
  }, 250)
}

/** ボード一覧に新しいキャンバスを追加する */
function createBoard(): void {
  const board = createBoardDefinition(boards.value.length + 1)
  boards.value.unshift(board)
  activeBoardId.value = board.id
  redoStacks.value[board.id] = []
  schedulePersist()
  renderBoard()
}

/** 指定ボードを現在の作業対象に切り替える */
function selectBoard(boardId: string): void {
  activeBoardId.value = boardId
}

/** 現在のボードを削除する */
function deleteBoard(): void {
  const board = activeBoard.value
  if (!board) return
  const confirmed = window.confirm(t('apps.whiteboard.deleteBoardConfirm', { name: board.name }))
  if (!confirmed) return

  const index = boards.value.findIndex(item => item.id === board.id)
  if (index === -1) return

  boards.value.splice(index, 1)
  redoStacks.value[board.id] = []

  if (boards.value.length === 0) {
    const fallback = createBoardDefinition(1)
    boards.value = [fallback]
    activeBoardId.value = fallback.id
  } else {
    activeBoardId.value = boards.value[Math.min(index, boards.value.length - 1)]?.id ?? null
  }

  schedulePersist()
  renderBoard()
}

/** 現在のボード上の描画を全消去する */
function clearBoard(): void {
  const board = activeBoard.value
  if (!board) return
  const confirmed = window.confirm(t('apps.whiteboard.clearBoardConfirm', { name: board.name }))
  if (!confirmed) return

  board.strokes = []
  redoStacks.value[board.id] = []
  board.updatedAt = Date.now()
  schedulePersist()
  renderBoard()
}

/** 最後のストロークを取り消す */
function undoStroke(): void {
  const board = activeBoard.value
  if (!board) return
  const removed = board.strokes.pop()
  if (!removed) return
  ;(redoStacks.value[board.id] ??= []).push(removed)
  board.updatedAt = Date.now()
  schedulePersist()
  renderBoard()
}

/** 取り消したストロークを復元する */
function redoStroke(): void {
  const board = activeBoard.value
  if (!board) return
  const redoStack = redoStacks.value[board.id]
  const restored = redoStack?.pop()
  if (!restored) return
  board.strokes.push(restored)
  board.updatedAt = Date.now()
  schedulePersist()
  renderBoard()
}

/** 編集日時をロケールに応じて短い表記へ整形する */
function formatUpdatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** キャンバスサイズを表示領域に追従させる */
function syncCanvasSize(): void {
  const canvas = canvasRef.value
  const surface = surfaceRef.value
  if (!canvas || !surface) return

  const rect = surface.getBoundingClientRect()
  const width = Math.max(rect.width, 1)
  const height = Math.max(rect.height, 1)
  const dpr = window.devicePixelRatio || 1
  const nextWidth = Math.floor(width * dpr)
  const nextHeight = Math.floor(height * dpr)

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  renderBoard()
}

/** ストローク一つ分をキャンバスへ描画する */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke): void {
  const firstPoint = stroke.points[0]
  if (!firstPoint) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.width

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
  }

  if (stroke.points.length === 1) {
    ctx.beginPath()
    ctx.arc(firstPoint.x, firstPoint.y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(firstPoint.x, firstPoint.y)

  for (const point of stroke.points.slice(1)) {
    ctx.lineTo(point.x, point.y)
  }

  ctx.stroke()
  ctx.restore()
}

/** 現在のボード内容をキャンバスへ再描画する */
function renderBoard(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const board = activeBoard.value
  if (board) {
    for (const stroke of board.strokes) {
      drawStroke(ctx, stroke)
    }
  }

  if (currentStroke.value) {
    drawStroke(ctx, currentStroke.value)
  }
}

/** PointerEvent からキャンバス座標を算出する */
function getCanvasPoint(event: PointerEvent): WhiteboardPoint | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
  }
}

/** 新しいストローク入力を開始する */
function startDrawing(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const board = activeBoard.value
  const point = getCanvasPoint(event)
  if (!board || !point) return

  event.preventDefault()
  canvasRef.value?.setPointerCapture(event.pointerId)
  activePointerId.value = event.pointerId
  currentStroke.value = {
    id: crypto.randomUUID(),
    tool: currentTool.value,
    color: currentColor.value,
    width: currentTool.value === 'eraser' ? currentLineWidth.value * 1.8 : currentLineWidth.value,
    points: [point]
  }
  renderBoard()
}

/** 現在入力中のストロークに点を追加する */
function updateDrawing(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId || !currentStroke.value) return
  const point = getCanvasPoint(event)
  if (!point) return

  const lastPoint = currentStroke.value.points[currentStroke.value.points.length - 1]
  if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return

  currentStroke.value.points.push(point)
  renderBoard()
}

/** 現在入力中のストロークを確定する */
function finishDrawing(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId) return

  const board = activeBoard.value
  const stroke = currentStroke.value
  if (board && stroke) {
    board.strokes.push(cloneStroke(stroke))
    board.updatedAt = Date.now()
    redoStacks.value[board.id] = []
    schedulePersist()
  }

  currentStroke.value = null
  activePointerId.value = null
  renderBoard()
}
</script>

<template>
  <div
    ref="containerRef"
    class="whiteboard-app"
    :class="{ compact: isCompact }"
  >
    <aside class="whiteboard-sidebar">
      <div class="sidebar-heading">
        <div>
          <p class="sidebar-kicker">
            {{ t('apps.whiteboard.boards') }}
          </p>
          <h2 class="sidebar-title">
            {{ t('apps.whiteboard.name') }}
          </h2>
        </div>
        <UButton
          icon="i-lucide-plus"
          size="sm"
          color="primary"
          variant="soft"
          :aria-label="t('apps.whiteboard.newBoard')"
          @click="createBoard"
        />
      </div>

      <div class="board-list">
        <button
          v-for="board in boards"
          :key="board.id"
          class="board-card"
          :class="{ active: board.id === activeBoardId }"
          @click="selectBoard(board.id)"
        >
          <span class="board-card-name">{{ board.name }}</span>
          <span class="board-card-meta">
            {{ board.strokes.length }} {{ t('apps.whiteboard.strokes') }} · {{ formatUpdatedAt(board.updatedAt) }}
          </span>
        </button>
      </div>

      <div class="sidebar-actions">
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          color="error"
          variant="ghost"
          :label="t('apps.whiteboard.deleteBoard')"
          @click="deleteBoard"
        />
        <UButton
          icon="i-lucide-eraser"
          size="sm"
          color="neutral"
          variant="ghost"
          :label="t('apps.whiteboard.clearBoard')"
          @click="clearBoard"
        />
      </div>
    </aside>

    <section class="whiteboard-main">
      <div class="whiteboard-toolbar">
        <div class="toolbar-group toolbar-tools">
          <UButton
            icon="i-lucide-pen-tool"
            size="sm"
            :variant="currentTool === 'pen' ? 'solid' : 'soft'"
            :color="currentTool === 'pen' ? 'primary' : 'neutral'"
            :label="t('apps.whiteboard.toolPen')"
            @click="currentTool = 'pen'"
          />
          <UButton
            icon="i-lucide-eraser"
            size="sm"
            :variant="currentTool === 'eraser' ? 'solid' : 'soft'"
            :color="currentTool === 'eraser' ? 'primary' : 'neutral'"
            :label="t('apps.whiteboard.toolEraser')"
            @click="currentTool = 'eraser'"
          />
        </div>

        <div class="toolbar-group toolbar-board-meta">
          <UInput
            v-model="boardName"
            :placeholder="t('apps.whiteboard.boardName')"
            class="board-name-input"
          />
          <USelect
            v-model="selectedBackground"
            :items="backgroundOptions"
            value-key="value"
            class="background-select"
          />
        </div>

        <div class="toolbar-group toolbar-history">
          <UButton
            icon="i-lucide-undo-2"
            size="sm"
            color="neutral"
            variant="soft"
            :label="t('apps.whiteboard.undo')"
            :disabled="!canUndo"
            @click="undoStroke"
          />
          <UButton
            icon="i-lucide-redo-2"
            size="sm"
            color="neutral"
            variant="soft"
            :label="t('apps.whiteboard.redo')"
            :disabled="!canRedo"
            @click="redoStroke"
          />
        </div>
      </div>

      <div class="whiteboard-subtoolbar">
        <div class="color-palette">
          <button
            v-for="color in PALETTE_COLORS"
            :key="color"
            class="color-swatch"
            :class="{ active: currentColor === color }"
            :style="{ backgroundColor: color }"
            :title="color"
            @click="currentColor = color"
          />
        </div>

        <div class="stroke-width-control">
          <span class="control-label">{{ t('apps.whiteboard.strokeWidth') }}</span>
          <USlider
            v-model="currentLineWidth"
            :min="MIN_STROKE_WIDTH"
            :max="MAX_STROKE_WIDTH"
            :step="1"
            class="stroke-width-slider"
          />
          <span class="stroke-width-value">{{ currentLineWidth }}px</span>
        </div>
      </div>

      <div class="whiteboard-canvas-shell">
        <div class="canvas-status-bar">
          <span>{{ t('apps.whiteboard.autosave') }}</span>
          <span>
            {{ activeBoard?.strokes.length ?? 0 }} {{ t('apps.whiteboard.strokes') }}
          </span>
        </div>

        <div
          ref="surfaceRef"
          class="canvas-surface"
          :class="boardSurfaceClass"
        >
          <canvas
            ref="canvasRef"
            class="whiteboard-canvas"
            @contextmenu.prevent
            @pointerdown="startDrawing"
            @pointermove="updateDrawing"
            @pointerup="finishDrawing"
            @pointercancel="finishDrawing"
          />
        </div>

        <div class="canvas-hint">
          {{ t('apps.whiteboard.hint') }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.whiteboard-app {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  height: 100%;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--ui-primary) 14%, transparent), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--ui-bg-muted) 70%, transparent), var(--ui-bg));
  overflow: hidden;
}

.whiteboard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-right: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg-elevated) 78%, transparent);
  backdrop-filter: blur(18px);
}

.sidebar-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-kicker {
  margin: 0 0 6px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-primary);
}

.sidebar-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ui-text-highlighted);
}

.board-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.board-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: color-mix(in srgb, var(--ui-bg) 88%, transparent);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
}

.board-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--ui-primary) 30%, var(--ui-border));
}

.board-card.active {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
  background: color-mix(in srgb, var(--ui-primary) 12%, var(--ui-bg));
}

.board-card-name {
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.board-card-meta {
  font-size: 0.78rem;
  color: var(--ui-text-muted);
}

.sidebar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.whiteboard-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 18px;
}

.whiteboard-toolbar,
.whiteboard-subtoolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.toolbar-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.toolbar-board-meta {
  flex: 1;
  min-width: min(100%, 320px);
}

.board-name-input {
  flex: 1;
  min-width: 220px;
}

.background-select {
  width: 180px;
}

.color-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border: 2px solid color-mix(in srgb, var(--ui-bg) 88%, transparent);
  border-radius: 999px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-border) 70%, transparent);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.color-swatch:hover,
.color-swatch.active {
  transform: scale(1.08);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-primary) 58%, transparent);
}

.stroke-width-control {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 260px;
}

.control-label,
.stroke-width-value {
  font-size: 0.85rem;
  color: var(--ui-text-muted);
}

.stroke-width-slider {
  flex: 1;
}

.whiteboard-canvas-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--ui-bg) 92%, transparent);
  box-shadow: 0 20px 40px color-mix(in srgb, black 8%, transparent);
}

.canvas-status-bar,
.canvas-hint {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--ui-text-muted);
}

.canvas-status-bar {
  margin-bottom: 12px;
}

.canvas-hint {
  margin-top: 12px;
}

.canvas-surface {
  position: relative;
  flex: 1;
  min-height: 260px;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--ui-border) 76%, transparent);
}

.canvas-surface.background-plain {
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.canvas-surface.background-grid {
  background-color: #f8fafc;
  background-image:
    linear-gradient(color-mix(in srgb, #cbd5e1 75%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, #cbd5e1 75%, transparent) 1px, transparent 1px);
  background-size: 32px 32px;
}

.canvas-surface.background-dots {
  background-color: #f8fafc;
  background-image: radial-gradient(color-mix(in srgb, #94a3b8 75%, transparent) 1.2px, transparent 1.2px);
  background-size: 26px 26px;
}

.whiteboard-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
}

.compact {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
}

.compact .whiteboard-sidebar {
  border-right: none;
  border-bottom: 1px solid var(--ui-border);
}

.compact .board-list {
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
}

.compact .board-card {
  min-width: 210px;
}

@media (max-width: 620px) {
  .whiteboard-main,
  .whiteboard-sidebar {
    padding: 14px;
  }

  .toolbar-board-meta,
  .board-name-input,
  .background-select,
  .stroke-width-control {
    min-width: 100%;
    width: 100%;
  }

  .canvas-status-bar,
  .canvas-hint {
    flex-direction: column;
  }
}
</style>
