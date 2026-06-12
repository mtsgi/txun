import { describe, expect, it } from 'vitest'
import { computeDiff, buildSplitDiff } from '../../layers/git-viewer/app/utils/diff-helper'
import {
  parseGitLog,
  parseGitConfig,
  getCurrentBranch,
  getHeadCommitSha
} from '../../layers/git-viewer/app/utils/git-parser'

describe('Git Viewer - Diff Helper', () => {
  it('computes correct line diff for identical text', () => {
    const text = 'line1\nline2\nline3'
    const diff = computeDiff(text, text)
    
    expect(diff).toHaveLength(3)
    expect(diff.every(l => l.type === 'unchanged')).toBe(true)
    expect(diff[0]?.content).toBe('line1')
    expect(diff[0]?.leftLineNumber).toBe(1)
    expect(diff[0]?.rightLineNumber).toBe(1)
  })

  it('detects added lines', () => {
    const oldText = 'line1\nline3'
    const newText = 'line1\nline2\nline3'
    const diff = computeDiff(oldText, newText)

    expect(diff).toHaveLength(3)
    expect(diff[0]?.type).toBe('unchanged')
    expect(diff[1]?.type).toBe('added')
    expect(diff[1]?.content).toBe('line2')
    expect(diff[1]?.rightLineNumber).toBe(2)
    expect(diff[2]?.type).toBe('unchanged')
  })

  it('detects deleted lines', () => {
    const oldText = 'line1\nline2\nline3'
    const newText = 'line1\nline3'
    const diff = computeDiff(oldText, newText)

    expect(diff).toHaveLength(3)
    expect(diff[0]?.type).toBe('unchanged')
    expect(diff[1]?.type).toBe('deleted')
    expect(diff[1]?.content).toBe('line2')
    expect(diff[1]?.leftLineNumber).toBe(2)
    expect(diff[2]?.type).toBe('unchanged')
  })

  it('builds split diff formatting rows correctly', () => {
    const oldText = 'line1\nline2\nline3'
    const newText = 'line1\nline2-modified\nline3\nline4'
    const diff = computeDiff(oldText, newText)
    const splitRows = buildSplitDiff(diff)

    // Expected output has 4 rows:
    // 1: unchanged (line1)
    // 2: modified: left (deleted line2) / right (added line2-modified)
    // 3: unchanged (line3)
    // 4: added: left (undefined) / right (added line4)
    expect(splitRows).toHaveLength(4)
    expect(splitRows[0]?.left?.content).toBe('line1')
    expect(splitRows[0]?.right?.content).toBe('line1')

    expect(splitRows[1]?.left?.type).toBe('deleted')
    expect(splitRows[1]?.left?.content).toBe('line2')
    expect(splitRows[1]?.right?.type).toBe('added')
    expect(splitRows[1]?.right?.content).toBe('line2-modified')

    expect(splitRows[2]?.left?.content).toBe('line3')
    expect(splitRows[2]?.right?.content).toBe('line3')

    expect(splitRows[3]?.left).toBeUndefined()
    expect(splitRows[3]?.right?.type).toBe('added')
    expect(splitRows[3]?.right?.content).toBe('line4')
  })
})

describe('Git Viewer - Git Parser', () => {
  // Mock FileSystemStore
  const createMockFs = (files: Record<string, string>) => ({
    exists: async (path: string) => !!files[path],
    readTextFile: async (path: string) => {
      if (files[path] !== undefined) return files[path]
      throw new Error(`File not found: ${path}`)
    }
  })

  it('parses git log format correctly', async () => {
    const mockLog = 
      '0000000000000000000000000000000000000000 a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 Commit Author <author@example.com> 1718040000 +0900\tfirst commit\n' +
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5 Commit Author <author@example.com> 1718043600 +0900\tsecond commit\n'

    const mockFs = createMockFs({
      '/.git/logs/HEAD': mockLog
    })

    const logs = await parseGitLog(mockFs, '/')

    // Should return in reverse chronological order (newest commit first)
    expect(logs).toHaveLength(2)
    expect(logs[0]?.hash).toBe('f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5')
    expect(logs[0]?.parentHash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')
    expect(logs[0]?.authorName).toBe('Commit Author')
    expect(logs[0]?.authorEmail).toBe('author@example.com')
    expect(logs[0]?.timestamp).toBe(1718043600 * 1000)
    expect(logs[0]?.message).toBe('second commit')

    expect(logs[1]?.hash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')
  })

  it('extracts current branch from HEAD ref', async () => {
    const mockFs = createMockFs({
      '/.git/HEAD': 'ref: refs/heads/feature/awesome-ui\n'
    })

    const branch = await getCurrentBranch(mockFs, '/')
    expect(branch).toBe('feature/awesome-ui')
  })

  it('extracts remote URL from git config', async () => {
    const mockConfig = 
      '[core]\n' +
      '\trepositoryformatversion = 0\n' +
      '[remote "origin"]\n' +
      '\turl = https://github.com/mtsgi/txunos.git\n' +
      '\tfetch = +refs/heads/*:refs/remotes/origin/*\n'

    const mockFs = createMockFs({
      '/.git/config': mockConfig
    })

    const remoteUrl = await parseGitConfig(mockFs, '/')
    expect(remoteUrl).toBe('https://github.com/mtsgi/txunos.git')
  })

  it('resolves head commit SHA from branch ref', async () => {
    const mockFs = createMockFs({
      '/.git/HEAD': 'ref: refs/heads/main\n',
      '/.git/refs/heads/main': 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2\n'
    })

    const headSha = await getHeadCommitSha(mockFs, '/')
    expect(headSha).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')
  })
})
