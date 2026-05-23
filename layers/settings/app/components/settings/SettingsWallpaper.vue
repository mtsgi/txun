<script setup lang="ts">
const store = useDesktopStore()

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

const wallpaperUrlInput = ref('')

function applyWallpaperUrl(): void {
  const url = wallpaperUrlInput.value.trim()
  if (url) {
    store.setWallpaper(url)
  }
}
</script>

<template>
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

.wallpaper-section-label {
  margin-top: 1rem;
}

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
</style>
