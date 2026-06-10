import type { FileSystemEntry } from '#layers/txunos-core/app/stores/filesystem'

export interface GitCommitLog {
  hash: string
  parentHash: string
  authorName: string
  authorEmail: string
  timestamp: number // epoch ms
  timezone: string
  message: string
}

export interface GitFileChange {
  path: string
  status: 'modified' | 'added' | 'deleted'
}

/**
 * 指定のパスがGitリポジトリ（.gitディレクトリが存在する）であるか確認する
 */
export async function isGitRepository(
  fileSystem: any,
  repoPath: string,
  mountId?: string
): Promise<boolean> {
  const gitPath = repoPath === '/' ? '/.git' : `${repoPath}/.git`
  try {
    return await fileSystem.exists(gitPath, mountId)
  } catch {
    return false
  }
}

/**
 * .git/logs/HEAD をパースしてコミット履歴を取得する
 */
export async function parseGitLog(
  fileSystem: any,
  repoPath: string,
  mountId?: string
): Promise<GitCommitLog[]> {
  const prefix = repoPath === '/' ? '' : repoPath
  const logPath = `${prefix}/.git/logs/HEAD`

  try {
    const exists = await fileSystem.exists(logPath, mountId)
    if (!exists) return []

    const content = await fileSystem.readTextFile(logPath, mountId)
    const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
    const logs: GitCommitLog[] = []

    // regex to parse: parentSha commitSha authorName <authorEmail> timestamp timezone\tmessage
    const regex = /^([0-9a-f]{40}) ([0-9a-f]{40}) (.*?) <(.*?)> (\d+) ([+-]\d{4})\t(.*)$/

    for (const line of lines) {
      const match = line.match(regex)
      if (match) {
        logs.push({
          parentHash: match[1],
          hash: match[2],
          authorName: match[3],
          authorEmail: match[4],
          timestamp: parseInt(match[5], 10) * 1000, //秒をミリ秒へ
          timezone: match[6],
          message: match[7]
        })
      }
    }

    // 新しいコミットが先頭に来るように逆順にする
    return logs.reverse()
  } catch (error) {
    console.error('Failed to parse git log:', error)
    return []
  }
}

/**
 * .git/config からリモートURLを取得する
 */
export async function parseGitConfig(
  fileSystem: any,
  repoPath: string,
  mountId?: string
): Promise<string | null> {
  const prefix = repoPath === '/' ? '' : repoPath
  const configPath = `${prefix}/.git/config`

  try {
    const exists = await fileSystem.exists(configPath, mountId)
    if (!exists) return null

    const content = await fileSystem.readTextFile(configPath, mountId)
    const lines = content.split('\n')
    let insideRemote = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[remote "origin"]')) {
        insideRemote = true
        continue
      }
      if (trimmed.startsWith('[') && !trimmed.startsWith('[remote "origin"]')) {
        insideRemote = false
      }
      if (insideRemote && trimmed.startsWith('url =')) {
        return trimmed.split('=').slice(1).join('=').trim()
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 現在のブランチ名を取得する
 */
export async function getCurrentBranch(
  fileSystem: any,
  repoPath: string,
  mountId?: string
): Promise<string> {
  const prefix = repoPath === '/' ? '' : repoPath
  const headPath = `${prefix}/.git/HEAD`

  try {
    const exists = await fileSystem.exists(headPath, mountId)
    if (!exists) return 'unknown'

    const content = await fileSystem.readTextFile(headPath, mountId)
    const trimmed = content.trim()

    if (trimmed.startsWith('ref:')) {
      // ref: refs/heads/main -> main
      return trimmed.substring(4).trim().replace('refs/heads/', '')
    }
    // detached head (ハッシュが直接書かれている場合)
    return `detached at ${trimmed.substring(0, 7)}`
  } catch {
    return 'unknown'
  }
}

/**
 * HEAD コミットハッシュを取得する
 */
export async function getHeadCommitSha(
  fileSystem: any,
  repoPath: string,
  mountId?: string
): Promise<string | null> {
  const prefix = repoPath === '/' ? '' : repoPath
  const headPath = `${prefix}/.git/HEAD`

  try {
    const exists = await fileSystem.exists(headPath, mountId)
    if (!exists) return null

    const content = await fileSystem.readTextFile(headPath, mountId)
    const trimmed = content.trim()

    if (trimmed.startsWith('ref:')) {
      const refPath = `${prefix}/.git/${trimmed.substring(4).trim()}`
      if (await fileSystem.exists(refPath, mountId)) {
        const refContent = await fileSystem.readTextFile(refPath, mountId)
        return refContent.trim()
      }
      return null
    }
    return trimmed
  } catch {
    return null
  }
}

export interface GitObject {
  type: 'commit' | 'tree' | 'blob' | 'tag' | 'unknown'
  size: number
  content: Uint8Array
}

/**
 * .git/objects/ からオブジェクトを読み込み、解凍してパースする
 */
export async function readGitObject(
  fileSystem: any,
  repoPath: string,
  sha: string,
  mountId?: string
): Promise<GitObject> {
  if (!sha || sha.length !== 40) {
    throw new Error(`Invalid SHA-1 hash: ${sha}`)
  }

  const prefix = repoPath === '/' ? '' : repoPath
  const objDir = sha.substring(0, 2)
  const objFile = sha.substring(2)
  const objPath = `${prefix}/.git/objects/${objDir}/${objFile}`

  try {
    const blob = await fileSystem.readFileBlob(objPath, mountId)
    
    // DecompressionStream('deflate') を使用して zlib 圧縮データを解凍する
    const ds = new DecompressionStream('deflate')
    const decompressedStream = blob.stream().pipeThrough(ds)
    const response = new Response(decompressedStream)
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // フォーマット: [type] [size]\0[content]
    let nullIdx = -1
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        nullIdx = i
        break
      }
    }

    if (nullIdx === -1) {
      throw new Error('Invalid git object format (missing null terminator)')
    }

    const header = new TextDecoder().decode(bytes.subarray(0, nullIdx))
    const parts = header.split(' ')
    const type = (parts[0] || 'unknown') as GitObject['type']
    const size = parseInt(parts[1] || '0', 10)
    const content = bytes.subarray(nullIdx + 1)

    return { type, size, content }
  } catch (error) {
    console.error(`Error reading git object ${sha}:`, error)
    throw new Error(`Failed to read git object ${sha}`)
  }
}

/**
 * コミットオブジェクトから Tree SHA を抽出する
 */
export async function getTreeShaFromCommit(
  fileSystem: any,
  repoPath: string,
  commitSha: string,
  mountId?: string
): Promise<string | null> {
  try {
    const obj = await readGitObject(fileSystem, repoPath, commitSha, mountId)
    if (obj.type !== 'commit') {
      throw new Error(`Object ${commitSha} is not a commit (got ${obj.type})`)
    }

    const text = new TextDecoder().decode(obj.content)
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('tree ')) {
        return line.substring(5).trim()
      }
    }
    return null
  } catch (e) {
    console.error('Failed to get tree SHA from commit:', e)
    return null
  }
}

export interface GitTreeEntry {
  mode: string
  name: string
  sha: string
  kind: 'tree' | 'blob'
}

/**
 * ツリーオブジェクトをパースしてエントリー一覧を取得する
 */
export function parseGitTree(content: Uint8Array): GitTreeEntry[] {
  const entries: GitTreeEntry[] = []
  let offset = 0

  while (offset < content.length) {
    // ヌルバイトを探す
    let nullIdx = -1
    for (let i = offset; i < content.length; i++) {
      if (content[i] === 0) {
        nullIdx = i
        break
      }
    }

    if (nullIdx === -1) break

    const header = new TextDecoder().decode(content.subarray(offset, nullIdx))
    const parts = header.split(' ')
    const mode = parts[0] || ''
    const name = parts[1] || ''

    // ヌルバイトの直後20バイトがバイナリSHA-1
    const shaBytes = content.subarray(nullIdx + 1, nullIdx + 21)
    if (shaBytes.length < 20) break

    const sha = Array.from(shaBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // mode 40000 はディレクトリ(tree), 100644/100755/120000 はファイル(blob)
    const kind = mode.startsWith('4') ? 'tree' : 'blob'

    entries.push({ mode, name, sha, kind })
    offset = nullIdx + 21
  }

  return entries
}

/**
 * ツリーオブジェクトを再帰的にたどって全ファイルのパスとSHAマップを構築する
 */
export async function getFilesFromTree(
  fileSystem: any,
  repoPath: string,
  treeSha: string,
  mountId?: string,
  currentPath = ''
): Promise<Map<string, string>> {
  const fileMap = new Map<string, string>()

  async function traverse(sha: string, pathPrefix: string) {
    const obj = await readGitObject(fileSystem, repoPath, sha, mountId)
    if (obj.type !== 'tree') return

    const entries = parseGitTree(obj.content)
    for (const entry of entries) {
      const relativePath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name
      if (entry.kind === 'blob') {
        fileMap.set(relativePath, entry.sha)
      } else if (entry.kind === 'tree') {
        await traverse(entry.sha, relativePath)
      }
    }
  }

  await traverse(treeSha, currentPath)
  return fileMap
}

/**
 * コミットツリーから特定のファイルの内容を取得する
 */
export async function getFileContentFromCommit(
  fileSystem: any,
  repoPath: string,
  commitSha: string,
  filePath: string, // リポジトリ相対パス (例: "src/main.js")
  mountId?: string
): Promise<string> {
  const treeSha = await getTreeShaFromCommit(fileSystem, repoPath, commitSha, mountId)
  if (!treeSha) {
    throw new Error('Could not find tree for commit')
  }

  const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
  const segments = normalizedPath.split('/').filter(Boolean)

  let currentSha = treeSha

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const obj = await readGitObject(fileSystem, repoPath, currentSha, mountId)
    if (obj.type !== 'tree') {
      throw new Error(`Path ${filePath} leads to a non-tree object`)
    }

    const entries = parseGitTree(obj.content)
    const match = entries.find(e => e.name === segment)

    if (!match) {
      throw new Error(`File or directory ${segment} not found in tree`)
    }

    if (i === segments.length - 1) {
      if (match.kind !== 'blob') {
        throw new Error(`Path ${filePath} is a directory, not a file`)
      }
      const blobObj = await readGitObject(fileSystem, repoPath, match.sha, mountId)
      return new TextDecoder().decode(blobObj.content)
    } else {
      if (match.kind !== 'tree') {
        throw new Error(`Path segment ${segment} is not a directory`)
      }
      currentSha = match.sha
    }
  }

  throw new Error('Path resolution failed')
}

/**
 * ローカル作業コピー内の全ファイルを再帰的に走査する（.git, node_modules等を無視）
 */
async function listLocalFiles(
  fileSystem: any,
  currentPath: string,
  rootPath: string,
  mountId?: string
): Promise<{ path: string, size: number }[]> {
  const list: { path: string, size: number }[] = []
  
  const ignoreDirs = ['.git', 'node_modules', '.nuxt', '.output', 'dist', 'coverage']
  const normalizedRoot = rootPath === '/' ? '' : rootPath

  async function walk(dir: string) {
    const entries = await fileSystem.listDirectory(dir, mountId)
    for (const entry of entries) {
      if (ignoreDirs.includes(entry.name)) continue

      if (entry.kind === 'directory') {
        await walk(entry.path)
      } else {
        // リポジトリルートからの相対パスに変換
        let relPath = entry.path
        if (normalizedRoot) {
          if (relPath.startsWith(normalizedRoot)) {
            relPath = relPath.substring(normalizedRoot.length)
          }
        }
        if (relPath.startsWith('/')) {
          relPath = relPath.substring(1)
        }
        list.push({ path: relPath, size: entry.size || 0 })
      }
    }
  }

  await walk(rootPath)
  return list
}

/**
 * 作業コピーの変更（Git Status に相当）を検出する
 */
export async function getWorkingCopyChanges(
  fileSystem: any,
  repoPath: string,
  mountId?: string
): Promise<GitFileChange[]> {
  try {
    const headSha = await getHeadCommitSha(fileSystem, repoPath, mountId)
    if (!headSha) {
      // コミットがまだない空のリポジトリ
      const localFiles = await listLocalFiles(fileSystem, repoPath, repoPath, mountId)
      return localFiles.map(f => ({ path: f.path, status: 'added' }))
    }

    const treeSha = await getTreeShaFromCommit(fileSystem, repoPath, headSha, mountId)
    if (!treeSha) return []

    // 1. HEADコミットから全ファイルとSHAマップを取得
    const headFiles = await getFilesFromTree(fileSystem, repoPath, treeSha, mountId)

    // 2. ローカルの全ファイルパスを取得
    const localFiles = await listLocalFiles(fileSystem, repoPath, repoPath, mountId)

    const changes: GitFileChange[] = []
    const localPathSet = new Set<string>()

    // 3. ローカルの各ファイルについて、追加または変更されたか検証
    for (const localFile of localFiles) {
      localPathSet.add(localFile.path)
      const headSha = headFiles.get(localFile.path)

      if (!headSha) {
        // HEADになかった -> 新規追加
        changes.push({ path: localFile.path, status: 'added' })
      } else {
        // 両方にある場合、内容比較。
        // パフォーマンス向上のため、まずはサイズで簡易チェック、あるいは実際に読み込んで比較。
        // サイズだけで判定するとメタデータ違いを見逃す可能性があるので、テキスト読み込みをするか、
        // もしくは一度ファイルの blob を読み込み、Git blob 互換のSHA-1を計算して比較する。
        // 簡易実装として、ファイルをテキストで読み込んで、HEADの内容と比較する。
        const prefix = repoPath === '/' ? '' : repoPath
        const localText = await fileSystem.readTextFile(`${prefix}/${localFile.path}`, mountId)
        const headText = await getFileContentFromCommit(fileSystem, repoPath, headSha, localFile.path, mountId)

        if (localText !== headText) {
          changes.push({ path: localFile.path, status: 'modified' })
        }
      }
    }

    // 4. HEADにあったがローカルから消えたファイル -> 削除
    for (const [headPath] of headFiles.entries()) {
      if (!localPathSet.has(headPath)) {
        changes.push({ path: headPath, status: 'deleted' })
      }
    }

    // パス順にソートして返す
    return changes.sort((a, b) => a.path.localeCompare(b.path))
  } catch (error) {
    console.error('Failed to get working copy changes:', error)
    return []
  }
}

/**
 * 特定のコミットにおける変更されたファイル一覧を親コミットとの比較から取得する
 */
export async function getCommitChanges(
  fileSystem: any,
  repoPath: string,
  commitSha: string,
  mountId?: string
): Promise<GitFileChange[]> {
  try {
    const treeSha = await getTreeShaFromCommit(fileSystem, repoPath, commitSha, mountId)
    if (!treeSha) return []

    // 現在のコミットのファイル一覧
    const currentFiles = await getFilesFromTree(fileSystem, repoPath, treeSha, mountId)

    // 親コミットの特定
    const obj = await readGitObject(fileSystem, repoPath, commitSha, mountId)
    if (obj.type !== 'commit') return []
    const text = new TextDecoder().decode(obj.content)
    const lines = text.split('\n')
    let parentSha: string | null = null
    for (const line of lines) {
      if (line.startsWith('parent ')) {
        parentSha = line.substring(7).trim()
        break // 最初の親のみ考慮（マージコミットでも簡易的に第1親と比較）
      }
    }

    if (!parentSha) {
      // 親がない初期コミットの場合は、全ファイルが added
      const changes: GitFileChange[] = []
      for (const [path] of currentFiles.entries()) {
        changes.push({ path, status: 'added' })
      }
      return changes.sort((a, b) => a.path.localeCompare(b.path))
    }

    // 親コミットのファイル一覧
    const parentTreeSha = await getTreeShaFromCommit(fileSystem, repoPath, parentSha, mountId)
    if (!parentTreeSha) return []
    const parentFiles = await getFilesFromTree(fileSystem, repoPath, parentTreeSha, mountId)

    const changes: GitFileChange[] = []
    const currentPathSet = new Set<string>()

    // 現在のコミットのファイルが親と異なるか検証
    for (const [path, sha] of currentFiles.entries()) {
      currentPathSet.add(path)
      const parentShaVal = parentFiles.get(path)

      if (!parentShaVal) {
        changes.push({ path, status: 'added' })
      } else if (parentShaVal !== sha) {
        changes.push({ path, status: 'modified' })
      }
    }

    // 親にあったが現在のコミットで消えたファイル
    for (const [path] of parentFiles.entries()) {
      if (!currentPathSet.has(path)) {
        changes.push({ path, status: 'deleted' })
      }
    }

    return changes.sort((a, b) => a.path.localeCompare(b.path))
  } catch (error) {
    console.error('Failed to get commit changes:', error)
    return []
  }
}

