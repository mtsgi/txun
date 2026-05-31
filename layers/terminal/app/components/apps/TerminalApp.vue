<script setup lang="ts">
import { DesktopFileSystemError } from '#layers/txunos-core/app/stores/filesystem'

defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()

interface HistoryEntry {
  input: string
  output: string
}

type CommandHandler = (args: string[]) => Promise<string>

const inputLine = ref('')
const history = ref<HistoryEntry[]>([
  { input: '', output: `${t('apps.terminal.welcome')}\n${t('apps.terminal.welcomeHint')}\n` }
])
const inputRef = ref<HTMLInputElement | null>(null)
const outputRef = ref<HTMLDivElement | null>(null)
const historyIdx = ref(-1)
const inputHistory = ref<string[]>([])
const addingMount = ref(false)
const cwdByMount = ref<Record<string, string>>({})

const mountOptions = computed(() =>
  fileSystem.mounts.value.map(mount => ({
    label: mount.name,
    value: mount.id
  }))
)

const selectedMountId = computed({
  get: (): string => fileSystem.activeMountId.value ?? '',
  set: (mountId: string) => {
    void fileSystem.setActiveMount(mountId || null)
  }
})

function getCwd(mountId: string): string {
  return cwdByMount.value[mountId] ?? '/'
}

function setCwd(mountId: string, path: string): void {
  const normalized = fileSystem.resolvePath('/', path)
  cwdByMount.value = {
    ...cwdByMount.value,
    [mountId]: normalized
  }
}

function ensureCwdForActiveMount(): void {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) return
  if (!cwdByMount.value[mountId]) {
    setCwd(mountId, '/')
  }
}

function requireMountId(): string {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) {
    throw new DesktopFileSystemError('NO_MOUNT', t('apps.terminal.error.noMount'))
  }
  ensureCwdForActiveMount()
  return mountId
}

function resolveTargetPath(mountId: string, rawPath?: string): string {
  const cwd = getCwd(mountId)
  return fileSystem.resolvePath(cwd, rawPath ?? '.')
}

function formatFsError(error: unknown): string {
  if (error instanceof DesktopFileSystemError) {
    if (error.code === 'UNSUPPORTED') return t('apps.terminal.error.unsupported')
    if (error.code === 'NO_MOUNT') return t('apps.terminal.error.noMount')
    if (error.code === 'NOT_FOUND') return t('apps.terminal.error.notFound', { path: error.path ?? '' })
    if (error.code === 'NOT_DIRECTORY') return t('apps.terminal.error.notDirectory', { path: error.path ?? '' })
    if (error.code === 'NOT_FILE') return t('apps.terminal.error.notFile', { path: error.path ?? '' })
    if (error.code === 'PERMISSION_DENIED') return t('apps.terminal.error.permissionDenied')
    if (error.code === 'INVALID_PATH') return t('apps.terminal.error.invalidPath')
    return error.message
  }
  if (error instanceof Error) return error.message
  return t('apps.terminal.error.general')
}

async function handleAddMount(): Promise<void> {
  addingMount.value = true
  try {
    const mount = await fileSystem.addMount()
    if (mount) {
      ensureCwdForActiveMount()
      notify(t('apps.terminal.mountAdded', { name: mount.name }), { type: 'success' })
    }
  } catch (error) {
    notify(formatFsError(error), { type: 'error' })
  } finally {
    addingMount.value = false
  }
}

const promptLabel = computed(() => {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) return '$'
  return `${getCwd(mountId)} $`
})

const mountLabel = computed(() => {
  const active = fileSystem.activeMount.value
  if (!active) return t('apps.terminal.noMount')
  return `${active.name}:${getCwd(active.id)}`
})

const commands = computed<Record<string, CommandHandler>>(() => ({
  help: async () => [
    t('apps.terminal.help.title'),
    `  help          — ${t('apps.terminal.help.help')}`,
    `  echo <msg>    — ${t('apps.terminal.help.echo')}`,
    `  clear         — ${t('apps.terminal.help.clear')}`,
    `  date          — ${t('apps.terminal.help.date')}`,
    `  whoami        — ${t('apps.terminal.help.whoami')}`,
    `  pwd           — ${t('apps.terminal.help.pwd')}`,
    `  ls [path]     — ${t('apps.terminal.help.ls')}`,
    `  cd <path>     — ${t('apps.terminal.help.cd')}`,
    `  cat <path>    — ${t('apps.terminal.help.cat')}`,
    `  mkdir <path>  — ${t('apps.terminal.help.mkdir')}`,
    `  touch <path>  — ${t('apps.terminal.help.touch')}`,
    `  rm <path>     — ${t('apps.terminal.help.rm')}`,
    `  mv <a> <b>    — ${t('apps.terminal.help.mv')}`,
    `  cp <a> <b>    — ${t('apps.terminal.help.cp')}`,
    `  mounts        — ${t('apps.terminal.help.mounts')}`,
    `  use <mount>   — ${t('apps.terminal.help.use')}`,
    `  notify <msg>  — ${t('apps.terminal.help.notify')}`
  ].join('\n'),
  echo: async args => args.join(' '),
  date: async () => new Date().toString(),
  whoami: async () => 'user@txunos',
  pwd: async () => {
    const mountId = requireMountId()
    return getCwd(mountId)
  },
  mounts: async () => {
    if (fileSystem.mounts.value.length === 0) {
      return t('apps.terminal.noMount')
    }
    return fileSystem.mounts.value
      .map(mount => `${fileSystem.activeMountId.value === mount.id ? '* ' : '  '}${mount.name} (${mount.id})`)
      .join('\n')
  },
  use: async (args) => {
    const query = args.join(' ').trim()
    if (!query) return t('apps.terminal.usage.use')
    const mount = fileSystem.mounts.value.find(item => item.id === query || item.name === query)
    if (!mount) return t('apps.terminal.mountNotFound', { target: query })
    await fileSystem.setActiveMount(mount.id)
    ensureCwdForActiveMount()
    return t('apps.terminal.mountChanged', { name: mount.name })
  },
  ls: async (args) => {
    const mountId = requireMountId()
    const target = resolveTargetPath(mountId, args[0])
    const list = await fileSystem.listDirectory(target, mountId)
    if (list.length === 0) return t('apps.terminal.emptyDirectory')
    return list.map(entry => (entry.kind === 'directory' ? `${entry.name}/` : entry.name)).join('  ')
  },
  cd: async (args) => {
    const mountId = requireMountId()
    const target = resolveTargetPath(mountId, args[0] ?? '/')
    await fileSystem.listDirectory(target, mountId)
    setCwd(mountId, target)
    return ''
  },
  cat: async (args) => {
    if (!args[0]) return t('apps.terminal.usage.cat')
    const mountId = requireMountId()
    const target = resolveTargetPath(mountId, args[0])
    return await fileSystem.readTextFile(target, mountId)
  },
  mkdir: async (args) => {
    if (!args[0]) return t('apps.terminal.usage.mkdir')
    const mountId = requireMountId()
    const target = resolveTargetPath(mountId, args[0])
    await fileSystem.mkdir(target, mountId, true)
    return t('apps.terminal.result.mkdir', { path: target })
  },
  touch: async (args) => {
    if (!args[0]) return t('apps.terminal.usage.touch')
    const mountId = requireMountId()
    const target = resolveTargetPath(mountId, args[0])
    await fileSystem.touch(target, mountId)
    return t('apps.terminal.result.touch', { path: target })
  },
  rm: async (args) => {
    if (!args[0]) return t('apps.terminal.usage.rm')
    const mountId = requireMountId()
    const target = resolveTargetPath(mountId, args[0])
    await fileSystem.deleteEntry(target, mountId, true)
    return t('apps.terminal.result.rm', { path: target })
  },
  mv: async (args) => {
    if (args.length < 2) return t('apps.terminal.usage.mv')
    const mountId = requireMountId()
    const fromPath = resolveTargetPath(mountId, args[0])
    const toPath = resolveTargetPath(mountId, args[1])
    await fileSystem.move(fromPath, toPath, mountId)
    return t('apps.terminal.result.mv', { from: fromPath, to: toPath })
  },
  cp: async (args) => {
    if (args.length < 2) return t('apps.terminal.usage.cp')
    const mountId = requireMountId()
    const fromPath = resolveTargetPath(mountId, args[0])
    const toPath = resolveTargetPath(mountId, args[1])
    await fileSystem.copy(fromPath, toPath, mountId)
    return t('apps.terminal.result.cp', { from: fromPath, to: toPath })
  },
  clear: async () => '__CLEAR__',
  notify: async (args) => {
    const msg = args.join(' ') || t('apps.terminal.notificationDefault')
    notify(msg, { type: 'info', icon: 'i-lucide-terminal' })
    return t('apps.terminal.notificationSent', { msg })
  }
}))

async function execute(cmd: string): Promise<void> {
  const trimmed = cmd.trim()
  if (!trimmed) return
  inputHistory.value.unshift(trimmed)
  historyIdx.value = -1

  const [name = '', ...args] = trimmed.split(/\s+/)
  const handler = commands.value[name ?? '']
  let output: string

  if (!handler) {
    output = t('apps.terminal.commandNotFound', { name })
  } else {
    try {
      output = await handler(args)
    } catch (error) {
      output = formatFsError(error)
    }
  }

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
    void execute(inputLine.value)
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

watch(() => fileSystem.activeMountId.value, () => {
  ensureCwdForActiveMount()
})

onMounted(async () => {
  await fileSystem.restoreMounts()
  ensureCwdForActiveMount()
})
</script>

<template>
  <div
    class="terminal-app"
    @click="focusInput"
  >
    <div class="topbar">
      <USelect
        v-model="selectedMountId"
        :items="mountOptions"
        value-key="value"
        class="mount-select"
        :placeholder="$t('apps.terminal.mount')"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="primary"
        icon="i-lucide-folder-plus"
        :label="$t('apps.terminal.addMount')"
        :loading="addingMount"
        @click.stop="handleAddMount"
      />
      <span class="mount-label">{{ mountLabel }}</span>
    </div>
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
      <span class="prompt">{{ promptLabel }}</span>
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

  .topbar {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #262626;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;

    .mount-select {
      min-width: 12rem;
      max-width: 16rem;
    }

    .mount-label {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-left: auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 16rem;
    }
  }

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
      white-space: nowrap;
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
