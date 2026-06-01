import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

/**
 * マインスイーパの難易度を表す型です。
 */
export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * 盤面の各マスの状態を表すインターフェースです。
 */
export interface CellState {
  x: number
  y: number
  hasMine: boolean
  isOpen: boolean
  isFlagged: boolean
  adjacentMines: number
}

/**
 * useMinesweeper が返す状態と関数のインターフェースです。
 */
export interface MinesweeperState {
  difficulty: Ref<Difficulty>
  board: Ref<CellState[][]>
  isGameOver: Ref<boolean>
  isGameClear: Ref<boolean>
  remainingMines: ComputedRef<number>
  initGame: (newDifficulty?: Difficulty) => void
  openCell: (x: number, y: number) => void
  toggleFlag: (x: number, y: number) => void
}

const DIFFICULTIES: Record<Difficulty, { width: number, height: number, mines: number }> = {
  easy: { width: 9, height: 9, mines: 10 },
  medium: { width: 16, height: 16, mines: 40 },
  hard: { width: 30, height: 16, mines: 99 }
}

/**
 * マインスイーパのゲームロジックを提供します。
 */
export function useMinesweeper(): MinesweeperState {
  const difficulty = ref<Difficulty>('easy')
  const board = ref<CellState[][]>([])
  const isGameOver = ref(false)
  const isGameClear = ref(false)
  const isInitialized = ref(false)

  const currentSettings = computed(() => DIFFICULTIES[difficulty.value])
  const remainingMines = computed(() => {
    let flagged = 0
    for (const row of board.value) {
      for (const cell of row) {
        if (cell.isFlagged) flagged++
      }
    }
    return currentSettings.value.mines - flagged
  })

  /**
   * ゲームを初期化します（難易度の設定のみで地雷はまだ配置しません）。
   */
  const initGame = (newDifficulty?: Difficulty) => {
    if (newDifficulty) difficulty.value = newDifficulty
    const { width, height } = currentSettings.value

    board.value = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        x,
        y,
        hasMine: false,
        isOpen: false,
        isFlagged: false,
        adjacentMines: 0
      }))
    )
    isGameOver.value = false
    isGameClear.value = false
    isInitialized.value = false
  }

  /**
   * 初回クリック時に、クリックしたマスを避けて地雷を配置します。
   */
  const placeMines = (firstX: number, firstY: number) => {
    const { width, height, mines } = currentSettings.value
    let placed = 0

    while (placed < mines) {
      const rx = Math.floor(Math.random() * width)
      const ry = Math.floor(Math.random() * height)

      // 初回クリック位置の周囲3x3と、既に地雷がある場所には配置しない
      if (Math.abs(rx - firstX) <= 1 && Math.abs(ry - firstY) <= 1) continue

      if (!board.value[ry]?.[rx]?.hasMine) {
        board.value[ry]![rx]!.hasMine = true
        placed++
      }
    }

    // 各セルの隣接地雷数を計算
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const ny = y + dy
            const nx = x + dx
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              if (board.value[ny]?.[nx]?.hasMine) count++
            }
          }
        }
        board.value[y]![x]!.adjacentMines = count
      }
    }

    isInitialized.value = true
  }

  /**
   * マスを開きます。
   */
  const openCell = (x: number, y: number) => {
    const cell = board.value[y]?.[x]
    if (!cell || cell.isOpen || cell.isFlagged || isGameOver.value || isGameClear.value) return

    if (!isInitialized.value) {
      placeMines(x, y)
    }

    cell.isOpen = true

    if (cell.hasMine) {
      isGameOver.value = true
      revealAll()
      return
    }

    if (cell.adjacentMines === 0) {
      // 周囲のマスを再帰的に開く
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy
          const nx = x + dx
          if (ny >= 0 && ny < currentSettings.value.height && nx >= 0 && nx < currentSettings.value.width) {
            openCell(nx, ny)
          }
        }
      }
    }

    checkGameClear()
  }

  /**
   * マスにフラグを立てる、または外します。
   */
  const toggleFlag = (x: number, y: number) => {
    const cell = board.value[y]?.[x]
    if (!cell || cell.isOpen || isGameOver.value || isGameClear.value) return
    cell.isFlagged = !cell.isFlagged
  }

  /**
   * 全てのマスを開きます（ゲームオーバー時）。
   */
  const revealAll = () => {
    for (const row of board.value) {
      for (const cell of row) {
        if (cell.hasMine || cell.isFlagged) {
          cell.isOpen = true
        }
      }
    }
  }

  /**
   * ゲームクリアを判定します。
   */
  const checkGameClear = () => {
    const { width, height, mines } = currentSettings.value
    let closedCount = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!board.value[y]?.[x]?.isOpen) closedCount++
      }
    }
    if (closedCount === mines) {
      isGameClear.value = true
    }
  }

  return {
    difficulty,
    board,
    isGameOver,
    isGameClear,
    remainingMines,
    initGame,
    openCell,
    toggleFlag
  }
}
