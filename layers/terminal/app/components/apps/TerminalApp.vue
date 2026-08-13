<script setup lang="ts">
import { DesktopFileSystemError, type FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'

const props = defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()
const { openApp, closeWindow } = useWindowManager()
const desktopStore = useDesktopStore()

interface HistoryEntry {
  id: string
  input: string
  output: string
  duration?: number
  success?: boolean
  cwd?: string
  collapsed?: boolean
}

type CommandHandler = (args: string[]) => Promise<string>

const inputLine = ref('')
const history = ref<HistoryEntry[]>([
  {
    id: 'welcome',
    input: '',
    output: `${t('apps.terminal.welcome')}\n${t('apps.terminal.welcomeHint')}\n`,
    duration: 0,
    success: true,
    cwd: '',
    collapsed: false
  }
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
    `  notify <msg>  — ${t('apps.terminal.help.notify')}`,
    `  exit          — ${t('apps.terminal.help.exit')}`,
    `  open <appId>  — ${t('apps.terminal.help.open')}`,
    `  kill <id>     — ${t('apps.terminal.help.kill')}`,
    `  apps          — ${t('apps.terminal.help.apps')}`
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
  },
  exit: async () => {
    closeWindow(props.windowId)
    return ''
  },
  apps: async () => {
    const activeWindows = desktopStore.windows
    if (activeWindows.length === 0) {
      return t('apps.terminal.error.noActiveWindows')
    }
    return activeWindows.map((w) => {
      const isFocused = desktopStore.focusedWindowId === w.id
      const focusText = isFocused ? ' [Focused]' : ''
      const minText = w.isMinimized ? ' [Minimized]' : ''
      return `* ${w.id} (${w.appId}) — "${w.title}"${focusText}${minText}`
    }).join('\n')
  },
  open: async (args) => {
    const appId = args[0]
    if (!appId) {
      return t('apps.terminal.usage.open')
    }
    const app = desktopStore.apps.find(a => a.id === appId)
    if (!app) {
      return t('apps.terminal.error.appNotFound', { id: appId })
    }
    const filePath = args[1]
    const windowOptions = filePath ? { args: { path: filePath } } : undefined
    const winId = desktopStore.openWindow(app, windowOptions)
    return winId ? t('apps.terminal.result.open', { name: app.name }) : t('apps.terminal.error.openFailed')
  },
  kill: async (args) => {
    const target = args[0]
    if (!target) {
      return t('apps.terminal.usage.kill')
    }
    const exists = desktopStore.windows.some(w => w.id === target)
    if (exists) {
      desktopStore.closeWindow(target)
      return t('apps.terminal.result.kill', { target })
    }
    const matchedWindows = desktopStore.windows.filter(w => w.appId === target)
    if (matchedWindows.length > 0) {
      matchedWindows.forEach(w => desktopStore.closeWindow(w.id))
      return t('apps.terminal.result.killAll', { target })
    }
    return t('apps.terminal.error.targetNotFound', { target })
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
  let success = true
  const startTime = Date.now()

  if (!handler) {
    output = t('apps.terminal.commandNotFound', { name })
    success = false
  } else {
    try {
      output = await handler(args)
    } catch (error) {
      output = formatFsError(error)
      success = false
    }
  }

  const duration = Date.now() - startTime

  if (output === '__CLEAR__') {
    history.value = []
  } else {
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const activeMountId = fileSystem.activeMountId.value
    const currentCwd = activeMountId ? getCwd(activeMountId) : ''
    history.value.push({
      id: entryId,
      input: trimmed,
      output,
      duration,
      success,
      cwd: currentCwd,
      collapsed: false
    })
  }

  nextTick(() => {
    if (outputRef.value) {
      outputRef.value.scrollTop = outputRef.value.scrollHeight
    }
  })
}

const pathSuggestions = ref<{ name: string, description: string, syntax: string }[]>([])
let lastSuggestionsInput = ''

watch(inputLine, async (newVal) => {
  const trimmed = newVal.trim()
  if (!trimmed) {
    pathSuggestions.value = []
    return
  }
  const parts = trimmed.split(/\s+/)
  const cmdName = parts[0]?.toLowerCase()
  if (!cmdName) {
    pathSuggestions.value = []
    return
  }

  const pathCommands = ['cd', 'cat', 'ls', 'rm', 'mv', 'cp', 'touch', 'mkdir']
  if (!pathCommands.includes(cmdName)) {
    pathSuggestions.value = []
    return
  }

  let argQueryIndex = 1
  if ((cmdName === 'mv' || cmdName === 'cp') && parts.length > 2) {
    argQueryIndex = 2
  }

  const queryPath = parts[argQueryIndex] ?? ''
  if (parts.length <= argQueryIndex && !newVal.endsWith(' ')) {
    pathSuggestions.value = []
    return
  }

  const currentInput = newVal
  lastSuggestionsInput = currentInput

  try {
    const mountId = fileSystem.activeMountId.value
    if (!mountId) {
      pathSuggestions.value = []
      return
    }

    let parentPath = ''
    let prefix = queryPath
    const lastSlashIdx = queryPath.lastIndexOf('/')
    if (lastSlashIdx !== -1) {
      parentPath = queryPath.slice(0, lastSlashIdx)
      prefix = queryPath.slice(lastSlashIdx + 1)
      if (lastSlashIdx === 0) {
        parentPath = '/'
      }
    } else {
      parentPath = '.'
    }

    const resolvedParent = resolveTargetPath(mountId, parentPath)
    const entries = await fileSystem.listDirectory(resolvedParent, mountId)

    if (lastSuggestionsInput !== currentInput) return

    const prefixLower = prefix.toLowerCase()
    const matches = entries.filter((entry: FileSystemEntry) => entry.name.toLowerCase().startsWith(prefixLower))

    const filteredMatches = matches.filter((entry: FileSystemEntry) => {
      if (cmdName === 'cd' || cmdName === 'mkdir') {
        return entry.kind === 'directory'
      }
      return true
    })

    pathSuggestions.value = filteredMatches.map((entry: FileSystemEntry) => {
      const suggestPath = parentPath === '.' ? entry.name : (parentPath.endsWith('/') ? `${parentPath}${entry.name}` : `${parentPath}/${entry.name}`)
      let nameStr = ''
      if (cmdName === 'mv' || cmdName === 'cp') {
        if (argQueryIndex === 2) {
          nameStr = `${cmdName} ${parts[1]} ${suggestPath}`
        } else {
          nameStr = `${cmdName} ${suggestPath}`
        }
      } else {
        nameStr = `${cmdName} ${suggestPath}`
      }

      const icon = entry.kind === 'directory' ? '📁' : '📄'
      return {
        name: nameStr,
        description: `${icon} ${entry.name} (${entry.kind === 'directory' ? 'directory' : 'file'})`,
        syntax: nameStr
      }
    })
  } catch {
    if (lastSuggestionsInput === currentInput) {
      pathSuggestions.value = []
    }
  }
})

const suggestions = computed(() => {
  const rawInput = inputLine.value
  const trimmed = rawInput.trim()
  if (!trimmed && !rawInput.endsWith(' ')) return []

  const parts = trimmed.split(/\s+/)
  const cmdName = parts[0]?.toLowerCase() ?? ''

  // If we are typing the command itself
  if (parts.length === 1 && !rawInput.endsWith(' ')) {
    return Object.keys(commands.value)
      .filter(name => name.startsWith(cmdName))
      .map(name => ({
        name,
        description: t(`apps.terminal.help.${name}`),
        syntax: getCommandSyntax(name)
      }))
  }

  // Argument suggestions for 'open'
  if (cmdName === 'open') {
    const argQuery = parts[1]?.toLowerCase() ?? ''
    const availableApps = desktopStore.apps.map(a => a.id)
    return availableApps
      .filter(appId => appId.startsWith(argQuery))
      .map((appId) => {
        const appMeta = desktopStore.apps.find(a => a.id === appId)
        const appName = appMeta ? t(appMeta.nameKey) || appMeta.name : appId
        return {
          name: `open ${appId}`,
          description: `${t('apps.terminal.help.open')} — ${appName}`,
          syntax: `open ${appId} [filePath]`
        }
      })
  }

  // Argument suggestions for 'kill'
  if (cmdName === 'kill') {
    const argQuery = parts[1]?.toLowerCase() ?? ''
    const currentWindows = desktopStore.windows.map(w => ({
      id: w.id,
      title: w.title,
      appId: w.appId
    }))

    const matchedById = currentWindows.filter(w => w.id.toLowerCase().startsWith(argQuery))
    const matchedByAppId = currentWindows.filter(w => w.appId.toLowerCase().startsWith(argQuery) && !w.id.toLowerCase().startsWith(argQuery))

    const combined = [...matchedById, ...matchedByAppId]
    return combined.map(w => ({
      name: `kill ${w.id}`,
      description: `${t('apps.terminal.help.kill')} — ${w.title} (${w.appId})`,
      syntax: `kill ${w.id}`
    }))
  }

  // Argument suggestions for 'use'
  if (cmdName === 'use') {
    const argQuery = parts[1]?.toLowerCase() ?? ''
    return fileSystem.mounts.value
      .filter(m => m.id.toLowerCase().startsWith(argQuery) || m.name.toLowerCase().startsWith(argQuery))
      .map(m => ({
        name: `use ${m.id}`,
        description: `${t('apps.terminal.help.use')} — ${m.name}`,
        syntax: `use ${m.id}`
      }))
  }

  return pathSuggestions.value
})

function getCommandSyntax(name: string): string {
  const syntaxes: Record<string, string> = {
    help: 'help',
    echo: 'echo <msg>',
    clear: 'clear',
    date: 'date',
    whoami: 'whoami',
    pwd: 'pwd',
    ls: 'ls [path]',
    cd: 'cd <path>',
    cat: 'cat <path>',
    mkdir: 'mkdir <path>',
    touch: 'touch <path>',
    rm: 'rm <path>',
    mv: 'mv <a> <b>',
    cp: 'cp <a> <b>',
    mounts: 'mounts',
    use: 'use <mount>',
    notify: 'notify <msg>',
    exit: 'exit',
    open: 'open [appId] [filePath]',
    kill: 'kill [windowId | appId]',
    apps: 'apps'
  }
  return syntaxes[name] ?? name
}

const activeSuggestionIdx = ref(0)
const hasNavigatedSuggestions = ref(false)

watch(suggestions, () => {
  activeSuggestionIdx.value = 0
  hasNavigatedSuggestions.value = false
})

function selectSuggestion(name: string) {
  inputLine.value = name + ' '
  focusInput()
}

function onKeydown(e: KeyboardEvent) {
  if (suggestions.value.length > 0) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeSuggestionIdx.value = (activeSuggestionIdx.value - 1 + suggestions.value.length) % suggestions.value.length
      hasNavigatedSuggestions.value = true
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeSuggestionIdx.value = (activeSuggestionIdx.value + 1) % suggestions.value.length
      hasNavigatedSuggestions.value = true
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const selected = suggestions.value[activeSuggestionIdx.value]
      if (selected) {
        inputLine.value = selected.name + ' '
      }
      return
    }
    if (e.key === 'Enter' && hasNavigatedSuggestions.value) {
      e.preventDefault()
      const selected = suggestions.value[activeSuggestionIdx.value]
      if (selected) {
        inputLine.value = selected.name + ' '
        hasNavigatedSuggestions.value = false
      }
      return
    }
  }

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

function getMenuItems(entry: HistoryEntry) {
  const items = []

  const copyGroup = []
  if (entry.input) {
    copyGroup.push({
      label: t('apps.terminal.contextMenu.copyCommand'),
      icon: 'i-lucide-copy',
      onSelect: () => {
        navigator.clipboard.writeText(entry.input).then(() => {
          notify(t('apps.terminal.contextMenu.copyCommand') + ' successful', { type: 'success' })
        })
      }
    })
  }
  if (entry.output) {
    copyGroup.push({
      label: t('apps.terminal.contextMenu.copyOutput'),
      icon: 'i-lucide-file-text',
      onSelect: () => {
        navigator.clipboard.writeText(entry.output).then(() => {
          notify(t('apps.terminal.contextMenu.copyOutput') + ' successful', { type: 'success' })
        })
      }
    })
  }
  if (copyGroup.length > 0) items.push(copyGroup)

  const actionGroup = []
  if (entry.input) {
    actionGroup.push({
      label: t('apps.terminal.contextMenu.rerun'),
      icon: 'i-lucide-play',
      onSelect: () => {
        void execute(entry.input)
      }
    })
  }
  if (entry.output) {
    actionGroup.push({
      label: t('apps.terminal.contextMenu.openInEditor'),
      icon: 'i-lucide-external-link',
      onSelect: () => {
        void openOutputInEditor(entry)
      }
    })
  }
  if (actionGroup.length > 0) items.push(actionGroup)

  items.push([
    {
      label: t('apps.terminal.contextMenu.delete'),
      icon: 'i-lucide-trash',
      onSelect: () => {
        history.value = history.value.filter(item => item.id !== entry.id)
      }
    }
  ])

  return items
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`
}

async function openOutputInEditor(entry: HistoryEntry): Promise<void> {
  const mountId = fileSystem.activeMountId.value
  if (!mountId) {
    notify(t('apps.terminal.error.noMount'), { type: 'error' })
    return
  }
  const filename = `/terminal_output_${formatDate(new Date())}.txt`
  try {
    await fileSystem.writeTextFile(filename, entry.output, mountId)
    notify(t('apps.terminal.savedTo', { path: filename }), { type: 'success' })
    openApp('text-editor', { args: { path: filename } })
  } catch (error) {
    notify(formatFsError(error), { type: 'error' })
  }
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
      class="chat-output"
    >
      <div
        v-for="entry in history"
        :key="entry.id"
        class="message-group"
      >
        <div
          v-if="entry.input"
          class="message-row user"
        >
          <UContextMenu :items="getMenuItems(entry)">
            <div class="bubble user-bubble">
              <div
                v-if="entry.cwd"
                class="bubble-header"
              >
                <span class="cwd-label">{{ entry.cwd }}</span>
              </div>
              <div class="bubble-content">
                <pre class="cmd-text">{{ entry.input }}</pre>
              </div>
            </div>
          </UContextMenu>
        </div>

        <div class="message-row system">
          <UContextMenu :items="getMenuItems(entry)">
            <div
              class="bubble system-bubble"
              :class="{ 'error-bubble': entry.success === false }"
            >
              <div class="bubble-header">
                <span
                  class="status-indicator"
                  :class="{ success: entry.success !== false, error: entry.success === false }"
                />
                <span
                  v-if="entry.duration !== undefined"
                  class="duration"
                >{{ $t('apps.terminal.duration', { ms: entry.duration }) }}</span>
              </div>
              <div class="bubble-content">
                <template v-if="entry.collapsed">
                  <div class="collapsed-placeholder">
                    <UButton
                      size="xs"
                      variant="subtle"
                      color="neutral"
                      icon="i-lucide-chevron-down"
                      @click="() => { entry.collapsed = false }"
                    >
                      {{ $t('apps.terminal.showMore', { lines: entry.output.split('\n').length }) }}
                    </UButton>
                  </div>
                </template>
                <template v-else>
                  <pre class="output-text">{{ entry.output }}</pre>
                  <div
                    v-if="entry.output.split('\n').length > 5"
                    class="collapse-trigger"
                  >
                    <UButton
                      size="xs"
                      variant="link"
                      color="neutral"
                      icon="i-lucide-chevron-up"
                      @click="() => { entry.collapsed = true }"
                    >
                      {{ $t('apps.terminal.showLess') }}
                    </UButton>
                  </div>
                </template>
              </div>
            </div>
          </UContextMenu>
        </div>
      </div>
    </div>

    <div class="input-area">
      <transition name="popover-slide">
        <div
          v-if="suggestions.length > 0"
          class="suggestions-popover"
        >
          <div class="suggestions-header">
            <span class="title">Suggestions</span>
            <span class="tip">Tab ↹ to insert, Enter ↵ to run</span>
          </div>
          <ul class="suggestions-list">
            <li
              v-for="(sug, idx) in suggestions"
              :key="sug.name"
              class="suggestion-item"
              :class="{ active: hasNavigatedSuggestions && idx === activeSuggestionIdx }"
              @click="selectSuggestion(sug.name)"
            >
              <div class="sug-info">
                <span class="sug-name">{{ sug.name }}</span>
                <span class="sug-syntax">{{ sug.syntax }}</span>
              </div>
              <span class="sug-desc">{{ sug.description }}</span>
            </li>
          </ul>
        </div>
      </transition>

      <div class="input-line">
        <span class="prompt">{{ promptLabel }}</span>
        <input
          ref="inputRef"
          v-model="inputLine"
          class="cmd-input"
          :placeholder="$t('apps.terminal.placeholder')"
          autofocus
          autocomplete="off"
          spellcheck="false"
          @keydown="onKeydown"
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.terminal-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  cursor: text;
  background: color-mix(in srgb, var(--ui-bg) var(--desktop-bg-opacity, 90%), transparent);
  backdrop-filter: blur(var(--desktop-blur, 12px));
  color: var(--ui-text);
  padding: 0.75rem;
  font-size: 0.875rem;

  .topbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--ui-border);
    margin-bottom: 0.75rem;
    flex-wrap: wrap;

    .mount-select {
      min-width: 12rem;
      max-width: 16rem;
    }

    .mount-label {
      font-size: 0.75rem;
      color: var(--ui-text-muted);
      margin-left: auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 16rem;
    }
  }

  .chat-output {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-right: 0.5rem;

    .message-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      animation: fadeIn 0.3s ease-out;
    }

    .message-row {
      display: flex;
      width: 100%;

      &.user {
        justify-content: flex-end;
      }

      &.system {
        justify-content: flex-start;
      }
    }

    .bubble {
      max-width: 85%;
      border-radius: var(--ui-radius);
      padding: 0.75rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      border: 1px solid var(--ui-border);

      .bubble-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--ui-text-muted);
        border-bottom: 1px dashed var(--ui-border);
        padding-bottom: 0.25rem;
        margin-bottom: 0.25rem;

        .sender-name {
          font-weight: bold;
        }

        .cwd-label {
          background-color: var(--ui-bg-elevated);
          padding: 0.05rem 0.25rem;
          border-radius: 4px;
          border: 1px solid var(--ui-border);
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;

          &.success {
            background-color: var(--ui-success);
            box-shadow: 0 0 6px var(--ui-success);
          }

          &.error {
            background-color: var(--ui-error);
            box-shadow: 0 0 6px var(--ui-error);
          }
        }

        .duration {
          margin-left: auto;
        }
      }

      .bubble-content {
        .cmd-text {
          margin: 0;
          white-space: pre-wrap;
          font-family: inherit;
          color: var(--ui-primary);
          font-weight: 600;
        }

        .output-text {
          margin: 0;
          white-space: pre-wrap;
          font-family: inherit;
          color: var(--ui-text);
          line-height: 1.4;
        }

        .collapsed-placeholder {
          margin: 0.25rem 0;
        }

        .collapse-trigger {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }
      }

      &.user-bubble {
        background-color: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg-elevated));
        border-color: color-mix(in srgb, var(--ui-primary) 30%, var(--ui-border));
      }

      &.system-bubble {
        background-color: var(--ui-bg-elevated);

        &.error-bubble {
          border-color: color-mix(in srgb, var(--ui-error) 40%, var(--ui-border));
          box-shadow: 0 0 8px color-mix(in srgb, var(--ui-error) 10%, transparent);
        }
      }
    }
  }

  .input-area {
    position: relative;
    margin-top: 0.75rem;
    border-top: 1px solid var(--ui-border);
    padding-top: 0.75rem;
    flex-shrink: 0;

    .suggestions-popover {
      position: absolute;
      bottom: calc(100% + 0.5rem);
      left: 0;
      right: 0;
      background-color: var(--ui-bg-elevated);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      z-index: 50;
      max-height: 12.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(12px);

      .suggestions-header {
        display: flex;
        justify-content: space-between;
        padding: 0.375rem 0.75rem;
        background-color: color-mix(in srgb, var(--ui-text) 3%, var(--ui-bg-elevated));
        border-bottom: 1px solid var(--ui-border);
        font-size: 0.75rem;
        color: var(--ui-text-muted);

        .title {
          font-weight: 600;
        }
      }

      .suggestions-list {
        list-style: none;
        margin: 0;
        padding: 0.25rem 0;

        .suggestion-item {
          padding: 0.375rem 0.75rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          transition: background-color 0.15s ease;

          &:hover {
            background-color: color-mix(in srgb, var(--ui-primary) 8%, transparent);
          }

          &.active {
            background-color: color-mix(in srgb, var(--ui-primary) 12%, transparent);
            border-left: 3px solid var(--ui-primary);
            padding-left: calc(0.75rem - 3px);
          }

          .sug-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;

            .sug-name {
              font-weight: bold;
              color: var(--ui-text);
            }

            .sug-syntax {
              font-size: 0.75rem;
              color: var(--ui-primary);
            }
          }

          .sug-desc {
            font-size: 0.75rem;
            color: var(--ui-text-muted);
          }
        }
      }
    }

    .input-line {
      display: flex;
      align-items: center;
      gap: 0.375rem;

      .prompt {
        color: var(--ui-primary);
        white-space: nowrap;
        font-weight: bold;
      }

      .cmd-input {
        flex: 1 1 0%;
        background: transparent;
        border: none;
        outline: none;
        color: inherit;
        font-family: inherit;
        font-size: inherit;

        &::placeholder {
          color: var(--ui-text-muted);
          opacity: 0.6;
        }
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.popover-slide-enter-active,
.popover-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.popover-slide-enter-from,
.popover-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

<style lang="scss">
.app-window:has(.terminal-app) {
  .window-content {
    background: transparent !important;
  }
}
</style>
