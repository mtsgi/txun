<script setup lang="ts">
const { desktops, activeId, addDesktop, removeDesktop, switchDesktop } = useVirtualDesktop()
</script>

<template>
  <div class="vdesktop-bar">
    <button
      v-for="desktop in desktops"
      :key="desktop.id"
      class="vdesktop-btn"
      :class="desktop.id === activeId ? 'active' : 'inactive'"
      @click="switchDesktop(desktop.id)"
    >
      {{ desktop.name }}
      <UButton
        v-if="desktops.length > 1"
        size="xs"
        variant="ghost"
        icon="i-lucide-x"
        class="vdesktop-close"
        @click.stop="removeDesktop(desktop.id)"
      />
    </button>

    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-plus"
      class="vdesktop-add"
      :aria-label="$t('desktop.virtualDesktop.add')"
      @click="addDesktop"
    />
  </div>
</template>

<style lang="scss" scoped>
.vdesktop-bar {
  position: absolute;
  left: 50%;
  top: 0.5rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transform: translateX(-50%);
  border-radius: 9999px;
  border: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg-elevated) 80%, transparent);
  padding: 0.25rem 0.5rem;
  backdrop-filter: blur(12px);
}

.vdesktop-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  color: inherit;

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

.vdesktop-close {
  margin-right: -0.25rem;
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
