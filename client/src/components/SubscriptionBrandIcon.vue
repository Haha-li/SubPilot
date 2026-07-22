<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveBrandIcon } from '../utils/brandIcon';

const props = defineProps<{
  name: string;
}>();

const palette = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-blue-500',
  'from-lime-500 to-green-600',
];

const iconUrl = ref<string | null>(null);
const imageFailed = ref(false);
let requestVersion = 0;

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');
const toneClass = computed(() => {
  let hash = 0;
  for (const char of props.name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
});

watch(() => props.name, async (name) => {
  const version = ++requestVersion;
  iconUrl.value = null;
  imageFailed.value = false;
  const resolvedUrl = await resolveBrandIcon(name);
  if (version === requestVersion) iconUrl.value = resolvedUrl;
}, { immediate: true });
</script>

<template>
  <div
    class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-white shadow-sm"
    :class="toneClass"
    aria-hidden="true"
  >
    <img
      v-if="iconUrl && !imageFailed"
      :src="iconUrl"
      alt=""
      class="h-7 w-7 object-contain"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="imageFailed = true"
    />
    <span v-else>{{ initial }}</span>
  </div>
</template>
