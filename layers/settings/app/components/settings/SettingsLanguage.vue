<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'

const store = useDesktopStore()
const { locales } = useI18n()
const { setLocale } = useWindowManager()

const localeOptions = computed<SelectItem[]>(() =>
  locales.value.map(l => ({
    label: (l as { name?: string }).name ?? l.code,
    value: l.code
  }))
)

const selectedLocale = computed({
  get: () => store.locale,
  set: (v: string) => setLocale(v as 'ja' | 'en')
})
</script>

<template>
  <div class="section-content">
    <h3 class="section-title">
      {{ $t('apps.settings.language') }}
    </h3>
    <div class="field">
      <USelect
        v-model="selectedLocale"
        :items="localeOptions"
        value-key="value"
        class="w-48"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.section-content {
  padding: 1.25rem;

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }
}

.field {
  margin-bottom: 1.25rem;
}
</style>
