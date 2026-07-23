<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveBrandIcon } from '../utils/brandIcon';

const props = defineProps<{
  name: string;
  website?: string;
  iconUrl?: string;
  small?: boolean;
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

watch(() => [props.name, props.website, props.iconUrl] as const, async ([name, website, providedIcon]) => {
  const version = ++requestVersion;
  iconUrl.value = null;
  imageFailed.value = false;
  if (providedIcon) {
    iconUrl.value = providedIcon;
    return;
  }
  const resolvedUrl = await resolveBrandIcon(name, website);
  if (version === requestVersion) iconUrl.value = resolvedUrl;
}, { immediate: true });
</script>

<template>
  <div
    class="flex flex-shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-sm"
    :class="[
      toneClass,
      small ? 'h-7 w-7 rounded-lg text-xs' : 'h-12 w-12 rounded-xl text-lg',
    ]"
    aria-hidden="true"
  >
    <img
      v-if="iconUrl && !imageFailed"
      :src="iconUrl"
      alt=""
      class="object-contain"
      :class="small ? 'h-4 w-4' : 'h-7 w-7'"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="imageFailed = true"
    />
    <span v-else>{{ initial }}</span>
  </div>
</template>
