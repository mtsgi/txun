<script setup lang="ts">
import type { AppFont, AppRadius } from '../../../../../core/app/stores/desktop'

defineProps<{ windowId: string }>()

const store = useDesktopStore()
const colorMode = useColorMode()
const appConfig = useAppConfig()
const { t } = useI18n()
const { setLocale } = useWindowManager()

const langs = [
  { label: '日本語', value: 'ja' as const },
  { label: 'English', value: 'en' as const }
]

/** コンテナ幅に応じてモバイルレイアウトかどうかを判定する */
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(480)

onMounted(() => {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) containerWidth.value = entry.contentRect.width
  })
  ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})

const isMobile = computed(() => containerWidth.value < 480)

/** モバイル時の選択セクション（null = リスト表示） */
const activeSection = ref<string | null>(null)

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

const radiusOptions: { value: AppRadius, label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' }
]

const wallpaperPresets = [
  { id: 'gradient-default', label: 'Default', css: 'linear-gradient(to bottom right, var(--ui-primary), #1a1a1a, #0a0a0a)' },
  { id: 'gradient-sunset', label: 'Sunset', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)' },
  { id: 'gradient-ocean', label: 'Ocean', css: 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)' },
  { id: 'gradient-midnight', label: 'Midnight', css: 'linear-gradient(to bottom, #020617, #0f172a, #1e1b4b)' },
  { id: 'gradient-forest', label: 'Forest', css: 'linear-gradient(135deg, #166534 0%, #065f46 50%, #0a0a0a 100%)' },
  { id: 'solid-dark', label: 'Dark', css: '#0a0a0a' },
  { id: 'solid-light', label: 'Light', css: '#e5e7eb' }
]

const tabs = computed(() => [
  { label: t('apps.settings.appearance'), icon: 'i-lucide-palette', slot: 'appearance' },
  { label: t('apps.settings.wallpaper'), icon: 'i-lucide-image', slot: 'wallpaper' },
  { label: t('apps.settings.font'), icon: 'i-lucide-type', slot: 'font' },
  { label: t('apps.settings.language'), icon: 'i-lucide-globe', slot: 'language' }
])

/** colorMode 変更をストアに同期 */
watch(() => colorMode.preference, (v) => {
  if (v === 'dark' || v === 'light') store.setTheme(v)
})

function applyColor(color: string) {
  store.setPrimaryColor(color)
  const ui = appConfig.ui as unknown as Record<string, Record<string, string>>
  ui.colors = { ...ui.colors, primary: color }
}

function applyFont(font: AppFont) {
  store.setFont(font)
  document.documentElement.style.setProperty('--app-font', FONT_FAMILIES[font])
}

function applyRadius(radius: AppRadius) {
  store.setRadius(radius)
  document.documentElement.style.setProperty('--ui-radius', RADIUS_VALUES[radius])
}

onMounted(() => {
  // ストアに保存された角丸設定を CSS 変数に反映する
  const savedRadius = store.radius
  if (savedRadius in RADIUS_VALUES) {
    document.documentElement.style.setProperty('--ui-radius', RADIUS_VALUES[savedRadius])
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="settings-app"
  >
    <!-- PC: UTabs 縦型 2カラム -->
    <UTabs
      v-if="!isMobile"
      orientation="vertical"
      :items="tabs"
      :ui="{ root: 'h-full items-start', list: 'border-r border-(--ui-border) w-40 self-stretch', content: 'flex-1 overflow-y-auto' }"
    >
      <template #appearance>
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
                <div class="radius-preview" :style="{ borderRadius: RADIUS_VALUES[r.value] }" />
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
        </div>
      </template>

      <template #wallpaper>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.wallpaper') }}
          </h3>
          <div class="wallpaper-presets">
            <button
              v-for="wp in wallpaperPresets"
              :key="wp.id"
              class="wallpaper-swatch"
              :class="store.wallpaper === wp.id ? 'active' : ''"
              :style="{ background: wp.css }"
              :title="wp.label"
              @click="store.setWallpaper(wp.id)"
            />
          </div>
        </div>
      </template>

      <template #font>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.font') }}
          </h3>
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
        </div>
      </template>

      <template #language>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.language') }}
          </h3>
          <div class="field">
            <div class="option-row">
              <UButton
                v-for="l in langs"
                :key="l.value"
                :label="l.label"
                :variant="store.locale === l.value ? 'solid' : 'outline'"
                :color="store.locale === l.value ? 'primary' : 'neutral'"
                @click="setLocale(l.value)"
              />
            </div>
          </div>
        </div>
      </template>
    </UTabs>

    <!-- SP: iOS スタイル階層ナビ -->
    <template v-else>
      <!-- セクション一覧 -->
      <Transition name="section-slide">
        <div
          v-if="activeSection === null"
          class="mobile-list"
        >
          <button
            v-for="tab in tabs"
            :key="tab.slot"
            class="mobile-list-item"
            @click="activeSection = tab.slot"
          >
            <UIcon
              :name="tab.icon"
              class="list-icon"
            />
            <span>{{ tab.label }}</span>
            <UIcon
              name="i-lucide-chevron-right"
              class="list-chevron"
            />
          </button>
        </div>
      </Transition>

      <!-- セクション詳細 -->
      <Transition name="section-slide">
        <div
          v-if="activeSection !== null"
          class="mobile-detail"
        >
          <div class="mobile-detail-header">
            <UButton
              icon="i-lucide-arrow-left"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="activeSection = null"
            />
            <span class="detail-title">{{
              tabs.find(t => t.slot === activeSection)?.label
            }}</span>
          </div>

          <!-- 外観 -->
          <div
            v-if="activeSection === 'appearance'"
            class="section-content"
          >
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
                  <div class="radius-preview" :style="{ borderRadius: RADIUS_VALUES[r.value] }" />
                  <span>{{ r.label }}</span>
                </button>
              </div>
            </div>
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
          </div>

          <!-- 壁紙 -->
          <div
            v-if="activeSection === 'wallpaper'"
            class="section-content"
          >
            <div class="wallpaper-presets">
              <button
                v-for="wp in wallpaperPresets"
                :key="wp.id"
                class="wallpaper-swatch"
                :class="store.wallpaper === wp.id ? 'active' : ''"
                :style="{ background: wp.css }"
                :title="wp.label"
                @click="store.setWallpaper(wp.id)"
              />
            </div>
          </div>

          <!-- フォント -->
          <div
            v-if="activeSection === 'font'"
            class="section-content"
          >
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
          </div>

          <!-- 言語 -->
          <div
            v-if="activeSection === 'language'"
            class="section-content"
          >
            <div class="field">
              <div class="option-row">
                <UButton
                  v-for="l in langs"
                  :key="l.value"
                  :label="l.label"
                  :variant="store.locale === l.value ? 'solid' : 'outline'"
                  :color="store.locale === l.value ? 'primary' : 'neutral'"
                  @click="setLocale(l.value)"
                />
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.settings-app {
  height: 100%;
  overflow: hidden;
}

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

// SP: セクションリスト
.mobile-list {
  display: flex;
  flex-direction: column;
}

.mobile-list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: none;
  background: none;
  border-bottom: 1px solid var(--ui-border);
  cursor: pointer;
  color: inherit;
  text-align: left;
  font-size: 0.9375rem;
  transition: background-color 0.1s;

  &:hover {
    background: var(--ui-bg-elevated);
  }

  .list-icon {
    font-size: 1.125rem;
    color: var(--ui-primary);
  }

  .list-chevron {
    margin-left: auto;
    font-size: 1rem;
    color: var(--ui-text-muted);
  }
}

// SP: 詳細ビュー
.mobile-detail {
  display: flex;
  flex-direction: column;
  height: 100%;

  .mobile-detail-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);

    .detail-title {
      font-size: 0.9375rem;
      font-weight: 600;
    }
  }
}

// SP スライドアニメーション
.section-slide-enter-active,
.section-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  position: absolute;
  width: 100%;
}

.section-slide-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.section-slide-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

// 角丸オプション
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

// 壁紙プリセット
.wallpaper-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
  gap: 0.75rem;
}

.wallpaper-swatch {
  height: 4rem;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  outline: none;

  &:hover {
    transform: scale(1.04);
  }

  &.active {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 2px var(--ui-bg), 0 0 0 4px var(--ui-primary);
  }
}
</style>
