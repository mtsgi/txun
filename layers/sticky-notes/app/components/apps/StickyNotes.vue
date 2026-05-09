<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()
const { saveState, loadState } = useDesktopStorage()

/** メモのカラー定義 */
type NoteColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

/** スティッキーノートを表す型 */
interface StickyNote {
  id: string
  title: string
  content: string
  color: NoteColor
  updatedAt: number
}

/** メモ一覧 */
const notes = ref<StickyNote[]>([])
/** 選択中のメモ ID */
const selectedId = ref<string | null>(null)

/** ストレージキー */
const STORAGE_KEY = 'sticky-notes'

onMounted(async () => {
  const saved = await loadState(STORAGE_KEY)
  if (Array.isArray(saved)) {
    notes.value = saved as StickyNote[]
    selectedId.value = notes.value[0]?.id ?? null
  }
})

/** メモをストレージに保存する */
async function persistNotes(): Promise<void> {
  await saveState(STORAGE_KEY, notes.value)
}

/** コンテナ幅によるレスポンシブ判定 */
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(700)

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

/** 幅が 480px 未満をコンパクトモードと判定 */
const isCompact = computed(() => containerWidth.value < 480)

/** 選択中のメモオブジェクト */
const selectedNote = computed(() =>
  notes.value.find(n => n.id === selectedId.value) ?? null
)

/** メモを新規作成する */
async function createNote(): Promise<void> {
  const note: StickyNote = {
    id: crypto.randomUUID(),
    title: t('apps.stickyNotes.newNote'),
    content: '',
    color: 'yellow',
    updatedAt: Date.now()
  }
  notes.value.unshift(note)
  selectedId.value = note.id
  await persistNotes()
}

/** メモを削除する */
async function deleteNote(id: string): Promise<void> {
  const idx = notes.value.findIndex(n => n.id === id)
  notes.value.splice(idx, 1)
  selectedId.value = notes.value[0]?.id ?? null
  await persistNotes()
}

/** メモを更新して保存する（デバウンス付き） */
let saveTimer: ReturnType<typeof setTimeout> | null = null
function onNoteChange(): void {
  if (!selectedNote.value) return
  selectedNote.value.updatedAt = Date.now()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await persistNotes()
  }, 800)
}

/** 更新日時を人間可読形式で返す */
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** カラーのスタイルクラス */
const colorClasses: Record<NoteColor, string> = {
  yellow: 'note-yellow',
  green: 'note-green',
  blue: 'note-blue',
  pink: 'note-pink',
  purple: 'note-purple'
}

/** カラー選択肢 */
const colorOptions: Array<{ value: NoteColor, label: string }> = [
  { value: 'yellow', label: t('apps.stickyNotes.color.yellow') },
  { value: 'green', label: t('apps.stickyNotes.color.green') },
  { value: 'blue', label: t('apps.stickyNotes.color.blue') },
  { value: 'pink', label: t('apps.stickyNotes.color.pink') },
  { value: 'purple', label: t('apps.stickyNotes.color.purple') }
]

/** コンパクトモード時に編集パネルを表示するか */
const showEditor = ref(false)

/** リストからメモを選択する */
function selectNote(id: string): void {
  selectedId.value = id
  if (isCompact.value) showEditor.value = true
}
</script>

<template>
  <div
    ref="containerRef"
    class="sticky-notes"
    :class="{ compact: isCompact }"
  >
    <!-- コンパクト: 編集パネル表示時 -->
    <template v-if="isCompact && showEditor && selectedNote">
      <div class="sn-header">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="showEditor = false"
        />
        <span class="sn-header-title">{{ selectedNote.title }}</span>
        <UButton
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="sm"
          @click="deleteNote(selectedNote.id); showEditor = false"
        />
      </div>
      <div
        class="sn-editor"
        :class="colorClasses[selectedNote.color]"
      >
        <UInput
          v-model="selectedNote.title"
          :placeholder="t('apps.stickyNotes.titlePlaceholder')"
          variant="none"
          class="sn-title-input"
          @input="onNoteChange"
        />
        <div class="sn-color-picker">
          <button
            v-for="opt in colorOptions"
            :key="opt.value"
            class="sn-color-btn"
            :class="[`color-dot-${opt.value}`, { active: selectedNote.color === opt.value }]"
            :title="opt.label"
            @click="selectedNote.color = opt.value; onNoteChange()"
          />
        </div>
        <UTextarea
          v-model="selectedNote.content"
          :placeholder="t('apps.stickyNotes.contentPlaceholder')"
          class="sn-textarea"
          :rows="12"
          resize="none"
          variant="none"
          @input="onNoteChange"
        />
        <div class="sn-footer-date">
          {{ formatDate(selectedNote.updatedAt) }}
        </div>
      </div>
    </template>

    <!-- 通常 or コンパクト一覧 -->
    <template v-else>
      <!-- サイドバー（メモ一覧） -->
      <div class="sn-sidebar">
        <div class="sn-sidebar-header">
          <span class="sn-sidebar-title">{{ t('apps.stickyNotes.notes') }}</span>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            color="primary"
            size="sm"
            @click="createNote"
          />
        </div>
        <div class="sn-list">
          <div
            v-for="note in notes"
            :key="note.id"
            class="sn-list-item"
            :class="[colorClasses[note.color], { active: note.id === selectedId }]"
            @click="selectNote(note.id)"
          >
            <div class="sn-list-title">
              {{ note.title }}
            </div>
            <div class="sn-list-preview">
              {{ note.content.slice(0, 40) || '…' }}
            </div>
            <div class="sn-list-date">
              {{ formatDate(note.updatedAt) }}
            </div>
          </div>
          <div
            v-if="notes.length === 0"
            class="sn-empty"
          >
            <UIcon
              name="i-lucide-sticky-note"
              class="sn-empty-icon"
            />
            <p>{{ t('apps.stickyNotes.empty') }}</p>
            <UButton
              :label="t('apps.stickyNotes.create')"
              variant="outline"
              size="sm"
              @click="createNote"
            />
          </div>
        </div>
      </div>

      <!-- エディター -->
      <div
        v-if="!isCompact"
        class="sn-editor-panel"
      >
        <template v-if="selectedNote">
          <div
            class="sn-editor"
            :class="colorClasses[selectedNote.color]"
          >
            <div class="sn-editor-toolbar">
              <UInput
                v-model="selectedNote.title"
                :placeholder="t('apps.stickyNotes.titlePlaceholder')"
                variant="none"
                class="sn-title-input"
                @input="onNoteChange"
              />
              <div class="sn-color-picker">
                <button
                  v-for="opt in colorOptions"
                  :key="opt.value"
                  class="sn-color-btn"
                  :class="[`color-dot-${opt.value}`, { active: selectedNote.color === opt.value }]"
                  :title="opt.label"
                  @click="selectedNote.color = opt.value; onNoteChange()"
                />
              </div>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="sm"
                @click="deleteNote(selectedNote.id)"
              />
            </div>
            <UTextarea
              v-model="selectedNote.content"
              :placeholder="t('apps.stickyNotes.contentPlaceholder')"
              class="sn-textarea"
              resize="none"
              variant="none"
              @input="onNoteChange"
            />
            <div class="sn-footer-date">
              {{ formatDate(selectedNote.updatedAt) }}
            </div>
          </div>
        </template>
        <div
          v-else
          class="sn-editor-empty"
        >
          <UIcon
            name="i-lucide-pencil-line"
            class="sn-empty-icon"
          />
          <p>{{ t('apps.stickyNotes.selectOrCreate') }}</p>
          <UButton
            :label="t('apps.stickyNotes.create')"
            variant="outline"
            @click="createNote"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sticky-notes {
  display: flex;
  height: 100%;
  background: var(--ui-bg);
  overflow: hidden;
}

.compact {
  flex-direction: column;
}

/* サイドバー */
.sn-sidebar {
  width: 240px;
  min-width: 200px;
  border-right: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.compact .sn-sidebar {
  width: 100%;
  border-right: none;
}

.sn-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
}

.sn-header-title {
  flex: 1;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
}

.sn-sidebar-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.sn-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.sn-list-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: opacity 0.15s;
  border: 2px solid transparent;
}

.sn-list-item:hover { opacity: 0.85; }

.sn-list-item.active {
  border-color: var(--ui-color-primary-500);
}

.sn-list-title {
  font-weight: 600;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn-list-preview {
  font-size: 0.75rem;
  opacity: 0.75;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn-list-date {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-top: 4px;
}

.sn-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--ui-text-muted);
  text-align: center;
  font-size: 0.85rem;
}

.sn-empty-icon {
  font-size: 2.5rem;
  opacity: 0.35;
}

/* エディターパネル */
.sn-editor-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sn-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.sn-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.sn-title-input {
  flex: 1;
  font-weight: 600;
  font-size: 1rem;
}

.sn-textarea {
  flex: 1;
  resize: none;
  font-size: 0.9rem;
  line-height: 1.6;
}

.sn-footer-date {
  font-size: 0.72rem;
  opacity: 0.6;
  text-align: right;
  margin-top: 8px;
}

.sn-editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}

/* カラーピッカー */
.sn-color-picker {
  display: flex;
  gap: 5px;
}

.sn-color-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s;
}

.sn-color-btn:hover { transform: scale(1.2); }
.sn-color-btn.active { border-color: var(--ui-text-highlighted); transform: scale(1.15); }

.color-dot-yellow { background: #fbbf24; }
.color-dot-green { background: #4ade80; }
.color-dot-blue { background: #60a5fa; }
.color-dot-pink { background: #f9a8d4; }
.color-dot-purple { background: #c084fc; }

/* ノートカラー */
.note-yellow { background: #fef9c3; color: #713f12; }
.note-green { background: #dcfce7; color: #14532d; }
.note-blue { background: #dbeafe; color: #1e3a5f; }
.note-pink { background: #fce7f3; color: #831843; }
.note-purple { background: #f3e8ff; color: #581c87; }

:deep(.dark) .note-yellow { background: #422006; color: #fde68a; }
:deep(.dark) .note-green { background: #052e16; color: #bbf7d0; }
:deep(.dark) .note-blue { background: #172554; color: #bfdbfe; }
:deep(.dark) .note-pink { background: #500724; color: #fbcfe8; }
:deep(.dark) .note-purple { background: #3b0764; color: #e9d5ff; }
</style>
