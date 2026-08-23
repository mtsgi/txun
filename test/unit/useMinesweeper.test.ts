import { describe, it, expect } from 'vitest'
import { useMinesweeper } from '../../layers/minesweeper/app/composables/useMinesweeper'

describe('useMinesweeper', () => {
  it('should initialize with easy difficulty by default', () => {
    const { difficulty, board, isGameOver, isGameClear } = useMinesweeper()
    expect(difficulty.value).toBe('easy')
    expect(board.value).toEqual([])
    expect(isGameOver.value).toBe(false)
    expect(isGameClear.value).toBe(false)
  })

  describe('initGame', () => {
    it('should set up a 9x9 board with easy difficulty when not specified', () => {
      const { initGame, board, remainingMines } = useMinesweeper()
      initGame() // test the without newDifficulty branch
      expect(board.value.length).toBe(9)
      expect(board.value[0].length).toBe(9)
      expect(remainingMines.value).toBe(10)
    })

    it('should set up a 9x9 board with easy difficulty', () => {
      const { initGame, board, remainingMines } = useMinesweeper()
      initGame('easy')
      expect(board.value.length).toBe(9)
      expect(board.value[0].length).toBe(9)
      expect(remainingMines.value).toBe(10)
    })

    it('should set up a 16x16 board with medium difficulty', () => {
      const { initGame, board, remainingMines } = useMinesweeper()
      initGame('medium')
      expect(board.value.length).toBe(16)
      expect(board.value[0].length).toBe(16)
      expect(remainingMines.value).toBe(40)
    })

    it('should set up a 30x16 board with hard difficulty', () => {
      const { initGame, board, remainingMines } = useMinesweeper()
      initGame('hard')
      expect(board.value.length).toBe(16)
      expect(board.value[0].length).toBe(30)
      expect(remainingMines.value).toBe(99)
    })
  })

  describe('openCell and placeMines', () => {
    it('should place mines on the first click, avoiding the clicked area', () => {
      const { initGame, openCell, board } = useMinesweeper()
      initGame('easy')

      // First click at (4, 4)
      openCell(4, 4)

      let mineCount = 0
      for (const row of board.value) {
        for (const cell of row) {
          if (cell.hasMine) mineCount++

          if (Math.abs(cell.x - 4) <= 1 && Math.abs(cell.y - 4) <= 1) {
            expect(cell.hasMine).toBe(false)
          }
        }
      }

      expect(mineCount).toBe(10)
      expect(board.value[4][4].isOpen).toBe(true)
    })

    it('should return if cell is out of bounds or already open', () => {
      const { initGame, openCell, board } = useMinesweeper()
      initGame('easy')

      // out of bounds
      openCell(9, 9)
      openCell(-1, -1)

      openCell(0, 0)
      const isOpenInitially = board.value[0][0].isOpen

      // try opening again
      openCell(0, 0)
      expect(board.value[0][0].isOpen).toBe(isOpenInitially)
    })

    it('should not open if game is over or cleared', () => {
      const { initGame, openCell, board, isGameOver, isGameClear } = useMinesweeper()
      initGame('easy')

      isGameOver.value = true
      openCell(0, 0)
      expect(board.value[0][0].isOpen).toBe(false)

      isGameOver.value = false
      isGameClear.value = true
      openCell(0, 0)
      expect(board.value[0][0].isOpen).toBe(false)
    })

    it('should not open a flagged cell', () => {
      const { initGame, openCell, toggleFlag, board } = useMinesweeper()
      initGame('easy')
      toggleFlag(0, 0)
      openCell(0, 0)
      expect(board.value[0][0].isOpen).toBe(false)
    })

    it('should game over when opening a mine', () => {
      const { initGame, openCell, board, isGameOver } = useMinesweeper()
      initGame('easy')

      openCell(0, 0)

      let mineX = -1, mineY = -1
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (board.value[y][x].hasMine) {
            mineX = x
            mineY = y
            break
          }
        }
        if (mineX !== -1) break
      }

      openCell(mineX, mineY)
      expect(isGameOver.value).toBe(true)

      for (const row of board.value) {
        for (const cell of row) {
          if (cell.hasMine) {
            expect(cell.isOpen).toBe(true)
          }
        }
      }
    })

    it('should recursively open cells with 0 adjacent mines', () => {
      const { initGame, openCell, board } = useMinesweeper()
      initGame('easy')

      let randCalls = 0
      const originalRandom = Math.random
      Math.random = () => {
        const coords = [8, 8, 7, 8, 6, 8, 8, 7, 7, 7, 6, 7, 8, 6, 7, 6, 6, 6, 5, 8]
        const val = coords[randCalls % coords.length] / 9
        randCalls++
        return val
      }

      openCell(0, 0)

      Math.random = originalRandom

      expect(board.value[0][0].isOpen).toBe(true)
      expect(board.value[0][0].adjacentMines).toBe(0)
      expect(board.value[0][1].isOpen).toBe(true)
    })
  })

  describe('toggleFlag', () => {
    it('should toggle flag on closed cells', () => {
      const { initGame, toggleFlag, board, remainingMines } = useMinesweeper()
      initGame('easy')

      expect(remainingMines.value).toBe(10)
      expect(board.value[0][0].isFlagged).toBe(false)

      toggleFlag(0, 0)

      expect(board.value[0][0].isFlagged).toBe(true)
      expect(remainingMines.value).toBe(9)

      toggleFlag(0, 0)

      expect(board.value[0][0].isFlagged).toBe(false)
      expect(remainingMines.value).toBe(10)
    })

    it('should not toggle flag on open cells', () => {
      const { initGame, openCell, toggleFlag, board } = useMinesweeper()
      initGame('easy')

      openCell(0, 0)
      expect(board.value[0][0].isOpen).toBe(true)

      toggleFlag(0, 0)
      expect(board.value[0][0].isFlagged).toBe(false)
    })

    it('should not toggle flag if cell is out of bounds or game is over/cleared', () => {
      const { initGame, toggleFlag, board, isGameOver, isGameClear } = useMinesweeper()
      initGame('easy')

      // out of bounds
      toggleFlag(9, 9)

      isGameOver.value = true
      toggleFlag(0, 0)
      expect(board.value[0][0].isFlagged).toBe(false)

      isGameOver.value = false
      isGameClear.value = true
      toggleFlag(0, 0)
      expect(board.value[0][0].isFlagged).toBe(false)
    })
  })

  describe('checkGameClear', () => {
    it('should set isGameClear to true when all non-mine cells are opened', () => {
      const { initGame, board, isGameClear, openCell } = useMinesweeper()
      initGame('easy')

      openCell(0, 0)

      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          if (!board.value[y][x].hasMine && !board.value[y][x].isOpen) {
            openCell(x, y)
          }
        }
      }

      expect(isGameClear.value).toBe(true)
    })
  })
})
