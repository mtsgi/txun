<script setup lang="ts">
defineProps<{ windowId: string }>()

const content = ref('')
const filename = ref('untitled.txt')
const isDirty = ref(false)

watch(content, () => { isDirty.value = true })

function onSave() {
  const blob = new Blob([content.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.value
  a.click()
  URL.revokeObjectURL(url)
  isDirty.value = false
}

async function onOpen() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'text/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    filename.value = file.name
    content.value = await file.text()
    isDirty.value = false
  }
  input.click()
}
</script>

<template>
  <div class="text-editor">
    <div class="toolbar">
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-folder-open"
        :label="$t('apps.textEditor.open')"
        @click="onOpen"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-save"
        :label="$t('apps.textEditor.save')"
        @click="onSave"
      />
      <span class="filename">
        {{ filename }}<span
          v-if="isDirty"
          class="dirty"
        >*</span>
      </span>
    </div>
    <textarea
      v-model="content"
      class="editor"
      spellcheck="false"
      :placeholder="$t('apps.textEditor.placeholder')"
    />
  </div>
</template>

<style lang="scss" scoped>
.text-editor {
  display: flex;
  flex-direction: column;
  height: 100%;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-bg-elevated);
    flex-shrink: 0;

    .filename {
      margin-left: auto;
      font-size: 0.75rem;
      color: var(--ui-text-muted);
    }

    .dirty {
      color: var(--ui-warning);
    }
  }

  .editor {
    flex: 1 1 0%;
    min-height: 0;
    resize: none;
    background: transparent;
    padding: 0.75rem;
    font-family: ui-monospace, monospace;
    font-size: 0.875rem;
    outline: none;
    border: none;
    color: inherit;
    width: 100%;
  }
}
</style>
