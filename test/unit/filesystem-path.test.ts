import { describe, expect, it } from 'vitest'
import {
  basenameFsPath,
  dirnameFsPath,
  normalizeFsPath,
  resolveFsPath,
  splitFsPath,
  toRelativeFsPath
} from '../../layers/core/app/utils/filesystem-path'

describe('filesystem-path utilities', () => {
  it('normalizes relative and duplicate segments', () => {
    expect(normalizeFsPath('foo//bar/../baz')).toBe('/foo/baz')
  })

  it('normalizes root for empty value', () => {
    expect(normalizeFsPath('')).toBe('/')
    expect(normalizeFsPath('   ')).toBe('/')
  })

  it('resolves absolute target path', () => {
    expect(resolveFsPath('/home/user', '/etc')).toBe('/etc')
  })

  it('resolves relative target path', () => {
    expect(resolveFsPath('/home/user', '../docs/readme.md')).toBe('/home/docs/readme.md')
  })

  it('returns dirname and basename', () => {
    expect(dirnameFsPath('/home/user/file.txt')).toBe('/home/user')
    expect(basenameFsPath('/home/user/file.txt')).toBe('file.txt')
  })

  it('splits path into segments', () => {
    expect(splitFsPath('/a/b/c')).toEqual(['a', 'b', 'c'])
    expect(splitFsPath('/')).toEqual([])
  })

  it('converts to relative path', () => {
    expect(toRelativeFsPath('/a/b/c')).toBe('a/b/c')
    expect(toRelativeFsPath('/')).toBe('')
  })
})
