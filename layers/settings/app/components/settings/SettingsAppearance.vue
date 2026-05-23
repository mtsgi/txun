<script setup lang="ts">
import type { AppRadius, AppUIScale } from '#layers/txunos-core/app/stores/desktop'

const store = useDesktopStore()
const colorMode = useColorMode()
const appConfig = useAppConfig()

const colorOptions = [
  { value: 'violet', hex: '#7c3aed', label: 'Violet' },
  { value: 'indigo', hex: '#4f46e5', label: 'Indigo' },
  { value: 'blue', hex: '#2563eb', label: 'Blue' },
  { value: 'sky', hex: '#0ea5e9', label: 'Sky' },
  { value: 'teal', hex: '#14b8a6', label: 'Teal' },
  { value: 'green', hex: '#16a34a', label: 'Green' },
  { value: 'orange', hex: '#ea580c', label: 'Orange' },
  { value: 'red', hex: '#dc2626', label: 'Red' },
  { value: 'pink', hex: '#db2777', label: 'Pink' }
]

const themeOptions = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
] as const

const RADIUS_VALUES: Record<AppRadius, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem'
}

const DESKTOP_RADIUS_VALUES: Record<AppRadius, string> = {
  none: '0',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem'
}

const radiusOptions: { value: AppRadius, label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' }
]

const { t } = useI18n()

/** UI スケールの選択肢 */
const uiScaleOptions = computed(() => [
  { value: 'sm', label: t('apps.settings.uiScaleSm') },
  { value: 'md', label: t('apps.settings.uiScaleMd') },
  { value: 'lg', label: t('apps.settings.uiScaleLg') }
])

/** UI スケール選択の双方向バインディング */
const selectedUIScale = computed({
  get: (): AppUIScale => store.uiScale,
  set: (v: AppUIScale) => store.setUIScale(v)
})

function applyColor(color: string): void {
  store.setPrimaryColor(color)
  const ui = appConfig.ui as unknown as Record<string, Record<string, string>>
  ui.colors = { ...ui.colors, primary: color }
}

function applyRadius(radius: AppRadius): void {
  store.setRadius(radius)
  document.documentElement.style.setProperty('--ui-radius', RADIUS_VALUES[radius])
  document.documentElement.style.setProperty('--desktop-radius', DESKTOP_RADIUS_VALUES[radius])
}

/** colorMode 変更をストアに同期 */
watch(() => colorMode.preference, (v) => {
  if (v === 'dark' || v === 'light') store.setTheme(v)
})

onMounted(() => {
  // ストアに保存された角丸設定を CSS 変数に反映する
  const savedRadius = store.radius
  if (savedRadius in RADIUS_VALUES) {
    document.documentElement.style.setProperty('--ui-radius', RADIUS_VALUES[savedRadius])
    document.documentElement.style.setProperty('--desktop-radius', DESKTOP_RADIUS_VALUES[savedRadius])
  }
})
</script>

<template>
  <div class="section-content">
    <h3 class="section-title">
      {{ $t('apps.settings.appearance') }}
    </h3>
    <!-- テーマ -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.theme') }}
      </p>
      <div class="option-row">
        <UButton
          v-for="th in themeOptions"
          :key="th.value"
          :icon="th.icon"
          :label="th.label"
          :variant="colorMode.preference === th.value ? 'solid' : 'outline'"
          :color="colorMode.preference === th.value ? 'primary' : 'neutral'"
          size="sm"
          @click="colorMode.preference = th.value"
        />
      </div>
    </div>
    <!-- 角丸 -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.radius') }}
      </p>
      <div class="radius-options">
        <button
          v-for="r in radiusOptions"
          :key="r.value"
          class="radius-option"
          :class="store.radius === r.value ? 'active' : ''"
          @click="applyRadius(r.value)"
        >
          <div
            class="radius-preview"
            :style="{ borderRadius: RADIUS_VALUES[r.value] }"
          />
          <span>{{ r.label }}</span>
        </button>
      </div>
    </div>
    <!-- アクセントカラー -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.primaryColor') }}
      </p>
      <div class="color-swatches">
        <button
          v-for="c in colorOptions"
          :key="c.value"
          class="color-swatch"
          :class="store.primaryColor === c.value ? 'active' : ''"
          :style="{ backgroundColor: c.hex }"
          :title="c.label"
          @click="applyColor(c.value)"
        />
      </div>
    </div>
    <!-- UI サイズ -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.uiScale') }}
      </p>
      <USelect
        v-model="selectedUIScale"
        :items="uiScaleOptions"
        value-key="value"
        class="w-40"
      />
    </div>
    <!-- 背景透過 -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.backgroundOpacity') }}
        <span class="field-value-hint">{{ store.backgroundOpacity }}%</span>
      </p>
      <USlider
        :model-value="store.backgroundOpacity"
        :min="50"
        :max="100"
        :step="5"
        class="w-full"
        @update:model-value="v => store.setBackgroundOpacity(v ?? store.backgroundOpacity)"
      />
    </div>
    <!-- 背景ぼかし -->
    <div class="field field-inline">
      <p class="field-label">
        {{ $t('apps.settings.backgroundBlur') }}
      </p>
      <USwitch
        :model-value="store.backgroundBlur"
        @update:model-value="store.setBackgroundBlur($event)"
      />
    </div>
    <!-- セーフエリア -->
    <div class="field field-inline">
      <div>
        <p class="field-label">
          {{ $t('apps.settings.safeArea') }}
        </p>
        <p class="field-desc">
          {{ $t('apps.settings.safeAreaDesc') }}
        </p>
      </div>
      <USwitch
        :model-value="store.safeArea"
        @update:model-value="store.setSafeArea($event)"
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

.field-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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

.field-value-hint {
  font-weight: 400;
  opacity: 0.7;
}

.field-desc {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  margin: 0;
  opacity: 0.7;
}

.option-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.color-swatches {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.color-swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  outline: none;

  &:hover {
    transform: scale(1.1);
  }

  &.active {
    border-color: var(--ui-text);
    box-shadow: 0 0 0 2px var(--ui-bg), 0 0 0 4px var(--ui-text);
  }
}

.radius-options {
  display: flex;
  gap: 0.5rem;
}

.radius-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  background: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 0.75rem;
  transition: background-color 0.1s, border-color 0.1s;

  &:hover {
    background: var(--ui-bg-elevated);
  }

  &.active {
    border-color: var(--ui-primary);
    background: color-mix(in srgb, var(--ui-primary) 8%, transparent);
    color: var(--ui-primary);
  }

  .radius-preview {
    width: 2rem;
    height: 1.5rem;
    border: 2px solid currentColor;
  }
}
</style>
