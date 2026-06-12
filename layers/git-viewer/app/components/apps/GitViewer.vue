<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDesktopStore } from '#layers/txunos-core/app/stores/desktop'
import {
  isGitRepository,
  parseGitLog,
  parseGitConfig,
  getCurrentBranch,
  getHeadCommitSha,
  getFileContentFromCommit,
  getWorkingCopyChanges,
  getCommitChanges,
  type GitCommitLog,
  type GitFileChange
} from '../../utils/git-parser'
import {
  computeDiff,
  buildSplitDiff,
  type DiffLine,
  type SplitDiffRow
} from '../../utils/diff-helper'

const props = defineProps<{ windowId: string }>()

const { t } = useI18n()
const { notify } = useDesktopNotification()
const fileSystem = useFileSystem()
const desktopStore = useDesktopStore()
const win = computed(() => desktopStore.getWindowById(props.windowId))

// States
const currentRepoPath = ref<string>('')
const currentMountId = ref<string>('')
const isRepoValid = ref<boolean>(false)
const isLoading = ref<boolean>(false)
const localError = ref<string | null>(null)

const branch = ref<string>('main')
const remoteUrl = ref<string | null>(null)
const commits = ref<GitCommitLog[]>([])
const workingChanges = ref<GitFileChange[]>([])

// Sidebar tab: 'history' | 'working'
const activeTab = ref<'history' | 'working'>('history')

// Selection states
const selectedCommit = ref<GitCommitLog | null>(null)
const selectedCommitFiles = ref<GitFileChange[]>([])
const selectedFile = ref<string | null>(null)
const selectedFileStatus = ref<'modified' | 'added' | 'deleted' | null>(null)
const selectedFileSource = ref<'working' | 'commit'>('working')

// Diff state
const diffViewMode = ref<'unified' | 'split'>('unified')
const diffLines = ref<DiffLine[]>([])
const splitDiffRows = ref<SplitDiffRow[]>([])
const diffLoading = ref<boolean>(false)
const diffError = ref<string | null>(null)

// Layout/Responsiveness sizing
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(960)
const isCompact = computed(() => containerWidth.value < 768)

// List of mounts that contain .git to suggest to users
const availableRepos = ref<{ name: string; path: string; mountId: string }[]>([])

/**
 * 読み込み可能な Git リポジトリをマウント一覧からスキャンして候補を作る
 */
async function scanMountsForGitRepos() {
  availableRepos.value = []
  const mounts = fileSystem.mounts.value
  for (const m of mounts) {
    try {
      const hasGit = await isGitRepository(fileSystem, '/', m.id)
      if (hasGit) {
        availableRepos.value.push({
          name: m.name,
          path: '/',
          mountId: m.id
        })
      }
    } catch {
      // Ignore scanning failures
    }
  }
}

/**
 * リポジトリ情報をロードする
 */
async function loadRepository(path: string, mountId: string) {
  isLoading.value = true
  localError.value = null
  isRepoValid.value = false
  selectedCommit.value = null
  selectedFile.value = null
  diffLines.value = []
  splitDiffRows.value = []

  try {
    const isRepo = await isGitRepository(fileSystem, path, mountId)
    if (!isRepo) {
      isRepoValid.value = false
      localError.value = t('apps.gitViewer.notGitRepository')
      return
    }

    currentRepoPath.value = path
    currentMountId.value = mountId
    isRepoValid.value = true

    // リポジトリメタデータ取得
    branch.value = await getCurrentBranch(fileSystem, path, mountId)
    remoteUrl.value = await parseGitConfig(fileSystem, path, mountId)
    commits.value = await parseGitLog(fileSystem, path, mountId)
    workingChanges.value = await getWorkingCopyChanges(fileSystem, path, mountId)

    if (commits.value.length > 0) {
      await selectCommit(commits.value[0]!)
    }
  } catch (error: any) {
    localError.value = error.message || t('apps.gitViewer.errorGeneric')
  } finally {
    isLoading.value = false
  }
}

/**
 * コミット詳細を選択する
 */
async function selectCommit(commit: GitCommitLog) {
  selectedCommit.value = commit
  selectedFile.value = null
  diffLines.value = []
  splitDiffRows.value = []
  
  try {
    selectedCommitFiles.value = await getCommitChanges(
      fileSystem,
      currentRepoPath.value,
      commit.hash,
      currentMountId.value
    )
  } catch {
    selectedCommitFiles.value = []
  }
}

/**
 * 作業コピーまたはコミット内のファイルを選択して Diff を生成する
 */
async function selectFileDiff(filePath: string, status: 'modified' | 'added' | 'deleted', source: 'working' | 'commit') {
  selectedFile.value = filePath
  selectedFileStatus.value = status
  selectedFileSource.value = source

  diffLoading.value = true
  diffError.value = null
  diffLines.value = []
  splitDiffRows.value = []

  try {
    let oldText = ''
    let newText = ''
    const prefix = currentRepoPath.value === '/' ? '' : currentRepoPath.value

    if (source === 'working') {
      const headSha = await getHeadCommitSha(fileSystem, currentRepoPath.value, currentMountId.value)
      
      if (status !== 'added' && headSha) {
        // HEADコミット時の内容を復元
        oldText = await getFileContentFromCommit(
          fileSystem,
          currentRepoPath.value,
          headSha,
          filePath,
          currentMountId.value
        )
      }
      
      if (status !== 'deleted') {
        // ローカルの現在の内容
        newText = await fileSystem.readTextFile(`${prefix}/${filePath}`, currentMountId.value)
      }
    } else {
      // コミット詳細からの選択
      if (selectedCommit.value) {
        const commitSha = selectedCommit.value.hash
        const parentSha = selectedCommit.value.parentHash

        if (status !== 'added' && parentSha && parentSha !== '0000000000000000000000000000000000000000') {
          try {
            oldText = await getFileContentFromCommit(
              fileSystem,
              currentRepoPath.value,
              parentSha,
              filePath,
              currentMountId.value
            )
          } catch {
            oldText = ''
          }
        }
        
        if (status !== 'deleted') {
          newText = await getFileContentFromCommit(
            fileSystem,
            currentRepoPath.value,
            commitSha,
            filePath,
            currentMountId.value
          )
        }
      }
    }

    // 差分計算
    diffLines.value = computeDiff(oldText, newText)
    splitDiffRows.value = buildSplitDiff(diffLines.value)
  } catch (error: any) {
    diffError.value = error.message || t('apps.gitViewer.errorGeneric')
  } finally {
    diffLoading.value = false
  }
}

/**
 * リフレッシュ
 */
async function refreshRepository() {
  if (isRepoValid.value && currentRepoPath.value) {
    await loadRepository(currentRepoPath.value, currentMountId.value)
    notify(t('apps.fileManager.refresh'), { type: 'success' })
  }
}

// 起動引数をウォッチして自動ロード
watch(() => win.value?.args?.path, async (newPath) => {
  if (typeof newPath === 'string') {
    // 引数として渡されたパスでロードする。マウントIDを特定する必要がある。
    // まず起動されたパスがどのマウントに属しているか走査する。
    const mounts = fileSystem.mounts.value
    let foundMountId = fileSystem.activeMountId.value || ''
    let relativeRepoPath = newPath

    for (const m of mounts) {
      if (newPath === m.name || newPath.startsWith(m.name + '/') || newPath.startsWith('/' + m.name)) {
        foundMountId = m.id
        relativeRepoPath = '/' // マウントのルート
        break
      }
    }
    
    // パスがマウントそのものの場合はルートとする
    if (newPath.startsWith('/')) {
      relativeRepoPath = newPath
    }

    await loadRepository(relativeRepoPath, foundMountId)
  }
}, { immediate: true })

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    ro.observe(containerRef.value)
    onUnmounted(() => ro.disconnect())
  }

  await fileSystem.restoreMounts()
  await scanMountsForGitRepos()

  // 初期ロードがない場合は、アクティブマウントを自動スキャン
  if (!isRepoValid.value && fileSystem.activeMountId.value) {
    const hasGit = await isGitRepository(fileSystem, '/', fileSystem.activeMountId.value)
    if (hasGit) {
      await loadRepository('/', fileSystem.activeMountId.value)
    }
  }
})

// マウント変更時のスキャン
watch(fileSystem.activeMountId, async (newId) => {
  if (newId) {
    await scanMountsForGitRepos()
    const hasGit = await isGitRepository(fileSystem, '/', newId)
    if (hasGit) {
      await loadRepository('/', newId)
    }
  }
})

function getStatusBadgeColor(status: 'modified' | 'added' | 'deleted') {
  switch (status) {
    case 'added': return 'success'
    case 'deleted': return 'error'
    case 'modified': return 'warning'
  }
}

function getStatusBadgeLabel(status: 'modified' | 'added' | 'deleted') {
  switch (status) {
    case 'added': return 'A'
    case 'deleted': return 'D'
    case 'modified': return 'M'
  }
}

function formatCommitDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}
</script>

<template>
  <div
    ref="containerRef"
    class="git-viewer"
  >
    <!-- Top Bar Toolbar -->
    <div class="toolbar">
      <div class="repo-info">
        <UIcon
          name="i-lucide-git-branch"
          class="repo-icon text-orange-500"
        />
        <span
          v-if="isRepoValid"
          class="font-semibold text-sm"
        >
          {{ branch }}
        </span>
        <span
          v-else
          class="text-sm text-neutral-500"
        >
          {{ $t('apps.gitViewer.name') }}
        </span>
      </div>

      <div class="toolbar-actions">
        <UButton
          v-if="isRepoValid"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="isLoading"
          @click="refreshRepository"
        />
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="body">
      <!-- Empty/Error State view -->
      <div
        v-if="!isRepoValid"
        class="empty-state"
      >
        <div class="placeholder-content">
          <UIcon
            name="i-lucide-git-pull-request"
            class="placeholder-icon text-orange-400"
          />
          <p class="placeholder-text text-sm">
            {{ localError || $t('apps.gitViewer.selectRepository') }}
          </p>

          <!-- Suggested repositories from mounts -->
          <div
            v-if="availableRepos.length > 0"
            class="suggested-repos"
          >
            <p class="text-xs text-neutral-500 mb-2">
              検出された Git リポジトリ:
            </p>
            <div class="suggested-list">
              <button
                v-for="repo in availableRepos"
                :key="repo.mountId"
                class="suggested-item"
                @click="loadRepository(repo.path, repo.mountId)"
              >
                <UIcon
                  name="i-lucide-folder-git"
                  class="mr-2"
                />
                {{ repo.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Repo Valid Layout -->
      <div
        v-else
        class="layout-grid"
        :class="{ compact: isCompact }"
      >
        <!-- Sidebar (Repo view switcher) -->
        <div class="pane sidebar">
          <div class="meta-section">
            <div class="meta-item">
              <span class="meta-label">{{ $t('apps.gitViewer.branch') }}:</span>
              <span class="meta-value text-orange-400 font-mono text-xs">{{ branch }}</span>
            </div>
            <div
              v-if="remoteUrl"
              class="meta-item"
            >
              <span class="meta-label">{{ $t('apps.gitViewer.remoteUrl') }}:</span>
              <span
                class="meta-value truncate text-xs text-neutral-400"
                :title="remoteUrl"
              >{{ remoteUrl }}</span>
            </div>
          </div>

          <!-- Tab Selector -->
          <div class="tabs-control">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'history' }"
              @click="activeTab = 'history'"
            >
              <UIcon
                name="i-lucide-history"
                class="mr-2"
              />
              {{ $t('apps.gitViewer.history') }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'working' }"
              @click="activeTab = 'working'"
            >
              <UIcon
                name="i-lucide-file-code-2"
                class="mr-2"
              />
              {{ $t('apps.gitViewer.workingCopy') }}
              <span
                v-if="workingChanges.length > 0"
                class="changes-count"
              >{{ workingChanges.length }}</span>
            </button>
          </div>

          <!-- Interactive Scroller based on tab selection -->
          <div class="scroller pane-content">
            <!-- HISTORY TAB -->
            <div
              v-if="activeTab === 'history'"
              class="commit-timeline"
            >
              <div
                v-for="(commit, idx) in commits"
                :key="commit.hash"
                class="commit-item"
                :class="{ active: selectedCommit?.hash === commit.hash }"
                @click="selectCommit(commit)"
              >
                <!-- Stylized timeline graph nodes -->
                <div class="timeline-nodes">
                  <div class="node-dot" />
                  <div
                    v-if="idx < commits.length - 1"
                    class="node-line"
                  />
                </div>

                <div class="commit-summary">
                  <span class="commit-msg">{{ commit.message }}</span>
                  <div class="commit-meta text-xs">
                    <span class="commit-author">{{ commit.authorName }}</span>
                    <span class="commit-sha font-mono">{{ commit.hash.substring(0, 7) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- WORKING COPY TAB -->
            <div
              v-else
              class="working-copy"
            >
              <div
                v-if="workingChanges.length === 0"
                class="no-changes-msg"
              >
                <UIcon
                  name="i-lucide-check-circle"
                  class="text-green-500 mb-2 text-2xl"
                />
                <p class="text-xs text-neutral-500">
                  {{ $t('apps.gitViewer.noChanges') }}
                </p>
              </div>
              <div
                v-else
                class="files-list"
              >
                <div
                  v-for="change in workingChanges"
                  :key="change.path"
                  class="file-item"
                  :class="{ active: selectedFile === change.path && selectedFileSource === 'working' }"
                  @click="selectFileDiff(change.path, change.status, 'working')"
                >
                  <UIcon
                    :name="change.status === 'deleted' ? 'i-lucide-file-x' : 'i-lucide-file-text'"
                    class="mr-2"
                  />
                  <span class="file-path text-sm truncate">{{ change.path }}</span>
                  <UBadge
                    size="xs"
                    :color="getStatusBadgeColor(change.status)"
                    class="ml-auto"
                  >
                    {{ getStatusBadgeLabel(change.status) }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Center/Right Details and Diff Viewer -->
        <div class="pane viewer">
          <!-- Commit Details overview (when history tab active and no file diff is open) -->
          <div
            v-if="activeTab === 'history' && !selectedFile"
            class="commit-details-view pane-content"
          >
            <div
              v-if="selectedCommit"
              class="details-container"
            >
              <h3 class="text-lg font-semibold mb-4 text-orange-400">
                {{ $t('apps.gitViewer.commitMessage') }}
              </h3>
              <p class="commit-full-msg whitespace-pre-wrap mb-6">
                {{ selectedCommit.message }}
              </p>

              <div class="details-grid mb-6">
                <div class="detail-row">
                  <span class="detail-label">{{ $t('apps.gitViewer.author') }}:</span>
                  <span class="detail-val">{{ selectedCommit.authorName }} &lt;{{ selectedCommit.authorEmail }}&gt;</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">{{ $t('apps.gitViewer.date') }}:</span>
                  <span class="detail-val">{{ formatCommitDate(selectedCommit.timestamp) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">{{ $t('apps.gitViewer.hash') }}:</span>
                  <span class="detail-val font-mono">{{ selectedCommit.hash }}</span>
                </div>
                <div
                  v-if="selectedCommit.parentHash"
                  class="detail-row"
                >
                  <span class="detail-label">{{ $t('apps.gitViewer.parent') }}:</span>
                  <span class="detail-val font-mono">{{ selectedCommit.parentHash }}</span>
                </div>
              </div>

              <h4 class="text-sm font-semibold mb-2 text-neutral-300">
                {{ $t('apps.gitViewer.filesChanged') }} ({{ selectedCommitFiles.length }})
              </h4>
              <div class="files-list border border-neutral-800 rounded">
                <div
                  v-for="change in selectedCommitFiles"
                  :key="change.path"
                  class="file-item"
                  @click="selectFileDiff(change.path, change.status, 'commit')"
                >
                  <UIcon
                    name="i-lucide-file-text"
                    class="mr-2"
                  />
                  <span class="file-path text-sm truncate">{{ change.path }}</span>
                  <UBadge
                    size="xs"
                    :color="getStatusBadgeColor(change.status)"
                    class="ml-auto"
                  >
                    {{ getStatusBadgeLabel(change.status) }}
                  </UBadge>
                </div>
              </div>
            </div>
            <div
              v-else
              class="flex flex-col items-center justify-center h-full text-neutral-500 text-sm"
            >
              コミットを選択してください
            </div>
          </div>

          <!-- File Diff View panel -->
          <div
            v-else
            class="diff-view pane-content"
          >
            <!-- Diff header controls -->
            <div class="diff-header">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-chevron-left"
                class="mr-2"
                @click="selectedFile = null"
              />
              <span class="diff-filepath font-semibold text-sm truncate">
                {{ selectedFile }}
              </span>
              <UBadge
                v-if="selectedFileStatus"
                size="xs"
                :color="getStatusBadgeColor(selectedFileStatus)"
                class="ml-2"
              >
                {{ selectedFileStatus.toUpperCase() }}
              </UBadge>

              <!-- Unified/Split Toggle switch -->
              <div class="diff-mode-toggle ml-auto">
                <UButton
                  size="xs"
                  :variant="diffViewMode === 'unified' ? 'solid' : 'ghost'"
                  color="neutral"
                  :label="$t('apps.gitViewer.unified')"
                  @click="diffViewMode = 'unified'"
                />
                <UButton
                  size="xs"
                  :variant="diffViewMode === 'split' ? 'solid' : 'ghost'"
                  color="neutral"
                  :label="$t('apps.gitViewer.split')"
                  @click="diffViewMode = 'split'"
                />
              </div>
            </div>

            <!-- Diff Content View -->
            <div class="diff-body scroller">
              <div
                v-if="diffLoading"
                class="flex flex-col items-center justify-center h-48 text-neutral-400 text-xs"
              >
                <UIcon
                  name="i-lucide-loader-2"
                  class="animate-spin text-2xl mb-2"
                />
                差分を取得中...
              </div>
              <div
                v-else-if="diffError"
                class="text-red-400 text-xs p-4"
              >
                {{ diffError }}
              </div>
              <!-- Unified Diff Layout -->
              <div
                v-else-if="diffViewMode === 'unified'"
                class="unified-diff font-mono text-xs whitespace-pre"
              >
                <div
                  v-for="(line, idx) in diffLines"
                  :key="idx"
                  class="diff-row"
                  :class="line.type"
                >
                  <span class="line-num left-num">{{ line.leftLineNumber || '' }}</span>
                  <span class="line-num right-num">{{ line.rightLineNumber || '' }}</span>
                  <span class="line-marker">{{ line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ' }}</span>
                  <span class="line-content">{{ line.content }}</span>
                </div>
              </div>
              <!-- Split Diff Layout -->
              <div
                v-else
                class="split-diff font-mono text-xs"
              >
                <div class="split-header">
                  <div class="split-col-header border-r border-neutral-800">
                    旧ファイル (HEAD)
                  </div>
                  <div class="split-col-header">
                    新ファイル
                  </div>
                </div>
                <div class="split-rows-container">
                  <div
                    v-for="(row, idx) in splitDiffRows"
                    :key="idx"
                    class="split-row"
                  >
                    <!-- Left Side (Old) -->
                    <div
                      class="split-cell left-cell border-r border-neutral-800"
                      :class="row.left?.type"
                    >
                      <span class="line-num">{{ row.left?.lineNumber || '' }}</span>
                      <span class="line-marker">{{ row.left?.type === 'deleted' ? '-' : ' ' }}</span>
                      <span class="line-content">{{ row.left?.content || '' }}</span>
                    </div>
                    <!-- Right Side (New) -->
                    <div
                      class="split-cell right-cell"
                      :class="row.right?.type"
                    >
                      <span class="line-num">{{ row.right?.lineNumber || '' }}</span>
                      <span class="line-marker">{{ row.right?.type === 'added' ? '+' : ' ' }}</span>
                      <span class="line-content">{{ row.right?.content || '' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.git-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  position: relative;
  overflow: hidden;

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;

    .repo-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
  }

  .body {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .scroller {
    overflow-y: auto;
    overflow-x: auto;
    flex: 1;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--ui-text-muted);

    .placeholder-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      max-width: 24rem;
      padding: 2rem;

      .placeholder-icon {
        width: 3.5rem;
        height: 3.5rem;
        opacity: 0.6;
      }

      .suggested-repos {
        margin-top: 1.5rem;
        width: 100%;

        .suggested-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;

          .suggested-item {
            display: flex;
            align-items: center;
            padding: 0.5rem 0.75rem;
            background: var(--ui-bg-elevated);
            border: 1px solid var(--ui-border);
            border-radius: 0.375rem;
            font-size: 0.8125rem;
            color: var(--ui-text);
            cursor: pointer;
            transition: background 0.15s ease;

            &:hover {
              background: var(--ui-border);
            }
          }
        }
      }
    }
  }

  .layout-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100%;
    
    &.compact {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }

  .pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-width: 0;

    &.sidebar {
      border-right: 1px solid var(--ui-border);
      background: var(--ui-bg-elevated);
    }

    .pane-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
  }

  .meta-section {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--ui-border);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .meta-item {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;

      .meta-label {
        font-size: 0.75rem;
        color: var(--ui-text-muted);
      }
    }
  }

  .tabs-control {
    display: flex;
    padding: 0.5rem;
    border-bottom: 1px solid var(--ui-border);
    gap: 0.25rem;

    .tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.375rem;
      font-size: 0.75rem;
      border-radius: 0.25rem;
      color: var(--ui-text-muted);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ui-text);
      }

      &.active {
        background: var(--ui-border);
        color: var(--ui-text);
        font-weight: 500;
      }

      .changes-count {
        background: var(--ui-primary);
        color: white;
        font-size: 0.6875rem;
        padding: 0 0.25rem;
        border-radius: 0.5rem;
        margin-left: 0.25rem;
      }
    }
  }

  .commit-timeline {
    padding: 0.5rem 0;

    .commit-item {
      display: flex;
      padding: 0.5rem 1rem;
      gap: 0.75rem;
      cursor: pointer;
      position: relative;
      transition: background 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      &.active {
        background: rgba(var(--ui-primary-rgb), 0.15);
        
        &::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: var(--ui-primary);
        }
      }

      .timeline-nodes {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 12px;
        flex-shrink: 0;
        position: relative;

        .node-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ui-border);
          border: 1.5px solid var(--ui-bg-elevated);
          z-index: 2;
          margin-top: 6px;
        }

        .node-line {
          position: absolute;
          top: 10px;
          bottom: -10px;
          width: 1.5px;
          background: var(--ui-border);
          z-index: 1;
        }
      }

      &.active .timeline-nodes .node-dot {
        background: var(--ui-primary);
      }

      .commit-summary {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;

        .commit-msg {
          font-size: 0.8125rem;
          color: var(--ui-text);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .commit-meta {
          display: flex;
          justify-content: space-between;
          color: var(--ui-text-muted);
          font-size: 0.6875rem;
        }
      }
    }
  }

  .working-copy {
    padding: 1rem;

    .no-changes-msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 0;
    }
  }

  .files-list {
    display: flex;
    flex-direction: column;

    .file-item {
      display: flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      border-radius: 0.25rem;
      transition: background 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      &.active {
        background: rgba(var(--ui-primary-rgb), 0.15);
        color: var(--ui-text);
      }

      .file-path {
        max-width: 70%;
      }
    }
  }

  .commit-details-view {
    padding: 1.5rem;
    overflow-y: auto;

    .details-container {
      max-width: 48rem;
    }

    .details-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem 1.5rem;
      padding: 1rem;
      background: var(--ui-bg-elevated);
      border: 1px solid var(--ui-border);
      border-radius: 0.375rem;

      .detail-row {
        display: contents;

        .detail-label {
          font-size: 0.75rem;
          color: var(--ui-text-muted);
          font-weight: 500;
        }

        .detail-val {
          font-size: 0.8125rem;
          color: var(--ui-text);
          word-break: break-all;
        }
      }
    }
  }

  .diff-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    .diff-header {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-bg-elevated);
      flex-shrink: 0;

      .diff-filepath {
        max-width: 50%;
      }
    }

    .diff-body {
      flex: 1;
      background: #0f141c; /* ダークコードテーマに似た背景 */
      color: #cbd5e1;
    }

    .unified-diff {
      padding: 0.5rem 0;

      .diff-row {
        display: flex;
        line-height: 1.4;

        &:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        &.added {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          
          .line-marker, .line-num {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
          }
        }

        &.deleted {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;

          .line-marker, .line-num {
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
          }
        }

        .line-num {
          width: 3rem;
          text-align: right;
          padding-right: 0.5rem;
          color: #4b5563;
          user-select: none;
          border-right: 1px solid #1e293b;
        }

        .line-marker {
          width: 1.5rem;
          text-align: center;
          color: #4b5563;
          user-select: none;
        }

        .line-content {
          padding-left: 0.5rem;
        }
      }
    }

    .split-diff {
      display: flex;
      flex-direction: column;
      height: 100%;

      .split-header {
        display: grid;
        grid-template-columns: 1fr 1fr;
        background: #1e293b;
        border-bottom: 1px solid #0f141c;
        flex-shrink: 0;

        .split-col-header {
          padding: 0.375rem 1rem;
          font-weight: 500;
          color: #94a3b8;
          font-size: 0.75rem;
        }
      }

      .split-rows-container {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        flex: 1;
        min-height: 0;
      }

      .split-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        line-height: 1.4;

        &:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .split-cell {
          display: flex;
          overflow: hidden;
          min-width: 0;

          &.added {
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;

            .line-num, .line-marker {
              background: rgba(16, 185, 129, 0.2);
              color: #34d399;
            }
          }

          &.deleted {
            background: rgba(239, 68, 68, 0.12);
            color: #f87171;

            .line-num, .line-marker {
              background: rgba(239, 68, 68, 0.2);
              color: #f87171;
            }
          }

          .line-num {
            width: 3rem;
            text-align: right;
            padding-right: 0.5rem;
            color: #4b5563;
            user-select: none;
            border-right: 1px solid #1e293b;
          }

          .line-marker {
            width: 1.5rem;
            text-align: center;
            color: #4b5563;
            user-select: none;
          }

          .line-content {
            padding-left: 0.5rem;
            white-space: pre;
            overflow-x: auto;
          }
        }
      }
    }
  }
}
</style>
