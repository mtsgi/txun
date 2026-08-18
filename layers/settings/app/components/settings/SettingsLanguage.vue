<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import type { TimeFormat } from '#layers/txunos-core/app/stores/desktop'

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
      {{ $t('apps.settings.languageAndTime') }}
    </h3>

    <!-- 言語設定 -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.language') }}
      </p>
      <USelect
        v-model="selectedLocale"
        :items="localeOptions"
        value-key="value"
        class="w-48"
      />
    </div>

    <!-- 時刻表示形式 -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.timeFormat') }}
      </p>
      <div class="option-row">
        <UButton
          v-for="fmt in (['24h', '12h'] as TimeFormat[])"
          :key="fmt"
          :label="fmt === '24h' ? $t('apps.settings.timeFormat24h') : $t('apps.settings.timeFormat12h')"
          :variant="store.timeFormat === fmt ? 'solid' : 'outline'"
          :color="store.timeFormat === fmt ? 'primary' : 'neutral'"
          size="sm"
          @click="store.setTimeFormat(fmt)"
        />
      </div>
    </div>

    <!-- 秒表示トグル -->
    <div class="field">
      <div class="toggle-field">
        <div class="toggle-info">
          <p class="field-label">
            {{ $t('apps.settings.showSeconds') }}
          </p>
          <p class="field-desc">
            {{ $t('apps.settings.showSecondsDesc') }}
          </p>
        </div>
        <USwitch
          :model-value="store.showSeconds"
          @update:model-value="store.setShowSeconds"
        />
      </div>
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

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.option-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toggle-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.toggle-info {
  flex: 1;

  .field-label {
    margin-bottom: 0.125rem;
  }

  .field-desc {
    font-size: 0.75rem;
    color: var(--ui-text-muted);
    margin: 0;
  }
}
</style>
