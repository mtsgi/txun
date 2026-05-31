import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  DesktopFileSystemError,
  useFileSystemStore
} from '../../layers/core/app/stores/filesystem'

describe('useFileSystemStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with empty mounts', () => {
    const store = useFileSystemStore()
    expect(store.mounts).toHaveLength(0)
    expect(store.activeMountId).toBeNull()
  })

  it('resolves relative path from cwd', () => {
    const store = useFileSystemStore()
    expect(store.resolvePath('/home/user', '../docs/file.txt')).toBe('/home/docs/file.txt')
  })

  it('fails to add mount when browser API is unavailable', async () => {
    const store = useFileSystemStore()
    await expect(store.addMount()).rejects.toBeInstanceOf(DesktopFileSystemError)
  })

  it('marks state as restored even without browser API', async () => {
    const store = useFileSystemStore()
    await store.restoreMounts()
    expect(store.isRestored).toBe(true)
  })
})
