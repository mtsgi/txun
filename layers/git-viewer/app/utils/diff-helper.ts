export interface DiffLine {
  type: 'added' | 'deleted' | 'unchanged'
  content: string
  leftLineNumber?: number
  rightLineNumber?: number
}

export interface SplitDiffRow {
  left?: {
    lineNumber: number
    content: string
    type: 'deleted' | 'unchanged'
  }
  right?: {
    lineNumber: number
    content: string
    type: 'added' | 'unchanged'
  }
}

/**
 * 2つのテキストを読み込み、行ベースの最長共通部分系列 (LCS) を用いた差分情報を算出する
 */
export function computeDiff(oldText: string, newText: string): DiffLine[] {
  // 改行コードの正規化
  const oldLines = oldText.replace(/\r\n/g, '\n').split('\n')
  const newLines = newText.replace(/\r\n/g, '\n').split('\n')

  const n = oldLines.length
  const m = newLines.length

  // メモリ使用量を削減しつつ高速化するため、DP テーブルを構築
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1]! === newLines[j - 1]!) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  const diff: DiffLine[] = []
  let i = n
  let j = m

  // 後ろからバックトラックして差分を組み立てる
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1]! === newLines[j - 1]!) {
      diff.push({
        type: 'unchanged',
        content: oldLines[i - 1]!,
        leftLineNumber: i,
        rightLineNumber: j
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      diff.push({
        type: 'added',
        content: newLines[j - 1]!,
        rightLineNumber: j
      })
      j--
    } else {
      diff.push({
        type: 'deleted',
        content: oldLines[i - 1]!,
        leftLineNumber: i
      })
      i--
    }
  }

  // 逆順になっているので反転して返す
  return diff.reverse()
}

/**
 * 算出した差分行データから、Split Diff 用の左右行ペアデータを作成する
 */
export function buildSplitDiff(diffLines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = []
  let i = 0

  while (i < diffLines.length) {
    if (diffLines[i]!.type === 'unchanged') {
      const line = diffLines[i]!
      rows.push({
        left: {
          lineNumber: line.leftLineNumber!,
          content: line.content,
          type: 'unchanged'
        },
        right: {
          lineNumber: line.rightLineNumber!,
          content: line.content,
          type: 'unchanged'
        }
      })
      i++
      continue
    }

    // 変更箇所（deleted, added）のブロックをまとめる
    const deletedBlock: DiffLine[] = []
    const addedBlock: DiffLine[] = []

    while (i < diffLines.length && diffLines[i]!.type !== 'unchanged') {
      if (diffLines[i]!.type === 'deleted') {
        deletedBlock.push(diffLines[i]!)
      } else {
        addedBlock.push(diffLines[i]!)
      }
      i++
    }

    // 削除ブロックと追加ブロックを左右にマッピングして並べる
    const maxLen = Math.max(deletedBlock.length, addedBlock.length)
    for (let k = 0; k < maxLen; k++) {
      const del = deletedBlock[k]
      const add = addedBlock[k]

      rows.push({
        left: del
          ? {
              lineNumber: del.leftLineNumber!,
              content: del.content,
              type: 'deleted'
            }
          : undefined,
        right: add
          ? {
              lineNumber: add.rightLineNumber!,
              content: add.content,
              type: 'added'
            }
          : undefined
      })
    }
  }

  return rows
}
