<script setup lang="ts">
defineProps<{ windowId: string }>()

const { t } = useI18n()

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

const tabs = computed(() => [
  { label: t('apps.settings.appearance'), icon: 'i-lucide-palette', slot: 'appearance' },
  { label: t('apps.settings.wallpaper'), icon: 'i-lucide-image', slot: 'wallpaper' },
  { label: t('apps.settings.font'), icon: 'i-lucide-type', slot: 'font' },
  { label: t('apps.settings.language'), icon: 'i-lucide-globe', slot: 'language' },
  { label: t('apps.settings.taskbar'), icon: 'i-lucide-panel-bottom', slot: 'taskbar' },
  { label: t('apps.settings.device'), icon: 'i-lucide-cpu', slot: 'device' },
  { label: t('apps.settings.about'), icon: 'i-lucide-info', slot: 'about' }
])
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
        <SettingsAppearance />
      </template>
      <template #wallpaper>
        <SettingsWallpaper />
      </template>
      <template #font>
        <SettingsFont />
      </template>
      <template #language>
        <SettingsLanguage />
      </template>
      <template #taskbar>
        <SettingsTaskbar />
      </template>
      <template #device>
        <SettingsDevice />
      </template>
      <template #about>
        <SettingsAbout />
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
            <SettingsAppearance v-if="activeSection === 'appearance'" />
            <SettingsWallpaper v-else-if="activeSection === 'wallpaper'" />
            <SettingsFont v-else-if="activeSection === 'font'" />
            <SettingsLanguage v-else-if="activeSection === 'language'" />
            <SettingsTaskbar v-else-if="activeSection === 'taskbar'" />
            <SettingsDevice v-else-if="activeSection === 'device'" />
            <SettingsAbout v-else-if="activeSection === 'about'" />
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
</style>
