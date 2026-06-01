<script setup lang="ts">
/** 時間帯別（24 時間）棒グラフコンポーネント */
const props = defineProps<{
  /** hourly[0..23] デスクトップ使用秒数 */
  hourly: number[]
}>()

const currentHour = new Date().getHours()
const maxVal = computed(() => Math.max(...props.hourly, 1))
</script>

<template>
  <div class="flex items-end gap-px h-14 w-full">
    <div
      v-for="(val, i) in hourly"
      :key="i"
      class="flex-1 rounded-t min-h-px transition-all duration-300"
      :class="i === currentHour ? 'bg-primary' : 'bg-primary/35'"
      :style="{ height: (val / maxVal * 100) + '%' }"
      :title="`${i}:00 — ${Math.floor(val / 60)}分`"
    />
  </div>
</template>
