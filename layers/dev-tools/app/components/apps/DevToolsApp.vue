<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

defineProps<{ windowId: string }>()

const { t } = useI18n()

// ─── タブ定義 ──────────────────────────────────────
const activeTab = ref('json')
const tabs = computed(() => [
  { value: 'json', label: t('apps.devTools.tabJson'), icon: 'i-lucide-braces' },
  { value: 'codec', label: t('apps.devTools.tabBase64Url'), icon: 'i-lucide-left-right' },
  { value: 'uuid', label: t('apps.devTools.tabUuid'), icon: 'i-lucide-fingerprint' },
  { value: 'hash', label: t('apps.devTools.tabHash'), icon: 'i-lucide-hash' }
])

// ─── レスポンシブ幅管理 ──────────────────────────────
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(640)

onMounted(() => {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      containerWidth.value = entry.contentRect.width
    }
  })
  ro.observe(containerRef.value)
  onUnmounted(() => ro.disconnect())
})

const isCompact = computed(() => containerWidth.value < 520)

// ─── 共用ユーティリティ：コピー通知 ────────────────────
const copiedState = ref<Record<string, boolean>>({})

/**
 * テキストをクリップボードにコピーし、一時的にコピー状態を表示する
 * @param text コピーするテキスト
 * @param key コピー状態の識別キー
 */
function copyToClipboard(text: string, key: string): void {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    copiedState.value[key] = true
    setTimeout(() => {
      copiedState.value[key] = false
    }, 2000)
  })
}

// ─── 1. JSON Beautifier / Minifier ──────────────────
const jsonInput = ref('')
const jsonOutput = ref('')
const jsonError = ref<string | null>(null)

/**
 * JSON を整形する (インデント: 2スペース)
 */
function handleJsonFormat(): void {
  jsonError.value = null
  if (!jsonInput.value.trim()) {
    jsonOutput.value = ''
    return
  }
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonOutput.value = JSON.stringify(parsed, null, 2)
  } catch (err) {
    jsonError.value = err instanceof Error ? err.message : String(err)
    jsonOutput.value = ''
  }
}

/**
 * JSON をミニファイする
 */
function handleJsonMinify(): void {
  jsonError.value = null
  if (!jsonInput.value.trim()) {
    jsonOutput.value = ''
    return
  }
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonOutput.value = JSON.stringify(parsed)
  } catch (err) {
    jsonError.value = err instanceof Error ? err.message : String(err)
    jsonOutput.value = ''
  }
}

/**
 * JSON データをクリアする
 */
function handleJsonClear(): void {
  jsonInput.value = ''
  jsonOutput.value = ''
  jsonError.value = null
}

// ─── 2. Base64 & URL Encoder/Decoder ───────────────
const codecInput = ref('')
const codecOutput = ref('')
const codecError = ref<string | null>(null)

/**
 * UTF-8対応の Base64 エンコード
 */
function handleBase64Encode(): void {
  codecError.value = null
  try {
    const str = codecInput.value
    // % 記号にエンコードされたバイトコード表現を経由してバイナリ配列に直し、btoa()で変換
    const encoded = btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    )
    codecOutput.value = encoded
  } catch (err) {
    codecError.value = err instanceof Error ? err.message : String(err)
  }
}

/**
 * UTF-8対応の Base64 デコード
 */
function handleBase64Decode(): void {
  codecError.value = null
  try {
    const str = codecInput.value.trim()
    if (!str) {
      codecOutput.value = ''
      return
    }
    const decoded = decodeURIComponent(
      atob(str)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    codecOutput.value = decoded
  } catch (err) {
    codecError.value = err instanceof Error ? err.message : String(err)
  }
}

/**
 * URL エンコード
 */
function handleUrlEncode(): void {
  codecError.value = null
  try {
    codecOutput.value = encodeURIComponent(codecInput.value)
  } catch (err) {
    codecError.value = err instanceof Error ? err.message : String(err)
  }
}

/**
 * URL デコード
 */
function handleUrlDecode(): void {
  codecError.value = null
  try {
    codecOutput.value = decodeURIComponent(codecInput.value)
  } catch (err) {
    codecError.value = err instanceof Error ? err.message : String(err)
  }
}

/**
 * Codec データをクリアする
 */
function handleCodecClear(): void {
  codecInput.value = ''
  codecOutput.value = ''
  codecError.value = null
}

// ─── 3. UUID Generator ──────────────────────────────
const generatedUuids = ref<string[]>([])

/**
 * UUID v4 を単一生成する
 */
function handleGenerateUuid(): void {
  try {
    const uuid = crypto.randomUUID()
    generatedUuids.value.unshift(uuid)
  } catch {
    // 古いブラウザ向けの fallback
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    generatedUuids.value.unshift(uuid)
  }
}

/**
 * 指定された個数の UUID v4 を一括生成する
 * @param count 生成件数
 */
function handleGenerateMultiple(count: number): void {
  const list: string[] = []
  for (let i = 0; i < count; i++) {
    try {
      list.push(crypto.randomUUID())
    } catch {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
      list.push(uuid)
    }
  }
  generatedUuids.value = [...list, ...generatedUuids.value]
}

/**
 * 生成した UUID 一覧をすべてクリアする
 */
function handleUuidClear(): void {
  generatedUuids.value = []
}

/**
 * 生成したすべての UUID を改行区切りでコピーする
 */
function handleCopyAllUuids(): void {
  if (generatedUuids.value.length === 0) return
  copyToClipboard(generatedUuids.value.join('\n'), 'all-uuids')
}

// ─── 4. SHA-256 Hash Generator ──────────────────────
const hashInput = ref('')
const hashOutput = ref('')

/**
 * 入力値を非同期で SHA-256 にエンコードする
 * @param text 平文
 */
async function generateSha256(text: string): Promise<string> {
  if (!text) return ''
  const msgBuffer = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

watch(hashInput, async (newVal) => {
  hashOutput.value = await generateSha256(newVal)
})

/**
 * ハッシュ情報をクリアする
 */
function handleHashClear(): void {
  hashInput.value = ''
  hashOutput.value = ''
}
</script>

<template>
  <div
    ref="containerRef"
    class="dev-tools-app"
    :class="{ compact: isCompact }"
  >
    <!-- ナビゲーションタブ -->
    <UTabs
      v-model="activeTab"
      :items="tabs"
      class="dev-tabs"
    >
      <template #content="{ item }">
        <!-- 1. JSON Beautifier / Minifier タブ -->
        <div
          v-if="item.value === 'json'"
          class="tab-panel flex flex-col h-full overflow-hidden p-3 gap-3"
        >
          <!-- 操作ボタン群 -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2 flex-shrink-0">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">JSON Beautifier & Minifier</span>
            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-sparkles"
                color="primary"
                size="sm"
                :label="t('apps.devTools.json.format')"
                @click="handleJsonFormat"
              />
              <UButton
                icon="i-lucide-shrink"
                color="primary"
                variant="subtle"
                size="sm"
                :label="t('apps.devTools.json.minify')"
                @click="handleJsonMinify"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="t('apps.devTools.json.clear')"
                @click="handleJsonClear"
              />
            </div>
          </div>

          <!-- エラー表示 -->
          <UAlert
            v-if="jsonError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="t('apps.devTools.json.invalidJson', { error: jsonError })"
            class="flex-shrink-0 text-xs"
          />

          <!-- テキストエリアエリア -->
          <div
            class="input-output-split flex-1 min-h-0 flex gap-3 h-full"
            :class="{ 'flex-col': isCompact }"
          >
            <div class="flex-1 flex flex-col gap-2 min-h-0">
              <label class="text-xs font-medium text-gray-400">Input Raw JSON</label>
              <UTextarea
                v-model="jsonInput"
                :placeholder="t('apps.devTools.json.inputPlaceholder')"
                class="flex-1 min-h-0 min-w-0 resize-none font-mono text-sm leading-relaxed"
                :rows="10"
                variant="outline"
              />
            </div>
            <div class="flex-1 flex flex-col gap-2 min-h-0">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-gray-400">Formatted / Minified Result</label>
                <UButton
                  v-if="jsonOutput"
                  :icon="copiedState['json'] ? 'i-lucide-check' : 'i-lucide-copy'"
                  :color="copiedState['json'] ? 'success' : 'neutral'"
                  variant="ghost"
                  size="xs"
                  :label="copiedState['json'] ? t('apps.devTools.json.copied') : t('apps.devTools.json.copy')"
                  @click="copyToClipboard(jsonOutput, 'json')"
                />
              </div>
              <UTextarea
                v-model="jsonOutput"
                readonly
                :placeholder="t('apps.devTools.json.inputPlaceholder')"
                class="flex-1 min-h-0 min-w-0 resize-none font-mono text-sm leading-relaxed bg-gray-50/50 dark:bg-gray-900/50"
                :rows="10"
                variant="subtle"
              />
            </div>
          </div>
        </div>

        <!-- 2. Base64 & URL Encoder/Decoder タブ -->
        <div
          v-if="item.value === 'codec'"
          class="tab-panel flex flex-col h-full overflow-hidden p-3 gap-3"
        >
          <!-- ツールナビ・アクション群 -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2 flex-shrink-0">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">Decoder & Encoder</span>
            <div class="flex items-center gap-2 flex-wrap">
              <UButton
                icon="i-lucide-arrow-right-left"
                color="primary"
                size="sm"
                :label="t('apps.devTools.codec.b64Encode')"
                @click="handleBase64Encode"
              />
              <UButton
                icon="i-lucide-arrow-left-right"
                color="primary"
                variant="subtle"
                size="sm"
                :label="t('apps.devTools.codec.b64Decode')"
                @click="handleBase64Decode"
              />
              <UButton
                icon="i-lucide-link-2"
                color="info"
                size="sm"
                :label="t('apps.devTools.codec.urlEncode')"
                @click="handleUrlEncode"
              />
              <UButton
                icon="i-lucide-link-2-off"
                color="info"
                variant="subtle"
                size="sm"
                :label="t('apps.devTools.codec.urlDecode')"
                @click="handleUrlDecode"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="t('apps.devTools.codec.clear')"
                @click="handleCodecClear"
              />
            </div>
          </div>

          <!-- エラー表示 -->
          <UAlert
            v-if="codecError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="codecError"
            class="flex-shrink-0 text-xs"
          />

          <!-- 変換エリア -->
          <div
            class="input-output-split flex-1 min-h-0 flex gap-3 h-full"
            :class="{ 'flex-col': isCompact }"
          >
            <div class="flex-1 flex flex-col gap-2 min-h-0">
              <label class="text-xs font-medium text-gray-400">Source Text</label>
              <UTextarea
                v-model="codecInput"
                :placeholder="t('apps.devTools.codec.inputPlaceholder')"
                class="flex-1 min-h-0 min-w-0 resize-none text-sm leading-relaxed"
                :rows="10"
                variant="outline"
              />
            </div>
            <div class="flex-1 flex flex-col gap-2 min-h-0">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-gray-400">Result Output</label>
                <UButton
                  v-if="codecOutput"
                  :icon="copiedState['codec'] ? 'i-lucide-check' : 'i-lucide-copy'"
                  :color="copiedState['codec'] ? 'success' : 'neutral'"
                  variant="ghost"
                  size="xs"
                  :label="copiedState['codec'] ? t('apps.devTools.codec.copied') : t('apps.devTools.codec.copy')"
                  @click="copyToClipboard(codecOutput, 'codec')"
                />
              </div>
              <UTextarea
                v-model="codecOutput"
                readonly
                :placeholder="t('apps.devTools.codec.outputPlaceholder')"
                class="flex-1 min-h-0 min-w-0 resize-none font-mono text-sm leading-relaxed bg-gray-50/50 dark:bg-gray-900/50"
                :rows="10"
                variant="subtle"
              />
            </div>
          </div>
        </div>

        <!-- 3. UUID Generator タブ -->
        <div
          v-if="item.value === 'uuid'"
          class="tab-panel flex flex-col h-full overflow-hidden p-3 gap-3"
        >
          <!-- コントロールボタン群 -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2 flex-shrink-0">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">UUID v4 Generator</span>
            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-plus"
                color="primary"
                size="sm"
                :label="t('apps.devTools.uuid.generate')"
                @click="handleGenerateUuid"
              />
              <UButton
                icon="i-lucide-layers"
                color="primary"
                variant="subtle"
                size="sm"
                :label="t('apps.devTools.uuid.generateMultiple', { count: 5 })"
                @click="handleGenerateMultiple(5)"
              />
              <UButton
                v-if="generatedUuids.length > 0"
                icon="i-lucide-copy"
                color="success"
                variant="subtle"
                size="sm"
                :label="copiedState['all-uuids'] ? t('apps.devTools.uuid.copied') : t('apps.devTools.uuid.copy') + ' List'"
                @click="handleCopyAllUuids"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="t('apps.devTools.uuid.clear')"
                @click="handleUuidClear"
              />
            </div>
          </div>

          <!-- UUID リスト表示 -->
          <div class="flex-1 overflow-y-auto min-h-0 border border-gray-100 dark:border-gray-800 rounded-lg p-2 bg-gray-55/20">
            <div
              v-if="generatedUuids.length === 0"
              class="flex flex-col items-center justify-center h-full py-16 text-gray-400 dark:text-gray-500 gap-2"
            >
              <UIcon
                name="i-lucide-fingerprint"
                class="w-10 h-10 stroke-1"
              />
              <span class="text-xs font-semibold">No UUIDs generated yet</span>
            </div>
            <div
              v-else
              class="flex flex-col gap-2"
            >
              <div
                v-for="(uuid, idx) in generatedUuids"
                :key="uuid + idx"
                class="flex items-center justify-between p-2 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
              >
                <code class="text-xs font-semibold font-mono selection:bg-purple-100 dark:selection:bg-purple-950">{{ uuid }}</code>
                <UButton
                  :icon="copiedState[`uuid-${idx}`] ? 'i-lucide-check' : 'i-lucide-copy'"
                  :color="copiedState[`uuid-${idx}`] ? 'success' : 'neutral'"
                  size="xs"
                  variant="ghost"
                  @click="copyToClipboard(uuid, `uuid-${idx}`)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 4. SHA-256 Hash Generator タブ -->
        <div
          v-if="item.value === 'hash'"
          class="tab-panel flex flex-col h-full overflow-hidden p-3 gap-3"
        >
          <!-- アクションツールバー -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2 flex-shrink-0">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">Cryptographic Hash Generator</span>
            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="t('apps.devTools.hash.clear')"
                @click="handleHashClear"
              />
            </div>
          </div>

          <!-- ハッシュエリア -->
          <div
            class="input-output-split flex-1 min-h-0 flex gap-3 h-full"
            :class="{ 'flex-col': isCompact }"
          >
            <div class="flex-1 flex flex-col gap-2 min-h-0">
              <label class="text-xs font-medium text-gray-400">Plaintext Input</label>
              <UTextarea
                v-model="hashInput"
                :placeholder="t('apps.devTools.hash.inputPlaceholder')"
                class="flex-1 min-h-0 min-w-0 resize-none text-sm leading-relaxed"
                :rows="10"
                variant="outline"
              />
            </div>
            <div class="flex-1 flex flex-col gap-2 min-h-0">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-gray-400">SHA-256 Hash Output</label>
                <UButton
                  v-if="hashOutput"
                  :icon="copiedState['hash'] ? 'i-lucide-check' : 'i-lucide-copy'"
                  :color="copiedState['hash'] ? 'success' : 'neutral'"
                  variant="ghost"
                  size="xs"
                  :label="copiedState['hash'] ? t('apps.devTools.hash.copied') : t('apps.devTools.hash.copy')"
                  @click="copyToClipboard(hashOutput, 'hash')"
                />
              </div>
              <UTextarea
                v-model="hashOutput"
                readonly
                :placeholder="t('apps.devTools.hash.outputPlaceholder')"
                class="flex-1 min-h-0 min-w-0 resize-none font-mono text-xs break-all leading-relaxed bg-gray-55/40 dark:bg-gray-900/50"
                :rows="10"
                variant="subtle"
              />
            </div>
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<style scoped>
.dev-tools-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
}

.dev-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Tab contents must occupy full height scroll properly */
:deep(.dev-tabs > div:nth-child(2)) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
