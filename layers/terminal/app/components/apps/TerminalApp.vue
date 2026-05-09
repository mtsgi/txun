<script setup lang="ts">
defineProps<{ windowId: string }>()

const { notify } = useDesktopNotification()

interface HistoryEntry {
  input: string
  output: string
}

const inputLine = ref('')
const history = ref<HistoryEntry[]>([
  { input: '', output: 'TxunOS Terminal v0.1.0\nType `help` for available commands.\n' }
])
const inputRef = ref<HTMLInputElement | null>(null)
const outputRef = ref<HTMLDivElement | null>(null)
const historyIdx = ref(-1)
const inputHistory = ref<string[]>([])

const COMMANDS: Record<string, (args: string[]) => string> = {
  help: () => [
    'Available commands:',
    '  help          — show this help',
    '  echo <msg>    — print message',
    '  clear         — clear terminal',
    '  date          — show current date/time',
    '  whoami        — show current user',
    '  ls            — list virtual directory',
    '  notify <msg>  — send desktop notification'
  ].join('\n'),
  echo: args => args.join(' '),
  date: () => new Date().toString(),
  whoami: () => 'user@txunos',
  ls: () => 'Desktop/  Documents/  Downloads/',
  clear: () => '__CLEAR__',
  notify: (args) => {
    const msg = args.join(' ') || 'Hello from terminal!'
    notify(msg, { type: 'info', icon: 'i-lucide-terminal' })
    return `Notification sent: "${msg}"`
  }
}

function execute(cmd: string) {
  const trimmed = cmd.trim()
  if (!trimmed) return
  inputHistory.value.unshift(trimmed)
  historyIdx.value = -1

  const [name = '', ...args] = trimmed.split(/\s+/)
  const handler = COMMANDS[name ?? '']
  const output = handler ? handler(args) : `Command not found: ${name}`

  if (output === '__CLEAR__') {
    history.value = []
  } else {
    history.value.push({ input: `$ ${trimmed}`, output })
  }

  nextTick(() => {
    if (outputRef.value) outputRef.value.scrollTop = outputRef.value.scrollHeight
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    execute(inputLine.value)
    inputLine.value = ''
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const next = historyIdx.value + 1
    if (next < inputHistory.value.length) {
      historyIdx.value = next
      inputLine.value = inputHistory.value[next] ?? ''
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const prev = historyIdx.value - 1
    if (prev >= 0) {
      historyIdx.value = prev
      inputLine.value = inputHistory.value[prev] ?? ''
    } else {
      historyIdx.value = -1
      inputLine.value = ''
    }
  }
}

function focusInput() {
  inputRef.value?.focus()
}
</script>

<template>
  <div
    class="terminal-app"
    @click="focusInput"
  >
    <div
      ref="outputRef"
      class="output"
    >
      <div
        v-for="(entry, i) in history"
        :key="i"
        class="entry"
      >
        <div
          v-if="entry.input"
          class="cmd-label"
        >
          {{ entry.input }}
        </div>
        <pre class="cmd-output">{{ entry.output }}</pre>
      </div>
    </div>
    <div class="input-line">
      <span class="prompt">$</span>
      <input
        ref="inputRef"
        v-model="inputLine"
        class="cmd-input"
        autofocus
        autocomplete="off"
        spellcheck="false"
        @keydown="onKeydown"
      >
    </div>
  </div>
</template>

<style lang="scss" scoped>
.terminal-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  cursor: text;
  background-color: #0a0a0a;
  padding: 0.5rem;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 0.875rem;
  color: #4ade80;

  .output {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;

    .entry {
      & + .entry {
        margin-top: 0.25rem;
      }
    }

    .cmd-label {
      color: #86efac;
    }

    .cmd-output {
      white-space: pre-wrap;
      color: #d4d4d4;
      margin: 0;
      font-family: inherit;
    }
  }

  .input-line {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid #262626;
    flex-shrink: 0;

    .prompt {
      color: #86efac;
    }

    .cmd-input {
      flex: 1 1 0%;
      background: transparent;
      border: none;
      outline: none;
      color: inherit;
      font-family: inherit;
      font-size: inherit;
    }
  }
}
</style>
