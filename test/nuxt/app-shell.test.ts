import { describe, expect, it } from 'vitest'
import { useDesktopStore, useNuxtApp } from '#imports'

describe('Nuxt integration smoke', () => {
  it('registers built-in apps from all app layers', () => {
    const appIds = useNuxtApp().runWithContext(() => {
      const store = useDesktopStore()
      return store.apps.map(app => app.id)
    })

    expect(appIds).toEqual(expect.arrayContaining([
      'browser',
      'calculator',
      'calendar',
      'clock',
      'file-manager',
      'image-viewer',
      'settings',
      'sticky-notes',
      'task-manager',
      'terminal',
      'text-editor'
    ]))
    expect(appIds).toHaveLength(11)
  })
})
