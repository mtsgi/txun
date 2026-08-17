<script setup lang="ts">
import type { TaskbarPosition } from '../../stores/desktop'
import type { CSSProperties } from 'vue'

const props = defineProps<{
  /** タスクバーの表示位置（バーの配置を決定するために使用） */
  taskbarPosition: TaskbarPosition
}>()

const {
  desktops,
  activeId,
  addDesktop,
  removeDesktop,
  switchDesktop,
  renameDesktop,
  toggleOverview
} = useVirtualDesktop()

const editingId = ref<string | null>(null)
const editingName = ref('')

function startRename(id: string, name: string) {
  editingId.value = id
  editingName.value = name
}

function saveRename(id: string) {
  if (editingName.value.trim()) {
    renameDesktop(id, editingName.value.trim())
  }
  editingId.value = null
}

/** バーのインラインスタイル（タスクバー位置に応じて上端・下端を切り替え） */
const barStyle = computed<CSSProperties>(() =>
  props.taskbarPosition === 'top'
    ? { bottom: '0.5rem', top: 'auto' }
    : { top: '0.5rem', bottom: 'auto' }
)
</script>

<template>
  <div
    class="vdesktop-bar"
    :style="barStyle"
  >
    <!-- Overview Launcher Button -->
    <UTooltip :text="$t('core.desktop.virtualDesktop.overview')">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-panels-top-left"
        class="vdesktop-overview-btn"
        :aria-label="$t('core.desktop.virtualDesktop.overview')"
        @click="toggleOverview"
      />
    </UTooltip>

    <USeparator
      orientation="vertical"
      class="vdesktop-sep"
    />

    <div
      v-for="desktop in desktops"
      :key="desktop.id"
      class="vdesktop-item"
      :class="[
        desktop.id === activeId ? 'active' : 'inactive',
        { 'has-close': desktops.length > 1 && editingId !== desktop.id }
      ]"
    >
      <template v-if="editingId === desktop.id">
        <UInput
          v-model="editingName"
          size="xs"
          class="vdesktop-inline-input"
          autofocus
          @blur="saveRename(desktop.id)"
          @keydown.enter="saveRename(desktop.id)"
          @keydown.esc="editingId = null"
          @click.stop
        />
      </template>
      <template v-else>
        <UTooltip :text="$t('core.desktop.virtualDesktop.switchTo', { name: desktop.name })">
          <button
            type="button"
            class="vdesktop-btn"
            @click="switchDesktop(desktop.id)"
            @dblclick.stop="startRename(desktop.id, desktop.name)"
          >
            <span>{{ desktop.name }}</span>
          </button>
        </UTooltip>

        <UButton
          v-if="desktops.length > 1"
          size="xs"
          :variant="desktop.id === activeId ? 'solid' : 'ghost'"
          icon="i-lucide-x"
          class="vdesktop-close"
          :aria-label="$t('core.desktop.virtualDesktop.remove')"
          @click.stop="removeDesktop(desktop.id)"
        />
      </template>
    </div>

    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-plus"
      class="vdesktop-add"
      :aria-label="$t('core.desktop.virtualDesktop.add')"
      @click="addDesktop"
    />
  </div>
</template>

<style lang="scss" scoped>
.vdesktop-bar {
  position: absolute;
  left: 50%;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transform: translateX(-50%);
  border-radius: 9999px;
  border: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg-elevated) 80%, transparent);
  padding: 0.25rem 0.5rem;
  backdrop-filter: blur(var(--desktop-blur));
}

.vdesktop-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 9999px;
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  transition: background-color 0.15s, color 0.15s;

  &.has-close {
    padding-right: 0.25rem;
  }

  &.active {
    background: var(--ui-primary);
    color: #fff;
  }

  &.inactive {
    background: transparent;
    color: var(--ui-text-muted);

    &:hover {
      background: var(--ui-bg);
      color: var(--ui-text);
    }
  }
}

.vdesktop-btn {
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 0.75rem;
  color: inherit;
  cursor: pointer;
  line-height: 1.25rem;
}

.vdesktop-overview-btn {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
}

.vdesktop-sep {
  height: 1rem;
  margin-inline: 0.125rem;
}

.vdesktop-inline-input {
  width: 5.5rem;
}

.vdesktop-close {
  width: 1rem;
  height: 1rem;
  padding: 0;
}

.vdesktop-add {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
}
</style>
