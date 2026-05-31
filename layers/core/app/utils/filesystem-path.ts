/**
 * ファイルシステム内部で扱う絶対パスを正規化する。
 * @param path - 正規化対象のパス
 * @returns 先頭 `/` を持つ正規化済み絶対パス
 */
export function normalizeFsPath(path: string): string {
  const raw = path.trim().replace(/\\/g, '/')
  if (!raw) return '/'

  const initial = raw.startsWith('/') ? raw : `/${raw}`
  const parts = initial.split('/')
  const normalized: string[] = []

  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      normalized.pop()
      continue
    }
    normalized.push(part)
  }

  return normalized.length > 0 ? `/${normalized.join('/')}` : '/'
}

/**
 * 絶対パスをセグメント配列へ分解する。
 * @param path - 分解対象のパス
 * @returns 先頭 `/` を除いたパスセグメント配列
 */
export function splitFsPath(path: string): string[] {
  const normalized = normalizeFsPath(path)
  if (normalized === '/') return []
  return normalized.slice(1).split('/')
}

/**
 * 絶対パスの親ディレクトリを返す。
 * @param path - 対象パス
 * @returns 親ディレクトリの絶対パス
 */
export function dirnameFsPath(path: string): string {
  const segments = splitFsPath(path)
  if (segments.length <= 1) return '/'
  return `/${segments.slice(0, -1).join('/')}`
}

/**
 * 絶対パスの末尾名を返す。
 * @param path - 対象パス
 * @returns 末尾のファイル名またはディレクトリ名
 */
export function basenameFsPath(path: string): string {
  const segments = splitFsPath(path)
  return segments.at(-1) ?? ''
}

/**
 * パスを連結して正規化する。
 * @param base - ベースパス
 * @param segments - 連結するパスセグメント
 * @returns 正規化済み絶対パス
 */
export function joinFsPath(base: string, ...segments: string[]): string {
  return normalizeFsPath([base, ...segments].join('/'))
}

/**
 * 現在ディレクトリを基準に相対パスを解決する。
 * @param cwd - 現在ディレクトリ（絶対パス）
 * @param target - 解決対象パス（相対または絶対）
 * @returns 解決済み絶対パス
 */
export function resolveFsPath(cwd: string, target: string): string {
  const trimmed = target.trim()
  if (!trimmed) return normalizeFsPath(cwd)
  if (trimmed.startsWith('/')) return normalizeFsPath(trimmed)
  return joinFsPath(cwd, trimmed)
}

/**
 * 絶対パスをルート相対パスへ変換する。
 * @param path - 絶対パス
 * @returns 先頭 `/` を除いた相対パス
 */
export function toRelativeFsPath(path: string): string {
  const normalized = normalizeFsPath(path)
  return normalized === '/' ? '' : normalized.slice(1)
}
