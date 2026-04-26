<script setup lang="ts">
import type { AppFont } from '../../../../../core/app/stores/desktop'

defineProps<{ windowId: string }>()

const store = useDesktopStore()
const colorMode = useColorMode()
const { setLocale } = useI18n()
const appConfig = useAppConfig()

const themes = [
  { label: 'Dark', value: 'dark' as const, icon: 'i-lucide-moon' },
  { label: 'Light', value: 'light' as const, icon: 'i-lucide-sun' }
]

const langs = [
  { label: '日本語', value: 'ja' },
  { label: 'English', value: 'en' }
]

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

const fontOptions: { value: AppFont, label: string, preview: string }[] = [
  { value: 'system', label: 'System', preview: 'The quick brown fox' },
  { value: 'sans', label: 'Sans', preview: 'The quick brown fox' },
  { value: 'mono', label: 'Mono', preview: 'The quick brown fox' },
  { value: 'serif', label: 'Serif', preview: 'The quick brown fox' }
]

const FONT_FAMILIES: Record<AppFont, string> = {
  system: 'system-ui, -apple-system, sans-serif',
  sans: '\'Public Sans\', sans-serif',
  mono: 'ui-monospace, monospace',
  serif: 'ui-serif, Georgia, serif'
}

function applyTheme(theme: 'light' | 'dark') {
  store.setTheme(theme)
  colorMode.preference = theme
}

function applyLocale(code: string) {
  if (code !== 'ja' && code !== 'en') return
  store.setLocale(code)
  setLocale(code)
}

function applyColor(color: string) {
  store.setPrimaryColor(color)
  const ui = appConfig.ui as unknown as Record<string, Record<string, string>>
  ui.colors = { ...ui.colors, primary: color }
}

function applyFont(font: AppFont) {
  store.setFont(font)
  document.documentElement.style.setProperty('--app-font', FONT_FAMILIES[font])
}
</script>

<template>
  <div class="settings-app">
    <h2 class="settings-title">
      {{ $t('apps.settings.name') }}
    </h2>

    <div class="settings-sections">
      <!-- Theme -->
      <section class="settings-section">
        <h3>{{ $t('apps.settings.theme') }}</h3>
        <div class="option-row">
          <UButton
            v-for="t in themes"
            :key="t.value"
            :icon="t.icon"
            :label="t.label"
            :variant="store.theme === t.value ? 'solid' : 'outline'"
            :color="store.theme === t.value ? 'primary' : 'neutral'"
            @click="applyTheme(t.value)"
          />
        </div>
      </section>

      <!-- Primary Color -->
      <section class="settings-section">
        <h3>{{ $t('apps.settings.primaryColor') }}</h3>
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
      </section>

      <!-- Font -->
      <section class="settings-section">
        <h3>{{ $t('apps.settings.font') }}</h3>
        <div class="font-options">
          <button
            v-for="f in fontOptions"
            :key="f.value"
            class="font-option"
            :class="store.font === f.value ? 'active' : ''"
            @click="applyFont(f.value)"
          >
            <span class="font-label">{{ f.label }}</span>
            <span
              class="font-preview"
              :style="{ fontFamily: FONT_FAMILIES[f.value] }"
            >{{ f.preview }}</span>
          </button>
        </div>
      </section>

      <!-- Language -->
      <section class="settings-section">
        <h3>{{ $t('apps.settings.language') }}</h3>
        <div class="option-row">
          <UButton
            v-for="l in langs"
            :key="l.value"
            :label="l.label"
            :variant="store.locale === l.value ? 'solid' : 'outline'"
            :color="store.locale === l.value ? 'primary' : 'neutral'"
            @click="applyLocale(l.value)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-app {
  padding: 1.5rem;
  overflow-y: auto;
  height: 100%;

  .settings-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
  }

  .settings-sections {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;

    @container (min-width: 480px) {
      grid-template-columns: 1fr 1fr;
      gap: 0 2rem;
    }
  }

  .settings-section {
    margin-bottom: 1.5rem;

    h3 {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--ui-text-muted);
      margin: 0 0 0.5rem;
    }
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

  .font-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .font-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s, border-color 0.1s;
    color: inherit;
    width: 100%;

    &:hover {
      background: var(--ui-bg-elevated);
    }

    &.active {
      border-color: var(--ui-primary);
      background: color-mix(in srgb, var(--ui-primary) 8%, transparent);
    }

    .font-label {
      font-size: 0.875rem;
      font-weight: 500;
      min-width: 4rem;
    }

    .font-preview {
      font-size: 0.875rem;
      color: var(--ui-text-muted);
    }
  }
}
</style>
