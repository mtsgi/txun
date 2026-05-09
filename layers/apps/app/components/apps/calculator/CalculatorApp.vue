<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()

/** 現在の表示値 */
const display = ref('0')
/** 前回の入力値 */
const prev = ref<number | null>(null)
/** 保留中の演算子 */
const pendingOperator = ref<string | null>(null)
/** 次の入力で表示をクリアするか */
const waitingForOperand = ref(false)

/** コンテナ幅によるレスポンシブ判定 */
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(320)

onMounted(() => {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) containerWidth.value = entry.contentRect.width
  })
  ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})

/** 幅が 360px 未満をコンパクトモードと判定 */
const isCompact = computed(() => containerWidth.value < 360)

/** 数字または小数点を入力する */
function inputDigit(digit: string): void {
  if (waitingForOperand.value) {
    display.value = digit === '.' ? '0.' : digit
    waitingForOperand.value = false
    return
  }
  if (digit === '.') {
    if (!display.value.includes('.')) display.value += '.'
    return
  }
  display.value = display.value === '0' ? digit : display.value + digit
}

/** 演算子を設定する */
function inputOperator(op: string): void {
  const current = parseFloat(display.value)
  if (prev.value !== null && !waitingForOperand.value) {
    const result = calculate(prev.value, current, pendingOperator.value!)
    display.value = formatResult(result)
    prev.value = result
  } else {
    prev.value = current
  }
  pendingOperator.value = op
  waitingForOperand.value = true
}

/** 計算を実行する */
function calculate(a: number, b: number, op: string): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '×': return a * b
    case '÷': return b !== 0 ? a / b : 0
    default: return b
  }
}

/** 結果を文字列にフォーマットする */
function formatResult(n: number): string {
  const str = String(parseFloat(n.toPrecision(12)))
  return str.length > 14 ? n.toExponential(6) : str
}

/** イコールを押したときの処理 */
function handleEquals(): void {
  if (prev.value === null || pendingOperator.value === null) return
  const current = parseFloat(display.value)
  const result = calculate(prev.value, current, pendingOperator.value)
  display.value = formatResult(result)
  prev.value = null
  pendingOperator.value = null
  waitingForOperand.value = true
}

/** パーセント変換 */
function handlePercent(): void {
  display.value = formatResult(parseFloat(display.value) / 100)
}

/** 符号反転 */
function handleToggleSign(): void {
  display.value = formatResult(parseFloat(display.value) * -1)
}

/** すべてクリア */
function handleClear(): void {
  display.value = '0'
  prev.value = null
  pendingOperator.value = null
  waitingForOperand.value = false
}

/** 最後の文字を削除 */
function handleBackspace(): void {
  if (waitingForOperand.value) return
  display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0'
}

/** ボタン定義 */
const buttons = [
  [
    { label: 'AC', action: () => handleClear(), variant: 'soft' as const, color: 'neutral' as const },
    { label: '+/-', action: () => handleToggleSign(), variant: 'soft' as const, color: 'neutral' as const },
    { label: '%', action: () => handlePercent(), variant: 'soft' as const, color: 'neutral' as const },
    { label: '÷', action: () => inputOperator('÷'), variant: 'solid' as const, color: 'primary' as const }
  ],
  [
    { label: '7', action: () => inputDigit('7'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '8', action: () => inputDigit('8'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '9', action: () => inputDigit('9'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '×', action: () => inputOperator('×'), variant: 'solid' as const, color: 'primary' as const }
  ],
  [
    { label: '4', action: () => inputDigit('4'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '5', action: () => inputDigit('5'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '6', action: () => inputDigit('6'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '-', action: () => inputOperator('-'), variant: 'solid' as const, color: 'primary' as const }
  ],
  [
    { label: '1', action: () => inputDigit('1'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '2', action: () => inputDigit('2'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '3', action: () => inputDigit('3'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '+', action: () => inputOperator('+'), variant: 'solid' as const, color: 'primary' as const }
  ],
  [
    { label: '⌫', action: () => handleBackspace(), variant: 'soft' as const, color: 'neutral' as const },
    { label: '0', action: () => inputDigit('0'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '.', action: () => inputDigit('.'), variant: 'soft' as const, color: 'neutral' as const },
    { label: '=', action: () => handleEquals(), variant: 'solid' as const, color: 'success' as const }
  ]
]
</script>

<template>
  <div
    ref="containerRef"
    class="calculator-app"
    :class="{ compact: isCompact }"
  >
    <div class="display-area">
      <div class="display-operator">
        {{ pendingOperator ?? '' }}
      </div>
      <div
        class="display-value"
        :title="display"
      >
        {{ display }}
      </div>
    </div>
    <div class="button-grid">
      <template
        v-for="(row, ri) in buttons"
        :key="ri"
      >
        <UButton
          v-for="btn in row"
          :key="btn.label"
          :label="btn.label"
          :variant="btn.variant"
          :color="btn.color"
          class="calc-btn"
          @click="btn.action()"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.calculator-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  user-select: none;
}

.display-area {
  padding: 16px 20px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  border-bottom: 1px solid var(--ui-border);
}

.display-operator {
  font-size: 1rem;
  color: var(--ui-text-muted);
  min-height: 1.25rem;
}

.display-value {
  font-size: 2.5rem;
  font-weight: 300;
  color: var(--ui-text-highlighted);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact .display-value {
  font-size: 2rem;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  flex: 1;
}

.calc-btn {
  width: 100%;
  height: 100%;
  min-height: 48px;
  font-size: 1.1rem;
  justify-content: center;
}

.compact .calc-btn {
  min-height: 40px;
  font-size: 1rem;
}
</style>
