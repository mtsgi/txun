<script setup lang="ts">
import { onMounted } from 'vue'

defineProps<{
  windowId: string
}>()

const { t } = useI18n()
const {
  difficulty,
  board,
  isGameOver,
  isGameClear,
  remainingMines,
  initGame,
  openCell,
  toggleFlag
} = useMinesweeper()

const difficultyOptions = [
  { label: t('apps.minesweeper.easy'), value: 'easy' },
  { label: t('apps.minesweeper.medium'), value: 'medium' },
  { label: t('apps.minesweeper.hard'), value: 'hard' }
]

const handleRightClick = (e: Event, x: number, y: number) => {
  e.preventDefault()
  toggleFlag(x, y)
}

const getCellAppearance = (cell: { isOpen: boolean, hasMine: boolean, isFlagged: boolean, adjacentMines: number }) => {
  if (!cell.isOpen) {
    if (cell.isFlagged) return { icon: 'i-lucide-flag', color: 'red', text: '' }
    return { icon: null, color: 'gray', text: '' }
  }

  if (cell.hasMine) return { icon: 'i-lucide-bomb', color: 'black', text: '' }

  const colors = [
    'transparent',
    'text-blue-500',
    'text-green-500',
    'text-red-500',
    'text-purple-500',
    'text-yellow-600',
    'text-cyan-500',
    'text-black',
    'text-gray-500'
  ]
  const colorClass = colors[cell.adjacentMines] || 'text-black'

  return {
    icon: null,
    colorClass,
    text: cell.adjacentMines > 0 ? cell.adjacentMines.toString() : ''
  }
}

onMounted(() => {
  initGame()
})
</script>

<template>
  <div class="flex flex-col h-full bg-gray-100 dark:bg-gray-900 select-none">
    <!-- Header -->
    <div class="flex items-center justify-between p-2 bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <USelectMenu
          v-model="difficulty"
          :options="difficultyOptions"
          value-key="value"
          label-key="label"
          class="w-32"
          @update:model-value="() => initGame()"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="solid"
          icon="i-lucide-rotate-ccw"
          @click="() => initGame()"
        >
          {{ t('apps.minesweeper.newGame') }}
        </UButton>
      </div>
      <div class="flex items-center justify-center bg-black text-red-500 font-mono text-xl px-2 py-1 rounded w-16 text-center leading-none">
        {{ String(Math.max(0, remainingMines)).padStart(3, '0') }}
      </div>
    </div>

    <!-- Message Area -->
    <div
      v-if="isGameOver || isGameClear"
      class="text-center py-2 text-lg font-bold"
      :class="isGameClear ? 'text-green-600' : 'text-red-600'"
    >
      {{ isGameClear ? t('apps.minesweeper.gameClear') : t('apps.minesweeper.gameOver') }}
    </div>

    <!-- Board -->
    <div class="flex-1 overflow-auto p-4 flex items-center justify-center">
      <div class="inline-block bg-gray-300 dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-600 p-1">
        <div
          v-for="(row, y) in board"
          :key="y"
          class="flex"
        >
          <div
            v-for="cell in row"
            :key="`${cell.x}-${cell.y}`"
            class="w-7 h-7 sm:w-8 sm:h-8 border flex items-center justify-center text-sm sm:text-base font-bold cursor-pointer"
            :class="[
              cell.isOpen
                ? 'bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-900'
                : 'bg-gray-300 dark:bg-gray-600 border-t-white border-l-white border-b-gray-500 border-r-gray-500 hover:bg-gray-400 dark:hover:bg-gray-500',
              { 'bg-red-200': cell.isOpen && cell.hasMine && !cell.isFlagged }
            ]"
            @click="openCell(cell.x, cell.y)"
            @contextmenu="handleRightClick($event, cell.x, cell.y)"
          >
            <!-- Content of cell -->
            <template v-if="cell.isOpen || cell.isFlagged">
              <template v-if="getCellAppearance(cell).icon">
                <UIcon
                  :name="getCellAppearance(cell).icon!"
                  class="w-4 h-4 sm:w-5 sm:h-5"
                  :class="getCellAppearance(cell).color === 'red' ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'"
                />
              </template>
              <span
                v-else-if="getCellAppearance(cell).text"
                :class="getCellAppearance(cell).colorClass"
              >
                {{ getCellAppearance(cell).text }}
              </span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
