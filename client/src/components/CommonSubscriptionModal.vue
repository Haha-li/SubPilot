<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { Image, Loader2, Save, Search, Sparkles, X } from '@lucide/vue';
import {
  type CommonSubscription,
  useCommonSubscriptionStore,
} from '../stores/commonSubscription';
import { getWebsiteHostname, resolveBrandIcon } from '../utils/brandIcon';
import SubscriptionBrandIcon from './SubscriptionBrandIcon.vue';

const props = defineProps<{ item: CommonSubscription | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useCommonSubscriptionStore();
const isMobile = useMediaQuery('(max-width: 768px)');
const form = ref({ name: '', website: '', iconUrl: '' });
const dialogVisible = ref(true);
const saving = ref(false);
const searchingIcon = ref(false);
const nameError = ref('');

const isEditing = computed(() => Boolean(props.item));
const title = computed(() => (isEditing.value ? '编辑常用订阅' : '新增常用订阅'));
const websiteHost = computed(() => getWebsiteHostname(form.value.website));

async function findIcon(silent = false) {
  if (searchingIcon.value) return;
  if (!form.value.name.trim() && !form.value.website.trim()) {
    if (!silent) ElMessage.warning('请先填写名称或网站');
    return;
  }

  searchingIcon.value = true;
  try {
    const iconUrl = await resolveBrandIcon(form.value.name, form.value.website, true);
    if (iconUrl) {
      form.value.iconUrl = iconUrl;
      if (!silent) ElMessage.success('已找到合适的头像');
    } else if (!silent) {
      ElMessage.info('暂未找到头像，可手动填写头像地址');
    }
  } finally {
    searchingIcon.value = false;
  }
}

function handleClose() {
  emit('close');
}

async function handleSubmit() {
  nameError.value = form.value.name.trim() ? '' : '请输入名称';
  if (nameError.value) return;

  saving.value = true;
  try {
    if (!form.value.iconUrl) await findIcon(true);
    const payload = { ...form.value };
    if (props.item) await store.updateItem(props.item.id, payload);
    else await store.createItem(payload);
    ElMessage.success(props.item ? '已更新常用订阅' : '已添加常用订阅');
    emit('saved');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!props.item) return;
  form.value = {
    name: props.item.name,
    website: props.item.website || '',
    iconUrl: props.item.iconUrl || '',
  };
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :width="isMobile ? '94%' : '620px'"
    :close-on-click-modal="false"
    :show-close="false"
    class="common-subscription-modal"
    @close="handleClose"
  >
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Sparkles :size="18" />
          </div>
          <div class="min-w-0">
            <h3 class="font-heading text-base font-bold text-ink-900 dark:text-ink-50">{{ title }}</h3>
            <p class="truncate text-xs text-ink-500 dark:text-ink-400">保存后可快速打开网站或创建订阅</p>
          </div>
        </div>
        <button class="inline-flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800/60 dark:hover:text-ink-200" aria-label="关闭" @click="handleClose">
          <X :size="18" />
        </button>
      </div>
    </template>

    <div class="space-y-5">
      <section class="grid gap-4 rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20 sm:grid-cols-[72px_minmax(0,1fr)]">
        <div class="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-ink-50 dark:bg-ink-900/30">
          <SubscriptionBrandIcon :name="form.name" :website="form.website" :icon-url="form.iconUrl" />
        </div>
        <div class="min-w-0">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label for="common-icon-url" class="flex items-center gap-1.5 text-xs font-medium text-ink-700 dark:text-ink-200">
              <Image :size="13" /> 头像地址
            </label>
            <button
              type="button"
              class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
              :disabled="searchingIcon"
              @click="findIcon()"
            >
              <component :is="searchingIcon ? Loader2 : Search" :size="13" :class="searchingIcon && 'animate-spin'" />
              {{ searchingIcon ? '搜索中' : '自动获取' }}
            </button>
          </div>
          <el-input id="common-icon-url" v-model="form.iconUrl" clearable placeholder="留空则根据名称和网站自动查找" />
          <p class="mt-1.5 text-xs text-ink-400 dark:text-ink-500">支持手动填写 http/https 图片地址</p>
        </div>
      </section>

      <section class="space-y-4 rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <div>
          <label for="common-name" class="mb-1.5 block text-xs font-medium text-ink-700 dark:text-ink-200">名称<span class="text-danger">*</span></label>
          <el-input id="common-name" v-model="form.name" maxlength="100" show-word-limit placeholder="例如：Netflix、Notion" @input="nameError = ''" />
          <p v-if="nameError" class="mt-1.5 text-xs text-danger" role="alert">{{ nameError }}</p>
        </div>
        <div>
          <label for="common-website" class="mb-1.5 block text-xs font-medium text-ink-700 dark:text-ink-200">网站</label>
          <el-input id="common-website" v-model="form.website" clearable placeholder="例如：netflix.com" @blur="!form.iconUrl && findIcon(true)" />
          <p class="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
            {{ websiteHost ? `将保存为可访问的 ${websiteHost} 地址` : '可不填写；输入域名时会自动补全 https://' }}
          </p>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button class="inline-flex h-11 cursor-pointer items-center rounded-xl border border-ink-200 bg-white/70 px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-white dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200" @click="handleClose">取消</button>
        <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving || searchingIcon" @click="handleSubmit">
          <component :is="saving ? Loader2 : Save" :size="15" :class="saving && 'animate-spin'" />
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
@media (max-width: 768px) {
  .common-subscription-modal .el-input__inner {
    font-size: 16px;
  }
}
</style>
