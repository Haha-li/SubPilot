<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveBrandIcon } from '../utils/brandIcon';

const props = defineProps<{
  name: string;
  website?: string;
  iconUrl?: string;
  backgroundColor?: string;
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
const hasImage = computed(() => Boolean(iconUrl.value && !imageFailed.value));
const useFallbackTone = computed(() => !hasImage.value && !props.backgroundColor);
const foregroundColor = computed(() => {
  const color = props.backgroundColor;
  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) return '#ffffff';
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 255000;
  return luminance > 0.58 ? '#0f172a' : '#ffffff';
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
    class="flex flex-shrink-0 items-center justify-center overflow-hidden font-bold shadow-sm"
    :class="[
      useFallbackTone ? ['bg-gradient-to-br', toneClass] : '',
      small ? 'h-7 w-7 rounded-lg text-xs' : 'h-12 w-12 rounded-xl text-lg',
    ]"
    :style="{
      backgroundColor: backgroundColor || 'transparent',
      color: foregroundColor,
    }"
    aria-hidden="true"
  >
    <img
      v-if="iconUrl && !imageFailed"
      :src="iconUrl"
      alt=""
      class="object-contain"
      :class="backgroundColor
        ? (small ? 'h-4 w-4' : 'h-7 w-7')
        : 'h-full w-full'"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="imageFailed = true"
    />
    <span v-else>{{ initial }}</span>
  </div>
</template>
