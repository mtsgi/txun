<script setup lang="ts">
import type { TaskbarPosition, TaskbarSize, TaskbarTaskAlign, TaskbarTaskDisplay } from '#layers/txunos-core/app/stores/desktop'

const store = useDesktopStore()
</script>

<template>
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

.option-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
