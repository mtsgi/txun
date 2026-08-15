<script setup lang="ts">
import {
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUTS,
  stringifyKeyEvent,
  formatShortcutKeys
} from '#layers/txunos-core/app/composables/useShortcuts'
import type { ShortcutActionId, ShortcutDefinition } from '#layers/txunos-core/app/composables/useShortcuts'

const store = useDesktopStore()
const { t } = useI18n()

/** 現在キー入力を記録中のアクションID */
const recordingActionId = ref<ShortcutActionId | null>(null)
/** 記録中のプレビュー文字列 */
const recordingPreview = ref<string | null>(null)
/** 競合警告メッセージ */
const conflictWarning = ref<string | null>(null)

/** カテゴリごとのショートカット定義 */
const categories = computed(() => {
  const cats: { id: string, label: string, items: ShortcutDefinition[] }[] = [
    {
      id: 'desktop',
      label: t('apps.settings.shortcutsCatDesktop'),
      items: SHORTCUT_DEFINITIONS.filter(d => d.category === 'desktop')
    },
    {
      id: 'system',
      label: t('apps.settings.shortcutsCatSystem'),
      items: SHORTCUT_DEFINITIONS.filter(d => d.category === 'system')
    },
    {
      id: 'window',
      label: t('apps.settings.shortcutsCatWindow'),
      items: SHORTCUT_DEFINITIONS.filter(d => d.category === 'window')
    }
  ]
  return cats
})

/** 各アクションの現在の設定キーを取得 */
function getCurrentKey(actionId: ShortcutActionId): string {
  return store.shortcuts?.[actionId] || DEFAULT_SHORTCUTS[actionId] || ''
}

/** 各アクションがデフォルト値から変更されているか判定 */
function isModified(actionId: ShortcutActionId): boolean {
  return getCurrentKey(actionId) !== DEFAULT_SHORTCUTS[actionId]
}

/** キー記録の開始 */
function startRecording(actionId: ShortcutActionId) {
  recordingActionId.value = actionId
  recordingPreview.value = null
  conflictWarning.value = null
}

/** キー記録のキャンセル */
function stopRecording() {
  recordingActionId.value = null
  recordingPreview.value = null
  conflictWarning.value = null
}

/** 単一ショートカットをデフォルト値にリセット */
function resetSingle(actionId: ShortcutActionId) {
  store.resetShortcut(actionId)
}

/** 全ショートカットをデフォルト値にリセット */
function resetAll() {
  store.resetShortcuts()
}

/** 記録モード中のキーボードイベントハンドラ */
function onRecordKeydown(e: KeyboardEvent) {
  if (!recordingActionId.value) return

  e.preventDefault()
  e.stopPropagation()

  // Escape 単体押下時は記録をキャンセル
  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
    stopRecording()
    return
  }

  const combo = stringifyKeyEvent(e)
  if (!combo) return

  // 競合チェック
  const conflicting = SHORTCUT_DEFINITIONS.find(
    d => d.id !== recordingActionId.value && getCurrentKey(d.id).toLowerCase() === combo.toLowerCase()
  )

  if (conflicting) {
    conflictWarning.value = t('apps.settings.shortcutsConflict', { action: t(conflicting.labelKey) })
  } else {
    conflictWarning.value = null
  }

  // 設定を保存して記録モード終了
  store.setShortcut(recordingActionId.value, combo)
  recordingActionId.value = null
}

onMounted(() => {
  window.addEventListener('keydown', onRecordKeydown, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onRecordKeydown, { capture: true })
})
</script>

<template>
  <div class="shortcuts-settings">
    <!-- Header -->
    <div class="section-header">
      <div class="section-text">
        <h3 class="section-title">
          {{ $t('apps.settings.shortcuts') }}
        </h3>
        <p class="section-desc">
          {{ $t('apps.settings.shortcutsDescription') }}
        </p>
      </div>

      <UButton
        icon="i-lucide-rotate-ccw"
        variant="ghost"
        color="neutral"
        size="xs"
        :label="$t('apps.settings.shortcutsResetAll')"
        @click="resetAll"
      />
    </div>

    <!-- 競合警告アラート -->
    <div
      v-if="conflictWarning"
      class="conflict-alert"
    >
      <UIcon
        name="i-lucide-alert-triangle"
        class="alert-icon"
      />
      <span>{{ conflictWarning }}</span>
    </div>

    <!-- Categories -->
    <div
      v-for="cat in categories"
      :key="cat.id"
      class="shortcut-category"
    >
      <h4 class="category-title">
        {{ cat.label }}
      </h4>

      <div class="shortcut-list">
        <div
          v-for="def in cat.items"
          :key="def.id"
          class="shortcut-row"
          :class="{ 'is-recording': recordingActionId === def.id }"
        >
          <!-- Left: Label & Description -->
          <div class="shortcut-info">
            <span class="shortcut-label">{{ $t(def.labelKey) }}</span>
            <span class="shortcut-desc">{{ $t(def.descKey) }}</span>
          </div>

          <!-- Right: Key combination badge & Action buttons -->
          <div class="shortcut-controls">
            <!-- Recording State Indicator -->
            <template v-if="recordingActionId === def.id">
              <span class="recording-badge animate-pulse">
                <UIcon
                  name="i-lucide-circle-dot"
                  class="rec-icon text-primary"
                />
                {{ $t('apps.settings.shortcutsPressKeys') }}
              </span>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :label="$t('apps.settings.shortcutsCancel')"
                @click="stopRecording"
              />
            </template>

            <!-- Normal State: Key Badges and Change/Reset -->
            <template v-else>
              <div class="key-badges">
                <template
                  v-for="(k, idx) in formatShortcutKeys(getCurrentKey(def.id))"
                  :key="idx"
                >
                  <UKbd size="sm">
                    {{ k }}
                  </UKbd>
                  <span
                    v-if="idx < formatShortcutKeys(getCurrentKey(def.id)).length - 1"
                    class="key-plus"
                  >+</span>
                </template>
              </div>

              <div class="btn-group">
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-pencil"
                  :label="$t('apps.settings.shortcutsChange')"
                  @click="startRecording(def.id)"
                />
                <UButton
                  v-if="isModified(def.id)"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-undo"
                  :aria-label="$t('apps.settings.shortcutsReset')"
                  @click="resetSingle(def.id)"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.shortcuts-settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem;
  container-type: inline-size;

  @media (max-width: 640px) {
    padding: 0.75rem 0.875rem 1.5rem;
    gap: 1.25rem;
  }
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  .section-text {
    flex: 1;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--ui-text-muted);
    line-height: 1.45;
  }

  @media (max-width: 640px) {
    .section-title {
      display: none; // モバイルヘッダーにタイトルが表示されるため省略
    }
  }
}

.conflict-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--desktop-radius, 0.5rem);
  background: color-mix(in srgb, var(--ui-warning, #eab308) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-warning, #eab308) 40%, transparent);
  font-size: 0.8125rem;
  color: var(--ui-text);

  .alert-icon {
    color: var(--ui-warning, #eab308);
    font-size: 1.125rem;
    flex-shrink: 0;
  }
}

.shortcut-category {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .category-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--ui-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-left: 0.25rem;
  }
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ui-border);
  border-radius: var(--desktop-radius, 0.75rem);
  overflow: hidden;
  background: var(--ui-bg-elevated);
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  gap: 1rem;
  transition: background-color 0.15s;

  &:not(:last-child) {
    border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 60%, transparent);
  }

  &.is-recording {
    background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
  }

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.625rem;
    padding: 0.875rem 0.875rem;
  }

  @container (max-width: 520px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.625rem;
    padding: 0.875rem 0.875rem;
  }
}

.shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;

  .shortcut-label {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .shortcut-desc {
    font-size: 0.75rem;
    color: var(--ui-text-muted);
    line-height: 1.4;
  }
}

.shortcut-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;

  @media (max-width: 640px) {
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.375rem;
    border-top: 1px dashed color-mix(in srgb, var(--ui-border) 40%, transparent);
  }

  @container (max-width: 520px) {
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.375rem;
    border-top: 1px dashed color-mix(in srgb, var(--ui-border) 40%, transparent);
  }
}

.recording-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 15%, transparent);
  padding: 0.3125rem 0.75rem;
  border-radius: 9999px;
  border: 1px dashed var(--ui-primary);

  .rec-icon {
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    flex: 1;
    justify-content: center;
  }

  @container (max-width: 520px) {
    flex: 1;
    justify-content: center;
  }
}

.key-badges {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;

  .key-plus {
    font-size: 0.75rem;
    color: var(--ui-text-muted);
  }
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}
</style>
