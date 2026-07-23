<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ExternalLink, Globe2, Library, Loader2, Pencil, Plus, Search, Sparkles, Trash2,
} from '@lucide/vue';
import {
  type CommonSubscription,
  useCommonSubscriptionStore,
} from '../stores/commonSubscription';
import { getWebsiteHostname } from '../utils/brandIcon';
import CommonSubscriptionModal from '../components/CommonSubscriptionModal.vue';
import SubscriptionBrandIcon from '../components/SubscriptionBrandIcon.vue';

const store = useCommonSubscriptionStore();
const router = useRouter();
const keyword = ref('');
const showModal = ref(false);
const editingItem = ref<CommonSubscription | null>(null);

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  if (!query) return store.items;
  return store.items.filter((item) =>
    `${item.name} ${item.website}`.toLocaleLowerCase().includes(query),
  );
});

function openAdd() {
  editingItem.value = null;
  showModal.value = true;
}

function openEdit(item: CommonSubscription) {
  editingItem.value = { ...item };
  showModal.value = true;
}

function createSubscription(item: CommonSubscription) {
  router.push({ name: 'Dashboard', query: { preset: item.name } });
}

async function handleDelete(item: CommonSubscription) {
  try {
    await ElMessageBox.confirm(
      `确定删除常用订阅“${item.name}”吗？不会影响已经创建的订阅。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  try {
    await store.deleteItem(item.id);
    ElMessage.success('已删除常用订阅');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '删除失败');
  }
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
}

onMounted(async () => {
  try {
    await store.fetchItems();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '常用订阅加载失败');
  }
});
</script>

<template>
  <div>
    <header class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div class="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Sparkles :size="13" /> 快速创建
        </div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">常用订阅管理</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">
          收藏常用 App 和网站，自动匹配头像并快速创建订阅
        </p>
      </div>
      <div class="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
        <label class="relative min-w-0 flex-1 lg:w-72" aria-label="搜索常用订阅">
          <Search :size="16" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            v-model="keyword"
            type="search"
            aria-label="搜索常用订阅"
            placeholder="搜索名称或网站"
            class="block h-11 w-full rounded-xl border border-ink-200 bg-white/70 py-2 pl-10 pr-3 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50 md:text-sm"
          />
        </label>
        <button class="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-colors hover:bg-brand-600" @click="openAdd">
          <Plus :size="16" /> 新增常用订阅
        </button>
      </div>
    </header>

    <div v-if="store.loading" class="flex min-h-64 items-center justify-center" role="status">
      <Loader2 :size="26" class="animate-spin text-brand-500" />
      <span class="ml-2 text-sm text-ink-500 dark:text-ink-400">加载常用订阅...</span>
    </div>

    <section v-else-if="filteredItems.length" aria-label="常用订阅列表" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <article v-for="item in filteredItems" :key="item.id" class="bento-card flex min-w-0 flex-col p-5">
        <div class="flex min-w-0 items-start gap-3">
          <SubscriptionBrandIcon
            :name="item.name"
            :website="item.website"
            :icon-url="item.iconUrl"
            :background-color="item.backgroundColor"
          />
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-base font-semibold text-ink-900 dark:text-ink-50" :title="item.name">{{ item.name }}</h3>
            <a
              v-if="item.website"
              :href="item.website"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-flex max-w-full cursor-pointer items-center gap-1 text-xs text-ink-500 transition-colors hover:text-brand-600 dark:text-ink-400 dark:hover:text-brand-300"
              :title="item.website"
            >
              <Globe2 :size="12" class="flex-shrink-0" />
              <span class="truncate">{{ getWebsiteHostname(item.website) || item.website }}</span>
              <ExternalLink :size="11" class="flex-shrink-0" />
            </a>
            <p v-else class="mt-1 text-xs text-ink-400 dark:text-ink-500">未填写网站</p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4 dark:border-ink-800/50">
          <button class="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-50 px-3 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25" @click="createSubscription(item)">
            <Plus :size="14" /> 创建订阅
          </button>
          <button class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-800/60 dark:hover:text-brand-300" :aria-label="`编辑 ${item.name}`" @click="openEdit(item)">
            <Pencil :size="16" />
          </button>
          <button class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-danger/10 hover:text-danger dark:text-ink-400" :aria-label="`删除 ${item.name}`" @click="handleDelete(item)">
            <Trash2 :size="16" />
          </button>
        </div>
      </article>
    </section>

    <section v-else class="bento-card flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300">
        <component :is="keyword ? Search : Library" :size="28" />
      </div>
      <h3 class="mt-4 text-base font-semibold text-ink-800 dark:text-ink-100">{{ keyword ? '没有匹配结果' : '还没有常用订阅' }}</h3>
      <p class="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{{ keyword ? '换个关键词试试，或清空搜索条件' : '把经常使用的 App 或网站保存到这里，下次创建订阅会更快。' }}</p>
      <button v-if="!keyword" class="mt-5 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600" @click="openAdd">
        <Plus :size="16" /> 添加第一个
      </button>
    </section>

    <CommonSubscriptionModal v-if="showModal" :item="editingItem" @close="closeModal" @saved="closeModal" />
  </div>
</template>
