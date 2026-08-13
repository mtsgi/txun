<script setup lang="ts">
import type { FileSystemPermissionState } from '#layers/txunos-core/app/stores/filesystem'

const { t } = useI18n()
const fileSystem = useFileSystem()

const addingMount = ref(false)
const refreshingMountId = ref<string | null>(null)
const removingMountId = ref<string | null>(null)

const mountOptions = computed(() =>
  fileSystem.mounts.value.map(mount => ({
    label: mount.name,
    value: mount.id
  }))
)

const selectedMountId = computed({
  get: (): string => fileSystem.activeMountId.value ?? '',
  set: (mountId: string) => {
    void fileSystem.setActiveMount(mountId || null)
  }
})

function permissionLabel(permission: FileSystemPermissionState): string {
  if (permission === 'granted') return t('apps.settings.filesystemPermissionGranted')
  if (permission === 'prompt') return t('apps.settings.filesystemPermissionPrompt')
  if (permission === 'denied') return t('apps.settings.filesystemPermissionDenied')
  return t('apps.settings.filesystemPermissionUnknown')
}

function permissionColor(permission: FileSystemPermissionState): 'success' | 'warning' | 'error' | 'neutral' {
  if (permission === 'granted') return 'success'
  if (permission === 'prompt') return 'warning'
  if (permission === 'denied') return 'error'
  return 'neutral'
}

async function handleAddMount(): Promise<void> {
  addingMount.value = true
  try {
    await fileSystem.addMount()
  } catch {
    // ストア側で lastError を更新するためここでは握りつぶす
  } finally {
    addingMount.value = false
  }
}

async function handleRefreshPermission(mountId: string): Promise<void> {
  refreshingMountId.value = mountId
  try {
    await fileSystem.refreshPermission(mountId)
  } catch {
    // ストア側で lastError を更新するためここでは握りつぶす
  } finally {
    refreshingMountId.value = null
  }
}

async function handleRemoveMount(mountId: string): Promise<void> {
  removingMountId.value = mountId
  try {
    await fileSystem.removeMount(mountId)
  } catch {
    // ストア側で lastError を更新するためここでは握りつぶす
  } finally {
    removingMountId.value = null
  }
}

onMounted(async () => {
  await fileSystem.restoreMounts()
})
</script>

<template>
  <div class="section-content">
    <h3 class="section-title">
      {{ $t('apps.settings.filesystem') }}
    </h3>

    <p class="field-desc">
      {{ $t('apps.settings.filesystemDescription') }}
    </p>

    <UAlert
      v-if="!fileSystem.isSupported.value"
      icon="i-lucide-info"
      color="neutral"
      variant="soft"
      :description="$t('apps.settings.filesystemUnsupported')"
      class="field"
    />

    <template v-else>
      <div class="field field-inline">
        <div>
          <p class="field-label">
            {{ $t('apps.settings.filesystemActiveMount') }}
          </p>
          <p class="field-desc">
            {{ fileSystem.activeMount.value?.name ?? $t('apps.settings.filesystemNone') }}
          </p>
        </div>
        <UButton
          icon="i-lucide-folder-plus"
          :label="$t('apps.settings.filesystemAddMount')"
          :loading="addingMount || fileSystem.isRequesting.value"
          variant="outline"
          color="primary"
          @click="handleAddMount"
        />
      </div>

      <div
        v-if="fileSystem.mounts.value.length === 0"
        class="empty"
      >
        {{ $t('apps.settings.filesystemNoMounts') }}
      </div>

      <template v-else>
        <div class="field">
          <p class="field-label">
            {{ $t('apps.settings.filesystemActiveMount') }}
          </p>
          <USelect
            v-model="selectedMountId"
            :items="mountOptions"
            value-key="value"
            class="w-full max-w-sm"
          />
        </div>

        <div class="mount-list">
          <div
            v-for="mount in fileSystem.mounts.value"
            :key="mount.id"
            class="mount-item"
          >
            <div class="mount-meta">
              <p class="mount-name">
                {{ mount.name }}
              </p>
              <UBadge
                size="xs"
                :label="permissionLabel(mount.permission)"
                :color="permissionColor(mount.permission)"
                variant="soft"
              />
            </div>
            <div class="mount-actions">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-refresh-cw"
                :label="$t('apps.settings.filesystemRefreshPermission')"
                :loading="refreshingMountId === mount.id"
                @click="handleRefreshPermission(mount.id)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                :label="$t('apps.settings.filesystemRemoveMount')"
                :loading="removingMountId === mount.id"
                @click="handleRemoveMount(mount.id)"
              />
            </div>
          </div>
        </div>
      </template>
    </template>

    <UAlert
      v-if="fileSystem.lastError.value"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="soft"
      :description="fileSystem.lastError.value"
      class="field"
    />
  </div>
</template>

<style lang="scss" scoped>
.section-content {
  padding: 1.25rem;

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
}

.field {
  margin-bottom: 1rem;
}

.field-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  margin: 0 0 0.25rem;
}

.field-desc {
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
  margin: 0 0 1rem;
}

.empty {
  border: 1px dashed var(--ui-border);
  border-radius: 0.75rem;
  padding: 0.875rem;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.mount-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mount-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.625rem;
  background: var(--ui-bg-elevated);
}

.mount-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.mount-name {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 16rem;
}

.mount-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
