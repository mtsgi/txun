<script setup lang="ts">
import { useClipboardStore } from '../../stores/clipboard'
import { useClipboard } from '../../composables/useClipboard'
import type { ClipboardEntry } from '../../stores/clipboard'

const { t } = useI18n()
const store = useClipboardStore()
const { insertTextToActiveElement, pasteEntry, openQuickHistory } = useClipboard()

const isOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetElement = ref<HTMLElement | null>(null)
const selectedText = ref('')
const hasSelection = computed(() => selectedText.value.length > 0)
const canPaste = computed(() => store.history.length > 0)
const showRecentSubmenu = ref(false)

const recentItems = computed(() => store.history.slice(0, 5))

const isSubmenuLeft = computed(() => {
  if (typeof window === 'undefined') return false
  return menuX.value + 400 > window.innerWidth
})

interface ContextMenuItem {
  label: string
  icon?: string
  kbds?: string[]
  disabled?: boolean
  color?: 'primary' | 'error' | 'neutral'
  children?: {
    label: string
    icon?: string
    onSelect: () => void
  }[]
  onSelect?: () => void
}

function getSelectedTextFromTarget(el: HTMLElement | null): string {
  if (!el) return ''
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    if (start !== end) {
      return el.value.substring(start, end)
    }
    return ''
  }
  if (el.isContentEditable) {
    const sel = window.getSelection()
    return sel ? sel.toString() : ''
  }
  return ''
}

function openMenu(e: MouseEvent, target: HTMLElement) {
  targetElement.value = target
  selectedText.value = getSelectedTextFromTarget(target)
  showRecentSubmenu.value = false

  const menuWidth = 220
  const menuHeight = 260
  let x = e.clientX
  let y = e.clientY

  if (typeof window !== 'undefined') {
    if (x + menuWidth > window.innerWidth) {
      x = Math.max(8, window.innerWidth - menuWidth - 8)
    }
    if (y + menuHeight > window.innerHeight) {
      y = Math.max(8, window.innerHeight - menuHeight - 8)
    }
  }

  menuX.value = x
  menuY.value = y

  // ホストOS側のクリップボードを同期
  store.syncFromNativeClipboard().catch(() => {})

  isOpen.value = true
}

function closeMenu() {
  isOpen.value = false
  targetElement.value = null
  showRecentSubmenu.value = false
}

function handleCut() {
  const el = targetElement.value
  if (!el) {
    closeMenu()
    return
  }

  const text = getSelectedTextFromTarget(el)
  if (text) {
    store.copyText(text)
    insertTextToActiveElement('', el)
  }
  closeMenu()
}

function handleCopy() {
  const el = targetElement.value
  if (!el) {
    closeMenu()
    return
  }

  const text = getSelectedTextFromTarget(el)
  if (text) {
    store.copyText(text)
  }
  closeMenu()
}

async function handlePaste() {
  const el = targetElement.value
  if (!el) {
    closeMenu()
    return
  }

  await store.syncFromNativeClipboard()

  const current = store.currentEntry
  if (current) {
    pasteEntry(current, el)
  }
  closeMenu()
}

function handlePasteRecent(entry: ClipboardEntry) {
  const el = targetElement.value
  if (el) {
    pasteEntry(entry, el)
  }
  closeMenu()
}

function handlePasteFromHistory() {
  const el = targetElement.value
  closeMenu()
  if (el) {
    el.focus()
  }
  openQuickHistory()
}

function handleSelectAll() {
  const el = targetElement.value
  if (el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.select()
      el.focus()
    } else if (el.isContentEditable) {
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
      el.focus()
    }
  }
  closeMenu()
}

function handleDelete() {
  const el = targetElement.value
  if (el) {
    insertTextToActiveElement('', el)
  }
  closeMenu()
}

const menuGroups = computed<ContextMenuItem[][]>(() => {
  const primaryGroup: ContextMenuItem[] = [
    {
      label: t('core.desktop.contextMenu.cut'),
      icon: 'i-lucide-scissors',
      kbds: ['Ctrl', 'X'],
      disabled: !hasSelection.value,
      onSelect: handleCut
    },
    {
      label: t('core.desktop.contextMenu.copy'),
      icon: 'i-lucide-copy',
      kbds: ['Ctrl', 'C'],
      disabled: !hasSelection.value,
      onSelect: handleCopy
    },
    {
      label: t('core.desktop.contextMenu.paste'),
      icon: 'i-lucide-clipboard-paste',
      kbds: ['Ctrl', 'V'],
      disabled: !canPaste.value,
      onSelect: handlePaste
    }
  ]

  const historyChildren = recentItems.value.map(clip => ({
    label: clip.textPreview.length > 24 ? clip.textPreview.slice(0, 24) + '…' : clip.textPreview,
    icon: clip.type === 'image' ? 'i-lucide-image' : 'i-lucide-align-left',
    onSelect: () => handlePasteRecent(clip)
  }))

  const historyGroup: ContextMenuItem[] = [
    {
      label: t('core.desktop.contextMenu.pasteHistory'),
      icon: 'i-lucide-history',
      kbds: ['Win', 'V'],
      onSelect: handlePasteFromHistory
    },
    ...(historyChildren.length > 0
      ? [{
          label: '最近のコピー履歴',
          icon: 'i-lucide-clock',
          children: historyChildren
        }]
      : [])
  ]

  const editGroup: ContextMenuItem[] = [
    {
      label: t('core.desktop.contextMenu.selectAll'),
      icon: 'i-lucide-check-square',
      kbds: ['Ctrl', 'A'],
      onSelect: handleSelectAll
    },
    {
      label: t('core.desktop.contextMenu.delete'),
      icon: 'i-lucide-trash-2',
      kbds: ['Del'],
      color: 'error',
      disabled: !hasSelection.value,
      onSelect: handleDelete
    }
  ]

  return [primaryGroup, historyGroup, editGroup]
})

function onWindowClick(_e: MouseEvent) {
  if (isOpen.value) {
    closeMenu()
  }
}

function onWindowKeydown(e: KeyboardEvent) {
  if (isOpen.value && e.key === 'Escape') {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('resize', closeMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('resize', closeMenu)
})

// 外部からトリガーできるように公開
defineExpose({
  openMenu,
  closeMenu
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-menu">
      <div
        v-if="isOpen"
        class="editable-context-menu-container"
        :style="{ left: `${menuX}px`, top: `${menuY}px` }"
        @click.stop
        @contextmenu.prevent
      >
        <div
          data-slot="content"
          class="ui-context-menu-content"
        >
          <div
            role="presentation"
            data-slot="viewport"
            class="ui-context-menu-viewport"
          >
            <template
              v-for="(group, gIdx) in menuGroups"
              :key="`group-${gIdx}`"
            >
              <div
                v-if="gIdx > 0"
                data-slot="separator"
                class="ui-context-menu-separator"
              />
              <div
                data-slot="group"
                class="ui-context-menu-group"
              >
                <template
                  v-for="(item, iIdx) in group"
                  :key="`item-${gIdx}-${iIdx}`"
                >
                  <!-- Submenu Item -->
                  <div
                    v-if="item.children?.length"
                    class="submenu-wrapper"
                    @mouseenter="showRecentSubmenu = true"
                    @mouseleave="showRecentSubmenu = false"
                  >
                    <button
                      type="button"
                      data-slot="item"
                      class="ui-context-menu-item"
                      :disabled="item.disabled"
                    >
                      <UIcon
                        v-if="item.icon"
                        :name="item.icon"
                        data-slot="itemLeadingIcon"
                        class="ui-context-menu-item-icon"
                      />
                      <span
                        data-slot="itemWrapper"
                        class="ui-context-menu-item-wrapper"
                      >
                        <span
                          data-slot="itemLabel"
                          class="ui-context-menu-item-label"
                        >
                          {{ item.label }}
                        </span>
                      </span>
                      <span
                        data-slot="itemTrailing"
                        class="ui-context-menu-item-trailing"
                      >
                        <UIcon
                          name="i-lucide-chevron-right"
                          data-slot="itemTrailingIcon"
                          class="ui-context-menu-trailing-icon"
                        />
                      </span>
                    </button>

                    <!-- Flyout Submenu Content -->
                    <Transition name="fade-menu">
                      <div
                        v-if="showRecentSubmenu"
                        data-slot="content"
                        class="ui-context-menu-subcontent"
                        :class="{ 'align-left': isSubmenuLeft }"
                      >
                        <div
                          role="presentation"
                          data-slot="viewport"
                          class="ui-context-menu-viewport"
                        >
                          <div
                            data-slot="group"
                            class="ui-context-menu-group"
                          >
                            <button
                              v-for="(subItem, sIdx) in item.children"
                              :key="`sub-${sIdx}`"
                              type="button"
                              data-slot="item"
                              class="ui-context-menu-item"
                              @click="subItem.onSelect"
                            >
                              <UIcon
                                v-if="subItem.icon"
                                :name="subItem.icon"
                                data-slot="itemLeadingIcon"
                                class="ui-context-menu-item-icon"
                              />
                              <span
                                data-slot="itemWrapper"
                                class="ui-context-menu-item-wrapper"
                              >
                                <span
                                  data-slot="itemLabel"
                                  class="ui-context-menu-item-label truncate"
                                >
                                  {{ subItem.label }}
                                </span>
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </Transition>
                  </div>

                  <!-- Regular Item -->
                  <button
                    v-else
                    type="button"
                    data-slot="item"
                    class="ui-context-menu-item"
                    :class="{ 'item-error': item.color === 'error' }"
                    :disabled="item.disabled"
                    @click="item.onSelect?.()"
                  >
                    <UIcon
                      v-if="item.icon"
                      :name="item.icon"
                      data-slot="itemLeadingIcon"
                      class="ui-context-menu-item-icon"
                    />
                    <span
                      data-slot="itemWrapper"
                      class="ui-context-menu-item-wrapper"
                    >
                      <span
                        data-slot="itemLabel"
                        class="ui-context-menu-item-label"
                      >
                        {{ item.label }}
                      </span>
                    </span>
                    <span
                      v-if="item.kbds?.length"
                      data-slot="itemTrailing"
                      class="ui-context-menu-item-trailing"
                    >
                      <span
                        data-slot="itemTrailingKbds"
                        class="ui-context-menu-item-kbds"
                      >
                        <UKbd
                          v-for="(kbd, kIdx) in item.kbds"
                          :key="kIdx"
                          size="sm"
                          :value="kbd"
                        />
                      </span>
                    </span>
                  </button>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.editable-context-menu-container {
  position: fixed;
  z-index: 100000;
  pointer-events: auto;
}

.ui-context-menu-content {
  min-width: 13rem;
  background: var(--ui-bg-elevated, #18181b);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--ui-radius, 0.5rem);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: visible;
}

.ui-context-menu-viewport {
  padding: 0.25rem;
  display: flex;
  flex-direction: column;
}

.ui-context-menu-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.ui-context-menu-separator {
  height: 1px;
  background: var(--ui-border, rgba(255, 255, 255, 0.08));
  margin: 0.25rem 0.125rem;
}

.ui-context-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.375rem 0.5rem;
  border-radius: calc(var(--ui-radius, 0.5rem) - 2px);
  border: none;
  background: transparent;
  color: var(--ui-text, #f4f4f5);
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s ease;
  user-select: none;

  &:hover:not(:disabled) {
    background: var(--ui-bg-accented, rgba(255, 255, 255, 0.08));
    color: var(--ui-primary, #a855f7);

    .ui-context-menu-item-icon {
      color: var(--ui-primary, #a855f7);
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.item-error:hover:not(:disabled) {
    color: var(--ui-error, #ef4444);
    background: rgba(239, 68, 68, 0.1);

    .ui-context-menu-item-icon {
      color: var(--ui-error, #ef4444);
    }
  }
}

.ui-context-menu-item-icon {
  font-size: 0.875rem;
  color: var(--ui-text-muted, #a1a1aa);
  flex-shrink: 0;
  transition: color 0.12s ease;
}

.ui-context-menu-item-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.ui-context-menu-item-label {
  font-weight: 500;
  white-space: nowrap;

  &.truncate {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.ui-context-menu-item-trailing {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: 0.5rem;
}

.ui-context-menu-item-kbds {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.ui-context-menu-trailing-icon {
  font-size: 0.75rem;
  color: var(--ui-text-muted, #71717a);
}

.submenu-wrapper {
  position: relative;
}

.ui-context-menu-subcontent {
  position: absolute;
  left: 100%;
  top: -0.25rem;
  margin-left: 0.25rem;
  min-width: 12rem;
  max-width: 18rem;
  background: var(--ui-bg-elevated, #18181b);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--ui-radius, 0.5rem);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  pointer-events: auto;

  &.align-left {
    left: auto;
    right: 100%;
    margin-left: 0;
    margin-right: 0.25rem;
  }
}

/* Animations */
.fade-menu-enter-active,
.fade-menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.fade-menu-enter-from,
.fade-menu-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
