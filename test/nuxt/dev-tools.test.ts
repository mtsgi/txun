import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DevToolsApp from '../../layers/dev-tools/app/components/apps/DevToolsApp.vue'

describe('DevToolsApp', () => {
  it('mounts correctly and initializes with the json tab', async () => {
    const wrapper = await mountSuspended(DevToolsApp, {
      props: {
        windowId: 'test-devtools'
      }
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.dev-tools-app').exists()).toBe(true)
    expect((wrapper.vm as unknown as { activeTab: string }).activeTab).toBe('json')
  })
})
