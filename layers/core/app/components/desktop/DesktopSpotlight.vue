<script setup lang="ts">
import { useDesktopStore } from '../../stores/desktop'

const { isOpen, closeSpotlight } = useSpotlight()
const store = useDesktopStore()
const { openApp } = useWindowManager()
const { t } = useI18n()

/** v-model:open のバインド */
const open = computed({
  get: () => isOpen.value,
  set: (v: boolean) => { isOpen.value = v }
})

/** コマンドパレット用グループ */
const groups = computed(() => [
  {
    id: 'apps',
    label: t('core.desktop.spotlight.apps'),
    items: store.apps.map(a => ({
      label: t(a.nameKey),
      icon: a.icon,
      onSelect: () => {
        openApp(a.id)
        closeSpotlight()
      }
    }))
  },
  ...(store.activeWindows.length > 0
    ? [{
        id: 'windows',
        label: t('core.desktop.spotlight.windows'),
        items: store.activeWindows.map(w => ({
          label: w.title,
          icon: w.icon,
          onSelect: () => {
            store.focusWindow(w.id)
            closeSpotlight()
          }
        }))
      }]
    : [])
])
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'p-0 overflow-hidden max-w-lg sm:max-w-xl', body: 'p-0' }"
  >
    <template #content>
      <UCommandPalette
        :groups="groups"
        :placeholder="$t('core.desktop.spotlight.placeholder')"
        :ui="{ root: 'rounded-xl' }"
        autofocus
        @update:open="(v: boolean) => { if (!v) closeSpotlight() }"
      />
    </template>
  </UModal>
</template>
