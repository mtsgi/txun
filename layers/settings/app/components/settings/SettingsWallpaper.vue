<script setup lang="ts">
import type { WallpaperFit } from '#layers/txunos-core/app/stores/desktop'

const store = useDesktopStore()
const { t } = useI18n()
const fileSystem = useFileSystem()
const { notify } = useDesktopNotification()

const activeSubTab = ref<'presets' | 'online' | 'vfs' | 'adjust'>('presets')

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

// --- URL & VFS States ---
const wallpaperUrlInput = ref('')
const isVfsLoading = ref(false)

function applyWallpaperUrl(): void {
  const url = wallpaperUrlInput.value.trim()
  if (url) {
    store.setWallpaper(url)
    notify(t('apps.settings.wallpaperApplied'), { type: 'success' })
  }
}

async function selectFromVfs(): Promise<void> {
  const fileDialog = useFileDialog()
  const res = await fileDialog.open({
    title: t('apps.settings.wallpaperSelectVfs'),
    mode: 'open-file',
    filters: ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif', '.bmp', '.tif', '.tiff'],
    multiple: false
  })
  if (res && !Array.isArray(res)) {
    isVfsLoading.value = true
    try {
      const blob = await fileSystem.readFileBlob(res.path, res.mountId)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          store.setWallpaper(reader.result)
          notify(t('apps.settings.wallpaperApplied'), { type: 'success' })
        }
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      notify(err instanceof Error ? err.message : t('apps.fileManager.errorGeneric'), { type: 'error' })
    } finally {
      isVfsLoading.value = false
    }
  }
}

// --- Openverse Online Search ---
interface OpenverseImage {
  id: string
  title: string
  creator: string
  creator_url?: string
  url: string
  thumbnail: string
  license: string
  license_version: string
  foreign_landing_url?: string
}

const searchQuery = ref('')
const isSearching = ref(false)
const searchError = ref<string | null>(null)
const searchResults = ref<OpenverseImage[]>([])
const currentPage = ref(1)
const totalPages = ref(1)
const hasSearched = ref(false)

const quickCategories = computed(() => [
  { key: 'nature', label: t('apps.settings.wallpaperCategoryNature'), query: 'nature landscape wallpaper' },
  { key: 'space', label: t('apps.settings.wallpaperCategorySpace'), query: 'space galaxy nebula astronomy' },
  { key: 'architecture', label: t('apps.settings.wallpaperCategoryArchitecture'), query: 'city architecture building modern' },
  { key: 'abstract', label: t('apps.settings.wallpaperCategoryAbstract'), query: 'abstract geometry pattern texture' },
  { key: 'minimal', label: t('apps.settings.wallpaperCategoryMinimal'), query: 'minimal wallpaper simple clean' },
  { key: 'art', label: t('apps.settings.wallpaperCategoryAnime'), query: 'illustration digital art painting' }
])

async function searchOnlineImages(query: string, page = 1, append = false): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed) return

  isSearching.value = true
  searchError.value = null
  hasSearched.value = true
  currentPage.value = page

  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(trimmed)}&page=${page}&page_size=20`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Openverse API returned status ${res.status}`)
    }
    const data = await res.json()
    const items: OpenverseImage[] = (data.results || []).map((item: Record<string, unknown>) => ({
      id: String(item.id || Math.random()),
      title: String(item.title || 'Untitled'),
      creator: String(item.creator || 'Unknown'),
      creator_url: item.creator_url ? String(item.creator_url) : undefined,
      url: String(item.url || ''),
      thumbnail: String(item.thumbnail || item.url || ''),
      license: String(item.license || '').toUpperCase(),
      license_version: String(item.license_version || ''),
      foreign_landing_url: item.foreign_landing_url ? String(item.foreign_landing_url) : undefined
    })).filter((img: OpenverseImage) => img.url)

    if (append) {
      searchResults.value = [...searchResults.value, ...items]
    } else {
      searchResults.value = items
    }
    totalPages.value = data.page_count || 1
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : t('apps.settings.wallpaperSearchError')
    if (!append) searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

function handleSearch(): void {
  void searchOnlineImages(searchQuery.value, 1, false)
}

function selectCategory(catQuery: string): void {
  searchQuery.value = catQuery
  void searchOnlineImages(catQuery, 1, false)
}

function loadMore(): void {
  if (currentPage.value < totalPages.value && !isSearching.value) {
    void searchOnlineImages(searchQuery.value, currentPage.value + 1, true)
  }
}

function applyOnlineImage(img: OpenverseImage): void {
  store.setWallpaper(img.url)
  notify(t('apps.settings.wallpaperApplied'), { type: 'success' })
}

// Initial fetch on entering online tab if empty
watch(activeSubTab, (tab) => {
  if (tab === 'online' && !hasSearched.value) {
    searchQuery.value = 'nature landscape wallpaper'
    void searchOnlineImages('nature landscape wallpaper', 1, false)
  }
})

// --- Display Adjustments ---
const fitOptions: { labelKey: string, value: WallpaperFit }[] = [
  { labelKey: 'apps.settings.wallpaperFitCover', value: 'cover' },
  { labelKey: 'apps.settings.wallpaperFitContain', value: 'contain' },
  { labelKey: 'apps.settings.wallpaperFitCenter', value: 'center' },
  { labelKey: 'apps.settings.wallpaperFitFill', value: 'fill' }
]

function resetAdjustments(): void {
  store.setWallpaperFit('cover')
  store.setWallpaperBrightness(100)
  store.setWallpaperBlur(0)
}
</script>

<template>
  <div class="wallpaper-settings">
    <div class="wallpaper-header">
      <h3 class="section-title">
        {{ $t('apps.settings.wallpaper') }}
      </h3>

      <!-- Sub-Tabs Navigation -->
      <div class="sub-tabs">
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'presets' }"
          @click="activeSubTab = 'presets'"
        >
          <UIcon
            name="i-lucide-grid-2x2"
            class="tab-icon"
          />
          <span>{{ $t('apps.settings.wallpaperTabPresets') }}</span>
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'online' }"
          @click="activeSubTab = 'online'"
        >
          <UIcon
            name="i-lucide-globe"
            class="tab-icon"
          />
          <span>{{ $t('apps.settings.wallpaperTabOnline') }}</span>
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'vfs' }"
          @click="activeSubTab = 'vfs'"
        >
          <UIcon
            name="i-lucide-hard-drive"
            class="tab-icon"
          />
          <span>{{ $t('apps.settings.wallpaperTabVfs') }}</span>
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'adjust' }"
          @click="activeSubTab = 'adjust'"
        >
          <UIcon
            name="i-lucide-sliders"
            class="tab-icon"
          />
          <span>{{ $t('apps.settings.wallpaperTabAdjust') }}</span>
        </button>
      </div>
    </div>

    <!-- 1. Presets Tab -->
    <div
      v-if="activeSubTab === 'presets'"
      class="tab-content"
    >
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
        >
          <span
            v-if="store.wallpaper === wp.id"
            class="active-indicator"
          >
            <UIcon
              name="i-lucide-check"
              class="check-icon"
            />
          </span>
        </button>
      </div>

      <p class="field-label wallpaper-section-label">
        {{ $t('apps.settings.wallpaperPhotos') }}
      </p>
      <div class="wallpaper-presets">
        <button
          v-for="wp in photoWallpapers"
          :key="wp.id"
          class="wallpaper-swatch photo-swatch"
          :class="store.wallpaper === wp.wallUrl ? 'active' : ''"
          :style="{ backgroundImage: `url(${wp.thumbUrl})` }"
          :title="wp.label"
          @click="store.setWallpaper(wp.wallUrl)"
        >
          <span
            v-if="store.wallpaper === wp.wallUrl"
            class="active-indicator"
          >
            <UIcon
              name="i-lucide-check"
              class="check-icon"
            />
          </span>
        </button>
      </div>
    </div>

    <!-- 2. Online Search Tab (Openverse) -->
    <div
      v-else-if="activeSubTab === 'online'"
      class="tab-content"
    >
      <div class="search-box-row">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          class="flex-1"
          :placeholder="$t('apps.settings.wallpaperSearchPlaceholder')"
          @keydown.enter="handleSearch"
        />
        <UButton
          :label="$t('apps.settings.wallpaperSearchBtn')"
          color="primary"
          variant="solid"
          size="sm"
          :loading="isSearching"
          @click="handleSearch"
        />
      </div>

      <!-- Quick category chips -->
      <div class="category-chips">
        <button
          v-for="cat in quickCategories"
          :key="cat.key"
          class="category-chip"
          @click="selectCategory(cat.query)"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- Search Error Alert -->
      <UAlert
        v-if="searchError"
        icon="i-lucide-alert-circle"
        color="error"
        variant="soft"
        :description="searchError"
        class="state-alert"
      />

      <!-- Image Grid -->
      <div
        v-if="searchResults.length > 0"
        class="online-gallery-grid"
      >
        <div
          v-for="img in searchResults"
          :key="img.id"
          class="online-image-card"
          :class="{ active: store.wallpaper === img.url }"
          @click="applyOnlineImage(img)"
        >
          <img
            :src="img.thumbnail"
            :alt="img.title"
            class="online-thumb"
            loading="lazy"
          >
          <span
            v-if="store.wallpaper === img.url"
            class="active-indicator"
          >
            <UIcon
              name="i-lucide-check"
              class="check-icon"
            />
          </span>
          <div class="image-meta">
            <span
              class="image-title"
              :title="img.title"
            >{{ img.title }}</span>
            <span class="image-author">{{ $t('apps.settings.wallpaperAuthor', { name: img.creator }) }}</span>
            <span
              v-if="img.license"
              class="license-tag"
            >{{ img.license }}</span>
          </div>
        </div>
      </div>

      <!-- Loading skeleton -->
      <div
        v-if="isSearching && searchResults.length === 0"
        class="online-gallery-loading"
      >
        <UIcon
          name="i-lucide-refresh-cw"
          class="spin-icon"
        />
        <span>{{ $t('apps.settings.wallpaperSearchSearching') }}</span>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!isSearching && hasSearched && searchResults.length === 0 && !searchError"
        class="empty-state"
      >
        <UIcon
          name="i-lucide-image-off"
          class="empty-icon"
        />
        <p>{{ $t('apps.settings.wallpaperSearchEmpty') }}</p>
      </div>

      <!-- Load More Button -->
      <div
        v-if="searchResults.length > 0 && currentPage < totalPages"
        class="load-more-row"
      >
        <UButton
          :label="$t('apps.settings.wallpaperLoadMore')"
          variant="outline"
          color="neutral"
          size="sm"
          :loading="isSearching"
          @click="loadMore"
        />
      </div>
    </div>

    <!-- 3. VFS / Custom URL Tab -->
    <div
      v-else-if="activeSubTab === 'vfs'"
      class="tab-content"
    >
      <!-- VFS Section -->
      <div class="field card-section">
        <p class="field-label">
          <UIcon
            name="i-lucide-folder-tree"
            class="label-icon"
          />
          {{ $t('apps.settings.wallpaperSelectVfs') }}
        </p>
        <p class="section-description">
          {{ $t('apps.settings.wallpaperVfsHint') }}
        </p>
        <div class="btn-row">
          <UButton
            icon="i-lucide-folder-open"
            :label="$t('apps.settings.wallpaperSelectVfs')"
            color="primary"
            variant="solid"
            size="sm"
            :loading="isVfsLoading"
            @click="selectFromVfs"
          />
        </div>
      </div>

      <!-- Custom URL Section -->
      <div class="field card-section">
        <p class="field-label">
          <UIcon
            name="i-lucide-link"
            class="label-icon"
          />
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

    <!-- 4. Display Adjustments Tab -->
    <div
      v-else-if="activeSubTab === 'adjust'"
      class="tab-content"
    >
      <!-- Fit Mode -->
      <div class="field">
        <p class="field-label">
          <UIcon
            name="i-lucide-scan"
            class="label-icon"
          />
          {{ $t('apps.settings.wallpaperFit') }}
        </p>
        <div class="fit-options-grid">
          <button
            v-for="opt in fitOptions"
            :key="opt.value"
            class="fit-option-card"
            :class="{ active: (store.wallpaperFit || 'cover') === opt.value }"
            @click="store.setWallpaperFit(opt.value)"
          >
            <span class="fit-name">{{ $t(opt.labelKey) }}</span>
          </button>
        </div>
      </div>

      <!-- Brightness Slider -->
      <div class="field">
        <div class="field-header-row">
          <p class="field-label">
            <UIcon
              name="i-lucide-sun"
              class="label-icon"
            />
            {{ $t('apps.settings.wallpaperBrightness') }}
          </p>
          <span class="field-value-badge">{{ store.wallpaperBrightness ?? 100 }}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="150"
          step="5"
          :value="store.wallpaperBrightness ?? 100"
          class="custom-range-slider"
          @input="(e) => store.setWallpaperBrightness(Number((e.target as HTMLInputElement).value))"
        >
      </div>

      <!-- Blur Slider -->
      <div class="field">
        <div class="field-header-row">
          <p class="field-label">
            <UIcon
              name="i-lucide-sparkles"
              class="label-icon"
            />
            {{ $t('apps.settings.wallpaperBlur') }}
          </p>
          <span class="field-value-badge">{{ store.wallpaperBlur ?? 0 }}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          :value="store.wallpaperBlur ?? 0"
          class="custom-range-slider"
          @input="(e) => store.setWallpaperBlur(Number((e.target as HTMLInputElement).value))"
        >
      </div>

      <!-- Reset button -->
      <div class="reset-row">
        <UButton
          icon="i-lucide-rotate-ccw"
          :label="$t('apps.settings.wallpaperResetAdjust')"
          variant="outline"
          color="neutral"
          size="sm"
          @click="resetAdjustments"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-settings {
  padding: 1.25rem;
}

.wallpaper-header {
  margin-bottom: 1.25rem;

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    color: var(--ui-text);
  }
}

.sub-tabs {
  display: flex;
  gap: 0.375rem;
  background: var(--ui-bg-elevated);
  padding: 0.25rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.sub-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  border: none;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;

  &:hover {
    color: var(--ui-text);
    background: var(--ui-bg);
  }

  &.active {
    color: var(--ui-primary);
    background: var(--ui-bg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    font-weight: 600;
  }

  .tab-icon {
    font-size: 1rem;
  }
}

.tab-content {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
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

  .label-icon {
    font-size: 1rem;
    color: var(--ui-primary);
  }
}

.field-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;

  .field-label {
    margin-bottom: 0;
  }

  .field-value-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--ui-bg-elevated);
    color: var(--ui-primary);
    border: 1px solid var(--ui-border);
  }
}

.section-description {
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
  margin: 0 0 0.75rem;
}

.card-section {
  padding: 1rem;
  border-radius: 0.5rem;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
}

.wallpaper-section-label {
  margin-top: 1.25rem;
}

.wallpaper-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.75rem;
}

.wallpaper-swatch {
  height: 4.25rem;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    transform: scale(1.04);
  }

  &.photo-swatch {
    background-size: cover;
    background-position: center;
  }

  &.active {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 2px var(--ui-bg), 0 0 0 4px var(--ui-primary);
  }
}

.active-indicator {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 1.25rem;
  height: 1.25rem;
  background: var(--ui-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);

  .check-icon {
    font-size: 0.875rem;
  }
}

.search-box-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.category-chip {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--ui-bg);
    color: var(--ui-text);
    border-color: var(--ui-primary);
  }
}

.state-alert {
  margin-bottom: 1rem;
}

.online-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.online-image-card {
  height: 6.5rem;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
  border: 2px solid transparent;
  cursor: pointer;
  background: var(--ui-bg-elevated);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    .image-meta {
      opacity: 1;
    }
  }

  &.active {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 2px var(--ui-bg), 0 0 0 4px var(--ui-primary);
  }

  .online-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .image-meta {
    position: absolute;
    inset: auto 0 0 0;
    padding: 0.375rem 0.5rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
    color: white;
    font-size: 0.6875rem;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    pointer-events: none;

    .image-title {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .image-author {
      font-size: 0.625rem;
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .license-tag {
      display: inline-block;
      font-size: 0.5625rem;
      background: rgba(255, 255, 255, 0.2);
      padding: 0.0625rem 0.25rem;
      border-radius: 0.25rem;
      width: fit-content;
    }
  }
}

.online-gallery-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 0;
  color: var(--ui-text-muted);
  font-size: 0.875rem;

  .spin-icon {
    font-size: 1.25rem;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: var(--ui-text-muted);
  gap: 0.5rem;

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }
}

.load-more-row {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.wallpaper-url-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.fit-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.5rem;
}

.fit-option-card {
  padding: 0.625rem 0.75rem;
  border-radius: 0.375rem;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  color: var(--ui-text);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--ui-primary);
  }

  &.active {
    background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
    border-color: var(--ui-primary);
    color: var(--ui-primary);
    font-weight: 600;
  }
}

.custom-range-slider {
  width: 100%;
  accent-color: var(--ui-primary);
  cursor: pointer;
}

.reset-row {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
</style>
