<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import type { AppFont, AppRadius, AppUIScale, AppFontSize, TaskbarPosition, TaskbarSize, TaskbarTaskAlign, TaskbarTaskDisplay } from '#layers/txunos-core/app/stores/desktop'
import licenseNuxt from '../../../../../node_modules/nuxt/LICENSE?raw'
import licenseNuxtUi from '../../../../../node_modules/@nuxt/ui/LICENSE.md?raw'
import licenseVue from '../../../../../node_modules/vue/LICENSE?raw'
import licensePinia from '../../../../../node_modules/pinia/LICENSE?raw'
import licenseI18n from '../../../../../node_modules/@nuxtjs/i18n/LICENSE?raw'
import licenseProseMirror from '../../../../../node_modules/prosemirror-state/LICENSE?raw'

defineProps<{ windowId: string }>()

const store = useDesktopStore()
const colorMode = useColorMode()
const appConfig = useAppConfig()
const { t, locales } = useI18n()
const { setLocale } = useWindowManager()

const deviceStore = useDeviceStore()
/** 接続試行中の API 識別子（'bluetooth' | 'hid' | 'serial' | null） */
const deviceConnecting = ref<string | null>(null)

/** ブラウザの Web Bluetooth API 対応状況 */
const hasBluetooth = computed(() => import.meta.client && 'bluetooth' in navigator)
/** ブラウザの WebHID API 対応状況 */
const hasHid = computed(() => import.meta.client && 'hid' in navigator)
/** ブラウザの Web Serial API 対応状況 */
const hasSerial = computed(() => import.meta.client && 'serial' in navigator)

/** Bluetooth デバイスへの接続を試みる */
async function handleConnectBluetooth(): Promise<void> {
  deviceConnecting.value = 'bluetooth'
  try {
    await deviceStore.connectBluetooth()
  } catch {
    // ユーザーによるキャンセルまたはエラーは無視
  } finally {
    deviceConnecting.value = null
  }
}

/** HID デバイスへの接続を試みる */
async function handleConnectHid(): Promise<void> {
  deviceConnecting.value = 'hid'
  try {
    await deviceStore.connectHid()
  } catch {
    // ユーザーによるキャンセルまたはエラーは無視
  } finally {
    deviceConnecting.value = null
  }
}

/** シリアルポートへの接続を試みる */
async function handleConnectSerial(): Promise<void> {
  deviceConnecting.value = 'serial'
  try {
    await deviceStore.connectSerial()
  } catch {
    // ユーザーによるキャンセルまたはエラーは無視
  } finally {
    deviceConnecting.value = null
  }
}

/** Gamepad ポーリング用 RAF ID */
let gamepadRafId: number | null = null

function pollGamepads(): void {
  deviceStore.updateGamepads()
  gamepadRafId = requestAnimationFrame(pollGamepads)
}

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

/** ロケール設定に応じたフォントプレビューテキスト（i18n キー経由） */
const fontPreviewText = computed(() => t('apps.settings.fontPreview'))

const fontOptions = computed<{ value: AppFont, label: string, preview: string }[]>(() => [
  { value: 'system', label: 'System', preview: fontPreviewText.value },
  { value: 'sans', label: 'Sans (Public Sans)', preview: fontPreviewText.value },
  { value: 'mono', label: 'Mono', preview: fontPreviewText.value },
  { value: 'serif', label: 'Serif', preview: fontPreviewText.value },
  { value: 'inter', label: 'Inter', preview: fontPreviewText.value },
  { value: 'poppins', label: 'Poppins', preview: fontPreviewText.value },
  { value: 'noto-sans-jp', label: 'Noto Sans JP', preview: fontPreviewText.value },
  { value: 'biz-ud-gothic', label: 'BIZ UDPGothic', preview: fontPreviewText.value },
  { value: 'zen-kaku-gothic-antique', label: 'Zen Kaku Gothic Antique', preview: fontPreviewText.value }
])

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

const wallpaperPresets = [
  { id: 'gradient-default', label: 'Default', css: 'linear-gradient(to bottom right, var(--ui-primary), #1a1a1a, #0a0a0a)' },
  { id: 'gradient-sunset', label: 'Sunset', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)' },
  { id: 'gradient-ocean', label: 'Ocean', css: 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)' },
  { id: 'gradient-midnight', label: 'Midnight', css: 'linear-gradient(to bottom, #020617, #0f172a, #1e1b4b)' },
  { id: 'gradient-forest', label: 'Forest', css: 'linear-gradient(135deg, #166534 0%, #065f46 50%, #0a0a0a 100%)' },
  { id: 'solid-dark', label: 'Dark', css: '#0a0a0a' },
  { id: 'solid-light', label: 'Light', css: '#e5e7eb' }
]

const photoWallpapers = [
  { id: 'photo-10', label: 'Forest', thumbUrl: 'https://picsum.photos/id/10/200/120', wallUrl: 'https://picsum.photos/id/10/1920/1080' },
  { id: 'photo-15', label: 'Mountain', thumbUrl: 'https://picsum.photos/id/15/200/120', wallUrl: 'https://picsum.photos/id/15/1920/1080' },
  { id: 'photo-28', label: 'Sea', thumbUrl: 'https://picsum.photos/id/28/200/120', wallUrl: 'https://picsum.photos/id/28/1920/1080' },
  { id: 'photo-29', label: 'Forest 2', thumbUrl: 'https://picsum.photos/id/29/200/120', wallUrl: 'https://picsum.photos/id/29/1920/1080' },
  { id: 'photo-57', label: 'Sky', thumbUrl: 'https://picsum.photos/id/57/200/120', wallUrl: 'https://picsum.photos/id/57/1920/1080' },
  { id: 'photo-92', label: 'River', thumbUrl: 'https://picsum.photos/id/92/200/120', wallUrl: 'https://picsum.photos/id/92/1920/1080' },
  { id: 'photo-137', label: 'Shore', thumbUrl: 'https://picsum.photos/id/137/200/120', wallUrl: 'https://picsum.photos/id/137/1920/1080' },
  { id: 'photo-177', label: 'Field', thumbUrl: 'https://picsum.photos/id/177/200/120', wallUrl: 'https://picsum.photos/id/177/1920/1080' }
]

const tabs = computed(() => [
  { label: t('apps.settings.appearance'), icon: 'i-lucide-palette', slot: 'appearance' },
  { label: t('apps.settings.wallpaper'), icon: 'i-lucide-image', slot: 'wallpaper' },
  { label: t('apps.settings.font'), icon: 'i-lucide-type', slot: 'font' },
  { label: t('apps.settings.language'), icon: 'i-lucide-globe', slot: 'language' },
  { label: t('apps.settings.taskbar'), icon: 'i-lucide-panel-bottom', slot: 'taskbar' },
  { label: t('apps.settings.device'), icon: 'i-lucide-cpu', slot: 'device' },
  { label: t('apps.settings.about'), icon: 'i-lucide-info', slot: 'about' }
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
  document.documentElement.style.setProperty('--desktop-radius', DESKTOP_RADIUS_VALUES[radius])
}

/** UI スケールの選択肢 */
const uiScaleOptions = computed<SelectItem[]>(() => [
  { value: 'sm', label: t('apps.settings.uiScaleSm') },
  { value: 'md', label: t('apps.settings.uiScaleMd') },
  { value: 'lg', label: t('apps.settings.uiScaleLg') }
])

/** フォントサイズの選択肢 */
const fontSizeOptions = computed<SelectItem[]>(() => [
  { value: 'sm', label: t('apps.settings.fontSizeSm') },
  { value: 'md', label: t('apps.settings.fontSizeMd') },
  { value: 'lg', label: t('apps.settings.fontSizeLg') },
  { value: 'xl', label: t('apps.settings.fontSizeXl') }
])

/** USelect 用フォント選択肢 */
const fontSelectOptions = computed(() =>
  fontOptions.value.map(f => ({ value: f.value, label: f.label }))
)

/** フォント選択の双方向バインディング */
const selectedFont = computed({
  get: () => store.font,
  set: (v: AppFont) => applyFont(v)
})

/** UI スケール選択の双方向バインディング */
const selectedUIScale = computed({
  get: () => store.uiScale,
  set: (v: AppUIScale) => store.setUIScale(v)
})

/** フォントサイズ選択の双方向バインディング */
const selectedFontSize = computed({
  get: () => store.fontSize,
  set: (v: AppFontSize) => store.setFontSize(v)
})

/** Lucide Icons（@iconify-json/lucide）の ISC ライセンス全文 */
const LUCIDE_ISC = `ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`

const ossPackages = [
  { name: 'Nuxt', license: 'MIT', fullText: licenseNuxt },
  { name: 'Nuxt UI', license: 'MIT', fullText: licenseNuxtUi },
  { name: 'Vue', license: 'MIT', fullText: licenseVue },
  { name: 'Pinia', license: 'MIT', fullText: licensePinia },
  { name: '@nuxtjs/i18n', license: 'MIT', fullText: licenseI18n },
  { name: 'ProseMirror', license: 'MIT', fullText: licenseProseMirror },
  { name: 'Lucide Icons', license: 'ISC', fullText: LUCIDE_ISC }
]

/** 展開中の OSS パッケージ名 */
const openOss = ref<string | null>(null)

const wallpaperUrlInput = ref('')

function applyWallpaperUrl(): void {
  const url = wallpaperUrlInput.value.trim()
  if (url) {
    store.setWallpaper(url)
  }
}

onMounted(() => {
  // ストアに保存された角丸設定を CSS 変数に反映する
  const savedRadius = store.radius
  if (savedRadius in RADIUS_VALUES) {
    document.documentElement.style.setProperty('--ui-radius', RADIUS_VALUES[savedRadius])
    document.documentElement.style.setProperty('--desktop-radius', DESKTOP_RADIUS_VALUES[savedRadius])
  }
  // Gamepad イベントリスナー登録・ポーリング開始
  deviceStore.initGamepad()
  gamepadRafId = requestAnimationFrame(pollGamepads)
})

onUnmounted(() => {
  // Gamepad イベントリスナー解除・ポーリング停止
  deviceStore.destroyGamepad()
  if (gamepadRafId !== null) {
    cancelAnimationFrame(gamepadRafId)
    gamepadRafId = null
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
      :ui="{ root: 'h-full items-stretch', list: 'border-r border-(--ui-border) w-40 justify-start', content: 'flex-1 overflow-y-auto' }"
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

      <template #wallpaper>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.wallpaper') }}
          </h3>
          <p class="field-label">
            {{ $t('apps.settings.wallpaperGradients') }}
          </p>
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
          <p class="field-label wallpaper-section-label">
            {{ $t('apps.settings.wallpaperPhotos') }}
          </p>
          <div class="wallpaper-presets">
            <button
              v-for="wp in photoWallpapers"
              :key="wp.id"
              class="wallpaper-swatch"
              :class="store.wallpaper === wp.wallUrl ? 'active' : ''"
              :style="{ backgroundImage: `url(${wp.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }"
              :title="wp.label"
              @click="store.setWallpaper(wp.wallUrl)"
            />
          </div>
          <div
            class="field"
            style="margin-top:1rem"
          >
            <p class="field-label">
              {{ $t('apps.settings.wallpaperUrl') }}
            </p>
            <div class="wallpaper-url-row">
              <UInput
                v-model="wallpaperUrlInput"
                placeholder="https://example.com/image.jpg"
                class="flex-1"
                @keydown.enter="applyWallpaperUrl"
              />
              <UButton
                :label="$t('apps.settings.wallpaperApply')"
                color="primary"
                variant="solid"
                size="sm"
                @click="applyWallpaperUrl"
              />
            </div>
          </div>
        </div>
      </template>

      <template #font>
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

      <template #language>
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

      <template #taskbar>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.taskbar') }}
          </h3>
          <!-- 表示位置 -->
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.taskbarPosition') }}
            </p>
            <div class="option-row">
              <UButton
                v-for="pos in (['top', 'bottom', 'left', 'right'] as TaskbarPosition[])"
                :key="pos"
                :icon="pos === 'top' ? 'i-lucide-panel-top' : pos === 'bottom' ? 'i-lucide-panel-bottom' : pos === 'left' ? 'i-lucide-panel-left' : 'i-lucide-panel-right'"
                :label="$t(`apps.settings.taskbarPosition${pos.charAt(0).toUpperCase() + pos.slice(1)}`)"
                :variant="store.taskbarPosition === pos ? 'solid' : 'outline'"
                :color="store.taskbarPosition === pos ? 'primary' : 'neutral'"
                size="sm"
                @click="store.setTaskbarPosition(pos)"
              />
            </div>
          </div>
          <!-- 大きさ -->
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.taskbarSize') }}
            </p>
            <div class="option-row">
              <UButton
                v-for="size in (['sm', 'md', 'lg'] as TaskbarSize[])"
                :key="size"
                :label="$t(`apps.settings.taskbarSize${size.charAt(0).toUpperCase() + size.slice(1)}`)"
                :variant="store.taskbarSize === size ? 'solid' : 'outline'"
                :color="store.taskbarSize === size ? 'primary' : 'neutral'"
                size="sm"
                @click="store.setTaskbarSize(size)"
              />
            </div>
          </div>
          <!-- タスクの並び位置 -->
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.taskbarTaskAlign') }}
            </p>
            <div class="option-row">
              <UButton
                v-for="align in (['start', 'center', 'end'] as TaskbarTaskAlign[])"
                :key="align"
                :label="$t(`apps.settings.taskbarTaskAlign${align.charAt(0).toUpperCase() + align.slice(1)}`)"
                :variant="store.taskbarTaskAlign === align ? 'solid' : 'outline'"
                :color="store.taskbarTaskAlign === align ? 'primary' : 'neutral'"
                size="sm"
                @click="store.setTaskbarTaskAlign(align)"
              />
            </div>
          </div>
          <!-- タスクの表示 -->
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.taskbarTaskDisplay') }}
            </p>
            <div class="option-row">
              <UButton
                v-for="disp in (['icon', 'icon-label'] as TaskbarTaskDisplay[])"
                :key="disp"
                :label="disp === 'icon' ? $t('apps.settings.taskbarTaskDisplayIcon') : $t('apps.settings.taskbarTaskDisplayIconLabel')"
                :variant="store.taskbarTaskDisplay === disp ? 'solid' : 'outline'"
                :color="store.taskbarTaskDisplay === disp ? 'primary' : 'neutral'"
                size="sm"
                @click="store.setTaskbarTaskDisplay(disp)"
              />
            </div>
          </div>
        </div>
      </template>

      <template #device>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.device') }}
          </h3>

          <!-- Bluetooth -->
          <div class="field">
            <div class="device-section-header">
              <p class="field-label">
                <UIcon
                  name="i-lucide-bluetooth"
                  class="device-api-icon"
                />
                {{ $t('apps.settings.deviceBluetooth') }}
              </p>
              <UButton
                v-if="hasBluetooth"
                size="xs"
                icon="i-lucide-plus"
                :label="$t('apps.settings.deviceConnect')"
                :loading="deviceConnecting === 'bluetooth'"
                variant="outline"
                color="primary"
                @click="handleConnectBluetooth"
              />
            </div>
            <UAlert
              v-if="!hasBluetooth"
              icon="i-lucide-info"
              color="neutral"
              variant="soft"
              :description="$t('apps.settings.deviceNotSupported')"
              class="device-unsupported"
            />
            <div
              v-else-if="deviceStore.bluetoothDevices.length === 0"
              class="device-empty"
            >
              {{ $t('apps.settings.deviceNoDevices') }}
            </div>
            <div
              v-else
              class="device-list"
            >
              <div
                v-for="d in deviceStore.bluetoothDevices"
                :key="d.id"
                class="device-item"
              >
                <UIcon
                  name="i-lucide-bluetooth"
                  class="device-item-icon"
                />
                <span class="device-item-name">{{ d.name }}</span>
                <UButton
                  size="xs"
                  :label="$t('apps.settings.deviceDisconnect')"
                  variant="ghost"
                  color="error"
                  @click="deviceStore.disconnectBluetooth(d.id)"
                />
              </div>
            </div>
          </div>

          <!-- HID -->
          <div class="field">
            <div class="device-section-header">
              <p class="field-label">
                <UIcon
                  name="i-lucide-usb"
                  class="device-api-icon"
                />
                {{ $t('apps.settings.deviceHid') }}
              </p>
              <UButton
                v-if="hasHid"
                size="xs"
                icon="i-lucide-plus"
                :label="$t('apps.settings.deviceConnect')"
                :loading="deviceConnecting === 'hid'"
                variant="outline"
                color="primary"
                @click="handleConnectHid"
              />
            </div>
            <UAlert
              v-if="!hasHid"
              icon="i-lucide-info"
              color="neutral"
              variant="soft"
              :description="$t('apps.settings.deviceNotSupported')"
              class="device-unsupported"
            />
            <div
              v-else-if="deviceStore.hidDevices.length === 0"
              class="device-empty"
            >
              {{ $t('apps.settings.deviceNoDevices') }}
            </div>
            <div
              v-else
              class="device-list"
            >
              <div
                v-for="d in deviceStore.hidDevices"
                :key="d.id"
                class="device-item"
              >
                <UIcon
                  name="i-lucide-usb"
                  class="device-item-icon"
                />
                <span class="device-item-name">{{ d.productName }}</span>
                <span class="device-item-meta">{{ d.vendorId.toString(16).padStart(4, '0') }}:{{ d.productId.toString(16).padStart(4, '0') }}</span>
                <UButton
                  size="xs"
                  :label="$t('apps.settings.deviceDisconnect')"
                  variant="ghost"
                  color="error"
                  @click="deviceStore.disconnectHid(d.id)"
                />
              </div>
            </div>
          </div>

          <!-- シリアル -->
          <div class="field">
            <div class="device-section-header">
              <p class="field-label">
                <UIcon
                  name="i-lucide-plug"
                  class="device-api-icon"
                />
                {{ $t('apps.settings.deviceSerial') }}
              </p>
              <UButton
                v-if="hasSerial"
                size="xs"
                icon="i-lucide-plus"
                :label="$t('apps.settings.deviceConnect')"
                :loading="deviceConnecting === 'serial'"
                variant="outline"
                color="primary"
                @click="handleConnectSerial"
              />
            </div>
            <UAlert
              v-if="!hasSerial"
              icon="i-lucide-info"
              color="neutral"
              variant="soft"
              :description="$t('apps.settings.deviceNotSupported')"
              class="device-unsupported"
            />
            <div
              v-else-if="deviceStore.serialPorts.length === 0"
              class="device-empty"
            >
              {{ $t('apps.settings.deviceNoDevices') }}
            </div>
            <div
              v-else
              class="device-list"
            >
              <div
                v-for="p in deviceStore.serialPorts"
                :key="p.id"
                class="device-item"
              >
                <UIcon
                  name="i-lucide-plug"
                  class="device-item-icon"
                />
                <span class="device-item-name">{{ p.label }}</span>
                <UButton
                  size="xs"
                  :label="$t('apps.settings.deviceDisconnect')"
                  variant="ghost"
                  color="error"
                  @click="deviceStore.disconnectSerial(p.id)"
                />
              </div>
            </div>
          </div>

          <!-- ゲームパッド -->
          <div class="field">
            <p class="field-label">
              <UIcon
                name="i-lucide-gamepad-2"
                class="device-api-icon"
              />
              {{ $t('apps.settings.deviceGamepad') }}
            </p>
            <div
              v-if="deviceStore.gamepads.length === 0"
              class="device-empty"
            >
              {{ $t('apps.settings.deviceGamepadGuide') }}
            </div>
            <div
              v-else
              class="gamepad-list"
            >
              <div
                v-for="gp in deviceStore.gamepads"
                :key="gp.index"
                class="gamepad-card"
              >
                <div class="gamepad-header">
                  <UIcon name="i-lucide-gamepad-2" />
                  <span class="gamepad-name">{{ gp.id }}</span>
                  <UBadge
                    size="xs"
                    :label="gp.connected ? $t('apps.settings.deviceGamepadConnected') : $t('apps.settings.deviceGamepadDisconnected')"
                    :color="gp.connected ? 'success' : 'neutral'"
                    variant="soft"
                  />
                </div>
                <div class="gamepad-buttons-section">
                  <p class="gamepad-sub-label">
                    {{ $t('apps.settings.deviceGamepadButtons') }}
                  </p>
                  <div class="gamepad-buttons">
                    <span
                      v-for="(btn, i) in gp.buttons"
                      :key="i"
                      class="gamepad-btn"
                      :class="btn.pressed ? 'pressed' : ''"
                      :title="$t('apps.settings.deviceGamepadButtonTitle', { index: i, value: (btn.value * 100).toFixed(0) })"
                    />
                  </div>
                </div>
                <div class="gamepad-axes-section">
                  <p class="gamepad-sub-label">
                    {{ $t('apps.settings.deviceGamepadAxes') }}
                  </p>
                  <div class="gamepad-axes">
                    <div
                      v-for="(axis, i) in gp.axes"
                      :key="i"
                      class="gamepad-axis"
                    >
                      <span class="gamepad-axis-label">{{ i }}</span>
                      <div class="gamepad-axis-track">
                        <div
                          class="gamepad-axis-fill"
                          :style="{ left: '50%', width: `${Math.abs(axis) * 50}%`, transform: axis < 0 ? 'translateX(-100%)' : 'translateX(0)' }"
                        />
                        <div
                          class="gamepad-axis-thumb"
                          :style="{ left: `${(axis + 1) / 2 * 100}%` }"
                        />
                      </div>
                      <span class="gamepad-axis-value">{{ axis.toFixed(2) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #about>
        <div class="section-content">
          <h3 class="section-title">
            {{ $t('apps.settings.about') }}
          </h3>
          <div class="about-logo">
            <UIcon
              name="i-lucide-monitor"
              class="about-icon"
            />
            <span class="about-name">TxunOS</span>
          </div>
          <p class="about-desc">
            {{ $t('apps.settings.aboutDescription') }}
          </p>
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.version') }}
            </p>
            <p class="about-value">
              0.1.0
            </p>
          </div>
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.license') }}
            </p>
            <p class="about-value">
              MIT
            </p>
          </div>
          <div class="field">
            <p class="field-label">
              {{ $t('apps.settings.ossLicenses') }}
            </p>
            <div class="oss-list">
              <div
                v-for="oss in ossPackages"
                :key="oss.name"
                class="oss-item"
              >
                <button
                  class="oss-header"
                  @click="openOss = openOss === oss.name ? null : oss.name"
                >
                  <span class="oss-name">{{ oss.name }}</span>
                  <span class="oss-license">{{ oss.license }}</span>
                  <UIcon
                    :name="openOss === oss.name ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="oss-chevron"
                  />
                </button>
                <pre
                  v-if="openOss === oss.name"
                  class="oss-full-text"
                >{{ oss.fullText }}</pre>
              </div>
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

          <div class="mobile-detail-content">
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
                    <div
                      class="radius-preview"
                      :style="{ borderRadius: RADIUS_VALUES[r.value] }"
                    />
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

            <!-- 壁紙 -->
            <div
              v-if="activeSection === 'wallpaper'"
              class="section-content"
            >
              <p class="field-label">
                {{ $t('apps.settings.wallpaperGradients') }}
              </p>
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
              <p class="field-label wallpaper-section-label">
                {{ $t('apps.settings.wallpaperPhotos') }}
              </p>
              <div class="wallpaper-presets">
                <button
                  v-for="wp in photoWallpapers"
                  :key="wp.id"
                  class="wallpaper-swatch"
                  :class="store.wallpaper === wp.wallUrl ? 'active' : ''"
                  :style="{ backgroundImage: `url(${wp.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }"
                  :title="wp.label"
                  @click="store.setWallpaper(wp.wallUrl)"
                />
              </div>
              <div
                class="field"
                style="margin-top:1rem"
              >
                <p class="field-label">
                  {{ $t('apps.settings.wallpaperUrl') }}
                </p>
                <div class="wallpaper-url-row">
                  <UInput
                    v-model="wallpaperUrlInput"
                    placeholder="https://example.com/image.jpg"
                    class="flex-1"
                    @keydown.enter="applyWallpaperUrl"
                  />
                  <UButton
                    :label="$t('apps.settings.wallpaperApply')"
                    color="primary"
                    variant="solid"
                    size="sm"
                    @click="applyWallpaperUrl"
                  />
                </div>
              </div>
            </div>

            <!-- フォント -->
            <div
              v-if="activeSection === 'font'"
              class="section-content"
            >
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

            <!-- 言語 -->
            <div
              v-if="activeSection === 'language'"
              class="section-content"
            >
              <div class="field">
                <USelect
                  v-model="selectedLocale"
                  :items="localeOptions"
                  value-key="value"
                  class="w-48"
                />
              </div>
            </div>

            <!-- タスクバー -->
            <div
              v-if="activeSection === 'taskbar'"
              class="section-content"
            >
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.taskbarPosition') }}
                </p>
                <div class="option-row">
                  <UButton
                    v-for="pos in (['top', 'bottom', 'left', 'right'] as TaskbarPosition[])"
                    :key="pos"
                    :icon="pos === 'top' ? 'i-lucide-panel-top' : pos === 'bottom' ? 'i-lucide-panel-bottom' : pos === 'left' ? 'i-lucide-panel-left' : 'i-lucide-panel-right'"
                    :label="$t(`apps.settings.taskbarPosition${pos.charAt(0).toUpperCase() + pos.slice(1)}`)"
                    :variant="store.taskbarPosition === pos ? 'solid' : 'outline'"
                    :color="store.taskbarPosition === pos ? 'primary' : 'neutral'"
                    size="sm"
                    @click="store.setTaskbarPosition(pos)"
                  />
                </div>
              </div>
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.taskbarSize') }}
                </p>
                <div class="option-row">
                  <UButton
                    v-for="size in (['sm', 'md', 'lg'] as TaskbarSize[])"
                    :key="size"
                    :label="$t(`apps.settings.taskbarSize${size.charAt(0).toUpperCase() + size.slice(1)}`)"
                    :variant="store.taskbarSize === size ? 'solid' : 'outline'"
                    :color="store.taskbarSize === size ? 'primary' : 'neutral'"
                    size="sm"
                    @click="store.setTaskbarSize(size)"
                  />
                </div>
              </div>
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.taskbarTaskAlign') }}
                </p>
                <div class="option-row">
                  <UButton
                    v-for="align in (['start', 'center', 'end'] as TaskbarTaskAlign[])"
                    :key="align"
                    :label="$t(`apps.settings.taskbarTaskAlign${align.charAt(0).toUpperCase() + align.slice(1)}`)"
                    :variant="store.taskbarTaskAlign === align ? 'solid' : 'outline'"
                    :color="store.taskbarTaskAlign === align ? 'primary' : 'neutral'"
                    size="sm"
                    @click="store.setTaskbarTaskAlign(align)"
                  />
                </div>
              </div>
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.taskbarTaskDisplay') }}
                </p>
                <div class="option-row">
                  <UButton
                    v-for="disp in (['icon', 'icon-label'] as TaskbarTaskDisplay[])"
                    :key="disp"
                    :label="disp === 'icon' ? $t('apps.settings.taskbarTaskDisplayIcon') : $t('apps.settings.taskbarTaskDisplayIconLabel')"
                    :variant="store.taskbarTaskDisplay === disp ? 'solid' : 'outline'"
                    :color="store.taskbarTaskDisplay === disp ? 'primary' : 'neutral'"
                    size="sm"
                    @click="store.setTaskbarTaskDisplay(disp)"
                  />
                </div>
              </div>
            </div>

            <!-- デバイス -->
            <div
              v-if="activeSection === 'device'"
              class="section-content"
            >
              <!-- Bluetooth -->
              <div class="field">
                <div class="device-section-header">
                  <p class="field-label">
                    <UIcon
                      name="i-lucide-bluetooth"
                      class="device-api-icon"
                    />
                    {{ $t('apps.settings.deviceBluetooth') }}
                  </p>
                  <UButton
                    v-if="hasBluetooth"
                    size="xs"
                    icon="i-lucide-plus"
                    :label="$t('apps.settings.deviceConnect')"
                    :loading="deviceConnecting === 'bluetooth'"
                    variant="outline"
                    color="primary"
                    @click="handleConnectBluetooth"
                  />
                </div>
                <UAlert
                  v-if="!hasBluetooth"
                  icon="i-lucide-info"
                  color="neutral"
                  variant="soft"
                  :description="$t('apps.settings.deviceNotSupported')"
                  class="device-unsupported"
                />
                <div
                  v-else-if="deviceStore.bluetoothDevices.length === 0"
                  class="device-empty"
                >
                  {{ $t('apps.settings.deviceNoDevices') }}
                </div>
                <div
                  v-else
                  class="device-list"
                >
                  <div
                    v-for="d in deviceStore.bluetoothDevices"
                    :key="d.id"
                    class="device-item"
                  >
                    <UIcon
                      name="i-lucide-bluetooth"
                      class="device-item-icon"
                    />
                    <span class="device-item-name">{{ d.name }}</span>
                    <UButton
                      size="xs"
                      :label="$t('apps.settings.deviceDisconnect')"
                      variant="ghost"
                      color="error"
                      @click="deviceStore.disconnectBluetooth(d.id)"
                    />
                  </div>
                </div>
              </div>
              <!-- HID -->
              <div class="field">
                <div class="device-section-header">
                  <p class="field-label">
                    <UIcon
                      name="i-lucide-usb"
                      class="device-api-icon"
                    />
                    {{ $t('apps.settings.deviceHid') }}
                  </p>
                  <UButton
                    v-if="hasHid"
                    size="xs"
                    icon="i-lucide-plus"
                    :label="$t('apps.settings.deviceConnect')"
                    :loading="deviceConnecting === 'hid'"
                    variant="outline"
                    color="primary"
                    @click="handleConnectHid"
                  />
                </div>
                <UAlert
                  v-if="!hasHid"
                  icon="i-lucide-info"
                  color="neutral"
                  variant="soft"
                  :description="$t('apps.settings.deviceNotSupported')"
                  class="device-unsupported"
                />
                <div
                  v-else-if="deviceStore.hidDevices.length === 0"
                  class="device-empty"
                >
                  {{ $t('apps.settings.deviceNoDevices') }}
                </div>
                <div
                  v-else
                  class="device-list"
                >
                  <div
                    v-for="d in deviceStore.hidDevices"
                    :key="d.id"
                    class="device-item"
                  >
                    <UIcon
                      name="i-lucide-usb"
                      class="device-item-icon"
                    />
                    <span class="device-item-name">{{ d.productName }}</span>
                    <span class="device-item-meta">{{ d.vendorId.toString(16).padStart(4, '0') }}:{{ d.productId.toString(16).padStart(4, '0') }}</span>
                    <UButton
                      size="xs"
                      :label="$t('apps.settings.deviceDisconnect')"
                      variant="ghost"
                      color="error"
                      @click="deviceStore.disconnectHid(d.id)"
                    />
                  </div>
                </div>
              </div>
              <!-- シリアル -->
              <div class="field">
                <div class="device-section-header">
                  <p class="field-label">
                    <UIcon
                      name="i-lucide-plug"
                      class="device-api-icon"
                    />
                    {{ $t('apps.settings.deviceSerial') }}
                  </p>
                  <UButton
                    v-if="hasSerial"
                    size="xs"
                    icon="i-lucide-plus"
                    :label="$t('apps.settings.deviceConnect')"
                    :loading="deviceConnecting === 'serial'"
                    variant="outline"
                    color="primary"
                    @click="handleConnectSerial"
                  />
                </div>
                <UAlert
                  v-if="!hasSerial"
                  icon="i-lucide-info"
                  color="neutral"
                  variant="soft"
                  :description="$t('apps.settings.deviceNotSupported')"
                  class="device-unsupported"
                />
                <div
                  v-else-if="deviceStore.serialPorts.length === 0"
                  class="device-empty"
                >
                  {{ $t('apps.settings.deviceNoDevices') }}
                </div>
                <div
                  v-else
                  class="device-list"
                >
                  <div
                    v-for="p in deviceStore.serialPorts"
                    :key="p.id"
                    class="device-item"
                  >
                    <UIcon
                      name="i-lucide-plug"
                      class="device-item-icon"
                    />
                    <span class="device-item-name">{{ p.label }}</span>
                    <UButton
                      size="xs"
                      :label="$t('apps.settings.deviceDisconnect')"
                      variant="ghost"
                      color="error"
                      @click="deviceStore.disconnectSerial(p.id)"
                    />
                  </div>
                </div>
              </div>
              <!-- ゲームパッド -->
              <div class="field">
                <p class="field-label">
                  <UIcon
                    name="i-lucide-gamepad-2"
                    class="device-api-icon"
                  />
                  {{ $t('apps.settings.deviceGamepad') }}
                </p>
                <div
                  v-if="deviceStore.gamepads.length === 0"
                  class="device-empty"
                >
                  {{ $t('apps.settings.deviceGamepadGuide') }}
                </div>
                <div
                  v-else
                  class="gamepad-list"
                >
                  <div
                    v-for="gp in deviceStore.gamepads"
                    :key="gp.index"
                    class="gamepad-card"
                  >
                    <div class="gamepad-header">
                      <UIcon name="i-lucide-gamepad-2" />
                      <span class="gamepad-name">{{ gp.id }}</span>
                      <UBadge
                        size="xs"
                        :label="gp.connected ? $t('apps.settings.deviceGamepadConnected') : $t('apps.settings.deviceGamepadDisconnected')"
                        :color="gp.connected ? 'success' : 'neutral'"
                        variant="soft"
                      />
                    </div>
                    <div class="gamepad-buttons-section">
                      <p class="gamepad-sub-label">
                        {{ $t('apps.settings.deviceGamepadButtons') }}
                      </p>
                      <div class="gamepad-buttons">
                        <span
                          v-for="(btn, i) in gp.buttons"
                          :key="i"
                          class="gamepad-btn"
                          :class="btn.pressed ? 'pressed' : ''"
                          :title="$t('apps.settings.deviceGamepadButtonTitle', { index: i, value: (btn.value * 100).toFixed(0) })"
                        />
                      </div>
                    </div>
                    <div class="gamepad-axes-section">
                      <p class="gamepad-sub-label">
                        {{ $t('apps.settings.deviceGamepadAxes') }}
                      </p>
                      <div class="gamepad-axes">
                        <div
                          v-for="(axis, i) in gp.axes"
                          :key="i"
                          class="gamepad-axis"
                        >
                          <span class="gamepad-axis-label">{{ i }}</span>
                          <div class="gamepad-axis-track">
                            <div
                              class="gamepad-axis-fill"
                              :style="{ left: '50%', width: `${Math.abs(axis) * 50}%`, transform: axis < 0 ? 'translateX(-100%)' : 'translateX(0)' }"
                            />
                            <div
                              class="gamepad-axis-thumb"
                              :style="{ left: `${(axis + 1) / 2 * 100}%` }"
                            />
                          </div>
                          <span class="gamepad-axis-value">{{ axis.toFixed(2) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- About -->
            <div
              v-if="activeSection === 'about'"
              class="section-content"
            >
              <div class="about-logo">
                <UIcon
                  name="i-lucide-monitor"
                  class="about-icon"
                />
                <span class="about-name">TxunOS</span>
              </div>
              <p class="about-desc">
                {{ $t('apps.settings.aboutDescription') }}
              </p>
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.version') }}
                </p>
                <p class="about-value">
                  0.1.0
                </p>
              </div>
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.license') }}
                </p>
                <p class="about-value">
                  MIT
                </p>
              </div>
              <div class="field">
                <p class="field-label">
                  {{ $t('apps.settings.ossLicenses') }}
                </p>
                <div class="oss-list">
                  <div
                    v-for="oss in ossPackages"
                    :key="oss.name"
                    class="oss-item"
                  >
                    <button
                      class="oss-header"
                      @click="openOss = openOss === oss.name ? null : oss.name"
                    >
                      <span class="oss-name">{{ oss.name }}</span>
                      <span class="oss-license">{{ oss.license }}</span>
                      <UIcon
                        :name="openOss === oss.name ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="oss-chevron"
                      />
                    </button>
                    <pre
                      v-if="openOss === oss.name"
                      class="oss-full-text"
                    >{{ oss.fullText }}</pre>
                  </div>
                </div>
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

.font-preview-sample {
  margin-top: 0.5rem;
  font-size: 1rem;
  color: var(--ui-text-muted);
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

  .mobile-detail-content {
    flex: 1;
    overflow-y: auto;
  }
}

.wallpaper-section-label {
  margin-top: 1rem;
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

.wallpaper-url-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

// About セクション
.about-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;

  .about-icon {
    font-size: 2.5rem;
    color: var(--ui-primary);
  }

  .about-name {
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.about-desc {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  margin: 0 0 1.25rem;
  line-height: 1.6;
}

.about-value {
  font-size: 0.875rem;
  margin: 0;
}

.oss-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  overflow: hidden;
}

.oss-item {
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: none;
  }

  .oss-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    text-align: left;
    font-size: 0.8125rem;
    transition: background-color 0.1s;

    &:hover {
      background: var(--ui-bg-elevated);
    }

    .oss-name {
      font-weight: 500;
      flex: 1;
    }

    .oss-license {
      color: var(--ui-text-muted);
    }

    .oss-chevron {
      font-size: 0.875rem;
      color: var(--ui-text-muted);
      flex-shrink: 0;
    }
  }

  .oss-full-text {
    font-family: ui-monospace, monospace;
    font-size: 0.6875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    padding: 0.75rem;
    margin: 0;
    background: var(--ui-bg-elevated);
    color: var(--ui-text-muted);
    border-top: 1px solid var(--ui-border);
    max-height: 16rem;
    overflow-y: auto;
  }
}

// デバイスセクション
.device-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;

  .field-label {
    margin-bottom: 0;
  }
}

.device-api-icon {
  font-size: 1rem;
}

.device-empty {
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
  padding: 0.375rem 0;
}

.device-unsupported {
  margin-top: 0.25rem;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  font-size: 0.8125rem;

  .device-item-icon {
    color: var(--ui-primary);
    flex-shrink: 0;
  }

  .device-item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-item-meta {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: var(--ui-text-muted);
    flex-shrink: 0;
  }
}

// ゲームパッドビジュアライザー
.gamepad-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.gamepad-card {
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  padding: 0.75rem;
  background: var(--ui-bg-elevated);
}

.gamepad-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  .gamepad-name {
    flex: 1;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.gamepad-sub-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  margin: 0 0 0.375rem;
}

.gamepad-buttons-section,
.gamepad-axes-section {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.gamepad-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.gamepad-btn {
  display: inline-block;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  border: 1.5px solid var(--ui-border);
  background: transparent;
  transition: background-color 0.06s, border-color 0.06s;

  &.pressed {
    background: var(--ui-primary);
    border-color: var(--ui-primary);
  }
}

.gamepad-axes {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.gamepad-axis {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .gamepad-axis-label {
    font-size: 0.6875rem;
    color: var(--ui-text-muted);
    width: 1rem;
    text-align: right;
    flex-shrink: 0;
  }

  .gamepad-axis-value {
    font-size: 0.6875rem;
    font-family: ui-monospace, monospace;
    color: var(--ui-text-muted);
    width: 3rem;
    flex-shrink: 0;
    text-align: right;
  }
}

.gamepad-axis-track {
  flex: 1;
  height: 0.5rem;
  background: var(--ui-bg);
  border-radius: 99px;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--ui-border);

  .gamepad-axis-fill {
    position: absolute;
    top: 0;
    height: 100%;
    background: var(--ui-primary);
    opacity: 0.6;
  }

  .gamepad-axis-thumb {
    position: absolute;
    top: 50%;
    width: 0.5rem;
    height: 0.5rem;
    background: var(--ui-primary);
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
}
</style>
