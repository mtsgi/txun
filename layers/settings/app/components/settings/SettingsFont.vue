<script setup lang="ts">
import type { AppFont, AppFontSize } from '#layers/txunos-core/app/stores/desktop'

const store = useDesktopStore()
const { t } = useI18n()

const FONT_FAMILIES: Record<AppFont, string> = {
  'system': 'system-ui, -apple-system, sans-serif',
  'sans': '\'Public Sans\', sans-serif',
  'mono': 'ui-monospace, monospace',
  'serif': 'ui-serif, Georgia, serif',
  'inter': '\'Inter\', sans-serif',
  'poppins': '\'Poppins\', sans-serif',
  'noto-sans-jp': '\'Noto Sans JP\', system-ui, sans-serif',
  'biz-ud-gothic': '\'BIZ UDPGothic\', sans-serif',
  'zen-kaku-gothic-antique': '\'Zen Kaku Gothic Antique\', sans-serif'
}

/** ロケール設定に応じたフォントプレビューテキスト（i18n キー経由） */
const fontPreviewText = computed(() => t('apps.settings.fontPreview'))

/** USelect 用フォント選択肢 */
const fontSelectOptions = computed(() => [
  { value: 'system', label: 'System' },
  { value: 'sans', label: 'Sans (Public Sans)' },
  { value: 'mono', label: 'Mono' },
  { value: 'serif', label: 'Serif' },
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'noto-sans-jp', label: 'Noto Sans JP' },
  { value: 'biz-ud-gothic', label: 'BIZ UDPGothic' },
  { value: 'zen-kaku-gothic-antique', label: 'Zen Kaku Gothic Antique' }
])

/** フォントサイズの選択肢 */
const fontSizeOptions = computed(() => [
  { value: 'sm', label: t('apps.settings.fontSizeSm') },
  { value: 'md', label: t('apps.settings.fontSizeMd') },
  { value: 'lg', label: t('apps.settings.fontSizeLg') },
  { value: 'xl', label: t('apps.settings.fontSizeXl') }
])

function applyFont(font: AppFont): void {
  store.setFont(font)
  document.documentElement.style.setProperty('--app-font', FONT_FAMILIES[font])
}

/** フォント選択の双方向バインディング */
const selectedFont = computed({
  get: (): AppFont => store.font,
  set: (v: AppFont) => applyFont(v)
})

/** フォントサイズ選択の双方向バインディング */
const selectedFontSize = computed({
  get: (): AppFontSize => store.fontSize,
  set: (v: AppFontSize) => store.setFontSize(v)
})
</script>

<template>
  <div class="section-content">
    <h3 class="section-title">
      {{ $t('apps.settings.font') }}
    </h3>
    <!-- フォント選択 -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.fontFamily') }}
      </p>
      <USelect
        v-model="selectedFont"
        :items="fontSelectOptions"
        value-key="value"
        class="w-56"
      />
      <p
        class="font-preview-sample"
        :style="{ fontFamily: FONT_FAMILIES[store.font] }"
      >
        {{ fontPreviewText }}
      </p>
    </div>
    <!-- フォントサイズ -->
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.fontSize') }}
      </p>
      <USelect
        v-model="selectedFontSize"
        :items="fontSizeOptions"
        value-key="value"
        class="w-40"
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

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.font-preview-sample {
  margin-top: 0.5rem;
  font-size: 1rem;
  color: var(--ui-text-muted);
}
</style>
