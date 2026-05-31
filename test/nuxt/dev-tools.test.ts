import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useNuxtApp } from '#imports'
import DevToolsApp from '../../layers/dev-tools/app/components/apps/DevToolsApp.vue'

describe('DevToolsApp', () => {
  it('mounts correctly and initializes with the json tab', async () => {
    const wrapper = await useNuxtApp().runWithContext(() => {
      return mount(DevToolsApp, {
        props: {
          windowId: 'test-devtools'
        }
      })
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.dev-tools-app').exists()).toBe(true)
    expect((wrapper.vm as unknown as { activeTab: string }).activeTab).toBe('json')
  })
})
