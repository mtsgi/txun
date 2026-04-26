<script setup lang="ts">
defineProps<{ windowId: string }>()

const url = ref('https://example.com')
const inputUrl = ref('https://example.com')
const iframeRef = ref<HTMLIFrameElement | null>(null)

function navigate() {
  let target = inputUrl.value.trim()
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target
  url.value = target
  inputUrl.value = target
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') navigate()
}
</script>

<template>
  <div class="browser-app">
    <div class="address-bar">
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        @click="navigate"
      />
      <UInput
        v-model="inputUrl"
        size="sm"
        :placeholder="$t('apps.browser.addressBar')"
        @keydown="onKeydown"
      />
    </div>
    <iframe
      ref="iframeRef"
      :src="url"
      class="browser-frame"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title="Browser"
    />
  </div>
</template>

<style lang="scss" scoped>
.browser-app {
  display: flex;
  flex-direction: column;
  height: 100%;

  .address-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;
  }

  .browser-frame {
    flex: 1 1 0%;
    min-height: 0;
    border: none;
    background: #fff;
    width: 100%;
    display: block;
  }
}
</style>
