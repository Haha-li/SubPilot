<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Globe2, Image, Loader2, Palette, Search, Upload, X } from '@lucide/vue';
import { useCommonSubscriptionStore } from '../stores/commonSubscription';
import { resolveBrandIcon } from '../utils/brandIcon';
import {
  AVATAR_UPLOAD_ACCEPT,
  readAvatarFile,
  validateAvatarFile,
} from '../utils/avatarUpload';
import SubscriptionBrandIcon from './SubscriptionBrandIcon.vue';

const props = defineProps<{
  name: string;
  website: string;
  iconUrl: string;
  backgroundColor: string;
}>();
const emit = defineEmits<{
  'update:iconUrl': [value: string];
  'update:backgroundColor': [value: string];
  'busy-change': [value: boolean];
}>();

const store = useCommonSubscriptionStore();
const searchingIcon = ref(false);
const fetchingWebsiteIcon = ref(false);
const uploadingAvatar = ref(false);
const uploadInput = ref<HTMLInputElement | null>(null);
const backgroundPresets = ['#111827', '#2563EB', '#7C3AED', '#059669', '#DC2626'];

const iconUrl = computed({
  get: () => props.iconUrl,
  set: (value: string) => emit('update:iconUrl', value),
});
const backgroundColor = computed({
  get: () => props.backgroundColor,
  set: (value: string) => emit('update:backgroundColor', value),
});
const busy = computed(() => (
  searchingIcon.value || fetchingWebsiteIcon.value || uploadingAvatar.value
));
const isUploadedAvatar = computed(() => iconUrl.value.startsWith('data:image/'));

watch(busy, (value) => emit('busy-change', value), { immediate: true });

function handleCustomColor(event: Event) {
  backgroundColor.value = (event.target as HTMLInputElement).value.toUpperCase();
}

async function findIcon(silent = false) {
  if (busy.value) return;
  if (!props.name.trim() && !props.website.trim()) {
    if (!silent) ElMessage.warning('请先填写名称或网站');
    return;
  }

  searchingIcon.value = true;
  try {
    const foundIcon = await resolveBrandIcon(props.name, props.website, true);
    if (foundIcon) {
      iconUrl.value = foundIcon;
      if (!silent) ElMessage.success('已找到合适的头像');
    } else if (!silent) {
      ElMessage.info('暂未找到头像，可上传本地图片');
    }
  } finally {
    searchingIcon.value = false;
  }
}

async function fetchIconFromWebsite() {
  if (busy.value) return;
  if (!props.website.trim()) {
    ElMessage.warning('请先填写网站地址');
    return;
  }

  fetchingWebsiteIcon.value = true;
  try {
    iconUrl.value = await store.fetchWebsiteIcon(props.website);
    ElMessage.success('已获取网站声明的头像');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取网站头像失败');
  } finally {
    fetchingWebsiteIcon.value = false;
  }
}

async function handleAvatarUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const validationError = validateAvatarFile(file);
  if (validationError) {
    ElMessage.error(validationError);
    input.value = '';
    return;
  }

  uploadingAvatar.value = true;
  try {
    iconUrl.value = await readAvatarFile(file);
    ElMessage.success('头像已上传');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '读取头像文件失败');
  } finally {
    uploadingAvatar.value = false;
    input.value = '';
  }
}

defineExpose({ findIcon });
</script>

<template>
  <section class="grid gap-4 rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20 sm:grid-cols-[72px_minmax(0,1fr)]">
    <div class="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-ink-50 dark:bg-ink-900/30">
      <SubscriptionBrandIcon
        :name="name"
        :website="website"
        :icon-url="iconUrl"
        :background-color="backgroundColor"
      />
    </div>
    <div class="min-w-0">
      <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <span class="flex items-center gap-1.5 text-xs font-medium text-ink-700 dark:text-ink-200 sm:pt-3">
          <Image :size="13" /> 头像
        </span>
        <div class="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            :disabled="busy"
            @click="findIcon()"
          >
            <component :is="searchingIcon ? Loader2 : Search" :size="13" :class="searchingIcon && 'animate-spin'" />
            {{ searchingIcon ? '搜索中' : '搜索品牌' }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 bg-white/70 px-3 text-xs font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-300 dark:hover:border-brand-500/60 dark:hover:text-brand-300"
            :disabled="busy || !website.trim()"
            @click="fetchIconFromWebsite"
          >
            <component :is="fetchingWebsiteIcon ? Loader2 : Globe2" :size="13" :class="fetchingWebsiteIcon && 'animate-spin'" />
            {{ fetchingWebsiteIcon ? '获取中' : '获取网页图标' }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/60 px-3 text-xs font-semibold text-brand-600 transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-300"
            :disabled="busy"
            @click="uploadInput?.click()"
          >
            <component :is="uploadingAvatar ? Loader2 : Upload" :size="13" :class="uploadingAvatar && 'animate-spin'" />
            {{ uploadingAvatar ? '读取中' : (isUploadedAvatar ? '重新上传' : '上传图片') }}
          </button>
          <input
            ref="uploadInput"
            type="file"
            class="sr-only"
            :accept="AVATAR_UPLOAD_ACCEPT"
            :disabled="busy"
            aria-label="上传本地头像"
            @change="handleAvatarUpload"
          />
        </div>
      </div>

      <div v-if="isUploadedAvatar" class="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-3 text-xs text-success" role="status">
        <span class="truncate">已上传本地图片，将随常用订阅保存</span>
        <button type="button" class="inline-flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-success/10" aria-label="移除上传头像" @click="iconUrl = ''">
          <X :size="14" />
        </button>
      </div>
      <el-input v-else id="common-icon-url" v-model="iconUrl" clearable aria-label="头像地址" placeholder="支持填写 http/https 图片地址" />
      <p class="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
        支持网络图片，或上传不超过 256 KB 的 PNG、JPG、WebP、GIF、AVIF、ICO
      </p>

      <div class="mt-4 border-t border-ink-200/70 pt-3 dark:border-ink-700/50">
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-xs font-medium text-ink-700 dark:text-ink-200">
            <Palette :size="13" /> 背景色（可选）
          </span>
          <span class="text-xs text-ink-400 dark:text-ink-500">{{ backgroundColor || '无背景' }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="头像背景色">
          <button
            type="button"
            role="radio"
            :aria-checked="!backgroundColor"
            class="inline-flex h-11 cursor-pointer items-center rounded-xl border px-3 text-xs font-semibold transition-colors"
            :class="!backgroundColor
              ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
              : 'border-ink-200 text-ink-500 hover:border-brand-300 dark:border-ink-700 dark:text-ink-400'"
            @click="backgroundColor = ''"
          >
            无背景
          </button>
          <button
            v-for="color in backgroundPresets"
            :key="color"
            type="button"
            role="radio"
            :aria-label="`背景色 ${color}`"
            :aria-checked="backgroundColor === color"
            class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            :class="backgroundColor === color ? 'border-brand-500 ring-2 ring-brand-500/25' : 'border-ink-200 dark:border-ink-700'"
            @click="backgroundColor = color"
          >
            <span class="h-6 w-6 rounded-lg shadow-sm ring-1 ring-black/10" :style="{ backgroundColor: color }" />
          </button>
          <label class="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-ink-300 text-ink-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-ink-600 dark:text-ink-400" title="自定义背景色">
            <Palette :size="17" />
            <input
              type="color"
              :value="backgroundColor || '#409EFF'"
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="自定义头像背景色"
              @input="handleCustomColor"
            />
          </label>
        </div>
        <p class="mt-2 text-xs text-ink-400 dark:text-ink-500">
          不选择背景色时，头像图片会无内边距铺满整个区域。
        </p>
      </div>
    </div>
  </section>
</template>
