<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { solar2lunar } from '../utils/lunar';
import { getSymbol } from '../utils/currency';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
  Plus, Search, Trash2, Copy, Pencil, Bell, Pause, Play, Download, Star, LayoutGrid,
  Loader2, ArrowDownUp, ArrowDown, ArrowUp, CheckCheck, X,
} from '@lucide/vue';
import SubscriptionModal from '../components/SubscriptionModal.vue';
import ImportExportDrawer from '../components/ImportExportDrawer.vue';
import SubscriptionDetailDrawer from '../components/SubscriptionDetailDrawer.vue';

const subStore = useSubscriptionStore();
const isMobile = useMediaQuery('(max-width: 768px)');

const searchKeyword = ref('');
const categoryFilter = ref('');
const showLunar = ref(localStorage.getItem('showLunar') === 'true');
const statusFilter = ref('');
// 快捷 tab 与状态下拉共用 statusFilter：tab 是常用入口，下拉是完整列表，两者永远同步
const quickFilters = [
  { key: 'all',      value: '',         label: '全部', icon: LayoutGrid },
  { key: 'inactive', value: 'inactive', label: '停用', icon: Pause },
  { key: 'pinned',   value: 'pinned',   label: '收藏', icon: Star },
];
const sortBy = ref(localStorage.getItem('sortBy') || 'expiry');
const sortOrder = ref(localStorage.getItem('sortOrder') || 'asc');
const showImportExport = ref(false);
const showModal = ref(false);
const editingSub = ref<Subscription | null>(null);
const copyMode = ref(false);
const showDetail = ref(false);
const detailSub = ref<Subscription | null>(null);
const currentPage = ref(1);
const pageSize = ref(12);

const selectMode = ref(false);
const selectedMap = ref<Record<number, boolean>>({});
const selectedCount = computed(() => Object.keys(selectedMap.value).length);

watch([sortBy, sortOrder], () => {
  localStorage.setItem('sortBy', sortBy.value);
  localStorage.setItem('sortOrder', sortOrder.value);
});

const categorySeparator = /[/,，\s]+/;

function normalizeCategoryTokens(category: string): string[] {
  return category.split(categorySeparator).map((t) => t.trim()).filter(Boolean);
}

const allCategories = computed(() => {
  const cats = new Set<string>();
  subStore.subscriptions.forEach((sub) => {
    normalizeCategoryTokens(sub.category || '').forEach((t) => cats.add(t));
  });
  return Array.from(cats).sort((a, b) => a.localeCompare(b, 'zh-CN'));
});

const filteredSubscriptions = computed(() => {
  let list = [...subStore.subscriptions];

  if (categoryFilter.value) {
    list = list.filter((sub) =>
      normalizeCategoryTokens(sub.category || '').some((t) => t.toLowerCase() === categoryFilter.value.toLowerCase())
    );
  }

  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.toLowerCase();
    list = list.filter((sub) => {
      const haystack = [sub.name, sub.customType, sub.notes, sub.category].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(kw);
    });
  }

  if (statusFilter.value) {
    list = list.filter((sub) => {
      if (statusFilter.value === 'active') return sub.isActive;
      if (statusFilter.value === 'inactive') return !sub.isActive;
      if (statusFilter.value === 'pinned') return sub.isPinned;
      if (statusFilter.value === 'expired') {
        return sub.isActive && new Date(sub.expiryDate).getTime() < Date.now();
      }
      if (statusFilter.value === 'soon') {
        if (!sub.isActive) return false;
        const diffDays = Math.ceil((new Date(sub.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }
      return true;
    });
  }

  list.sort((a, b) => {
    const pinDiff = (b.isPinned || 0) - (a.isPinned || 0);
    if (pinDiff !== 0) return pinDiff;

    let cmp = 0;
    if (sortBy.value === 'name') cmp = a.name.localeCompare(b.name, 'zh-CN');
    else if (sortBy.value === 'created') cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    else if (sortBy.value === 'price') cmp = (b.price || 0) - (a.price || 0);
    else cmp = (a.expiryDate || '').localeCompare(b.expiryDate || '');
    return sortOrder.value === 'desc' ? -cmp : cmp;
  });

  return list;
});

const paginatedSubscriptions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredSubscriptions.value.slice(start, start + pageSize.value);
});

watch([searchKeyword, categoryFilter, statusFilter], () => {
  currentPage.value = 1;
  selectedMap.value = {};
});

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  selectedMap.value = {};
}

function toggleSelection(id: number) {
  const next = { ...selectedMap.value };
  if (next[id]) delete next[id]; else next[id] = true;
  selectedMap.value = next;
}

function toggleSelectAll() {
  const allSelected = paginatedSubscriptions.value.every((s) => selectedMap.value[s.id]);
  const next: Record<number, boolean> = {};
  if (!allSelected) paginatedSubscriptions.value.forEach((s) => { next[s.id] = true; });
  selectedMap.value = next;
}

async function handleBatchToggle(enable: boolean) {
  const ids = Object.keys(selectedMap.value).map(Number);
  for (const id of ids) await subStore.toggleSubscription(id, enable);
  ElMessage.success(enable ? '已批量启用' : '已批量停用');
  selectedMap.value = {};
  selectMode.value = false;
}

async function handleBatchDelete() {
  const count = selectedCount.value;
  try {
    await ElMessageBox.confirm(`确定删除 ${count} 项订阅？`, '批量删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
    const ids = Object.keys(selectedMap.value).map(Number);
    for (const id of ids) await subStore.deleteSubscription(id);
    ElMessage.success(`已删除 ${count} 项`);
    selectedMap.value = {};
    selectMode.value = false;
  } catch {}
}

type DaysInfo = { text: string; tone: 'danger' | 'warning' | 'success' | 'muted'; percent: number };

function getDaysLeft(sub: Subscription): DaysInfo {
  const now = new Date();
  const expiry = new Date(sub.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let totalDays = 30;
  if (sub.startDate) {
    const start = new Date(sub.startDate);
    totalDays = Math.max(1, Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }
  const elapsed = totalDays - diffDays;
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));

  if (!sub.isActive) return { text: '已停用', tone: 'muted', percent: 100 };
  if (diffDays < 0)  return { text: `已过期 ${Math.abs(diffDays)} 天`, tone: 'danger', percent: 100 };
  if (diffDays === 0) return { text: '今天到期', tone: 'danger', percent: 100 };
  if (diffDays <= 7)  return { text: `还剩 ${diffDays} 天`, tone: 'warning', percent };
  return { text: `还剩 ${diffDays} 天`, tone: 'success', percent };
}

function getStatusMeta(sub: Subscription): { label: string; tone: 'danger' | 'warning' | 'success' | 'muted' } {
  if (!sub.isActive) return { label: '已停用', tone: 'muted' };

  const now = new Date();
  const expiry = new Date(sub.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const reminderValue = sub.reminderValue ?? 7;
  const reminderUnit = sub.reminderUnit || 'day';
  const diffHours = diffMs / (1000 * 60 * 60);

  let isSoon = false;
  if (reminderUnit === 'hour') {
    isSoon = diffHours >= 0 && diffHours <= reminderValue;
  } else {
    isSoon = diffDays >= 0 && diffDays <= reminderValue;
  }

  if (diffDays < 0) return { label: '已过期', tone: 'danger' };
  if (isSoon) return { label: '即将到期', tone: 'warning' };
  return { label: '正常', tone: 'success' };
}

function getLunarText(dateStr: string): string {
  if (!showLunar.value) return '';
  const d = new Date(dateStr);
  const lunar = solar2lunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return lunar ? lunar.fullStr : '';
}

function getPeriodLabel(sub: Subscription): string {
  if (!sub.periodValue) return '';
  const unitMap: Record<string, string> = { day: '天', month: '月', year: '年' };
  return `${sub.periodValue}${unitMap[sub.periodUnit] || sub.periodUnit}`;
}

function getReminderText(sub: Subscription): string {
  const value = sub.reminderValue ?? 7;
  const unit = sub.reminderUnit || 'day';
  return unit === 'hour' ? `${value} 小时前` : `${value} 天前`;
}

function periodLabel(unit: string): string {
  return { day: '天', month: '月', year: '年' }[unit] || unit;
}

function getPriceText(sub: Subscription): string {
  if (!sub.price || sub.price <= 0) return '';
  const sym = getSymbol(sub.currency || 'CNY');
  const unitMap: Record<string, string> = { day: '/天', month: '/月', year: '/年' };
  return `${sym}${sub.price.toFixed(2)}${unitMap[sub.priceUnit] || '/月'}`;
}

function brandInitial(name: string) {
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  return ch || '?';
}

function brandColor(name: string) {
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
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function openAdd() {
  editingSub.value = null;
  copyMode.value = false;
  showModal.value = true;
}

function openEdit(sub: Subscription) {
  editingSub.value = { ...sub };
  copyMode.value = false;
  showModal.value = true;
}

function openDetail(sub: Subscription) {
  // 批量选择模式下点卡片不开详情，避免误触
  if (selectMode.value) return;
  detailSub.value = sub;
  showDetail.value = true;
}
function onDetailEdit(sub: Subscription) {
  showDetail.value = false;
  openEdit(sub);
}
function onDetailCopy(sub: Subscription) {
  showDetail.value = false;
  handleCopy(sub);
}
function onDetailToggle(sub: Subscription) {
  handleToggle(sub);
}
function onDetailDelete(sub: Subscription) {
  showDetail.value = false;
  handleDelete(sub);
}
function onDetailTest(sub: Subscription) {
  handleTestNotify(sub);
}

function handleCopy(sub: Subscription) {
  editingSub.value = { ...sub };
  copyMode.value = true;
  showModal.value = true;
}

async function handleDelete(sub: Subscription) {
  try {
    await ElMessageBox.confirm(`确定删除「${sub.name}」？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await subStore.deleteSubscription(sub.id);
    ElMessage.success('已删除');
  } catch {}
}

async function handleToggle(sub: Subscription) {
  await subStore.toggleSubscription(sub.id, !sub.isActive);
}

async function handlePin(sub: Subscription) {
  await subStore.togglePin(sub.id, !sub.isPinned);
}

async function handleTestNotify(sub: Subscription) {
  const result = await subStore.testNotify(sub.id);
  ElMessage.info(result.message);
}

function toggleLunar() {
  localStorage.setItem('showLunar', String(showLunar.value));
}

onMounted(() => {
  subStore.fetchSubscriptions();
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">订阅管理</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">所有订阅服务一览，按到期日智能排序</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white/70 px-4 py-2 text-sm font-medium text-ink-700 backdrop-blur transition-colors hover:bg-white hover:text-ink-900 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200 dark:hover:bg-ink-800/70"
          @click="showImportExport = true"
        >
          <Download :size="16" />
          导入/导出
        </button>
        <button
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          :class="selectMode
            ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
            : 'border border-ink-200 bg-white/70 text-ink-700 backdrop-blur hover:bg-white hover:text-ink-900 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200 dark:hover:bg-ink-800/70'"
          @click="toggleSelectMode"
        >
          <component :is="selectMode ? X : CheckCheck" :size="16" />
          {{ selectMode ? '取消选择' : '批量选择' }}
        </button>
        <button
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg hover:shadow-brand-500/40 active:scale-[0.98]"
          @click="openAdd"
        >
          <Plus :size="16" />
          添加订阅
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="bento-card mb-6 grid grid-cols-1 gap-3 p-4 md:grid-cols-12 md:items-center">
      <div class="relative md:col-span-5">
        <Search :size="16" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="搜索名称、类型或备注..."
          class="block w-full rounded-xl border border-ink-200 bg-white/60 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50 dark:placeholder:text-ink-500"
        />
      </div>
      <div class="md:col-span-2">
        <el-select v-model="categoryFilter" placeholder="全部分类" clearable size="default" class="w-full">
          <el-option v-for="cat in allCategories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </div>
      <div class="md:col-span-2">
        <el-select v-model="statusFilter" placeholder="全部状态" clearable size="default" class="w-full">
          <el-option label="正常" value="active" />
          <el-option label="已停用" value="inactive" />
          <el-option label="已过期" value="expired" />
          <el-option label="即将到期" value="soon" />
          <el-option label="收藏" value="pinned" />
        </el-select>
      </div>
      <div class="md:col-span-2">
        <el-select v-model="sortBy" size="default" class="w-full">
          <el-option label="按到期日" value="expiry" />
          <el-option label="按名称" value="name" />
          <el-option label="按创建时间" value="created" />
          <el-option label="按费用" value="price" />
        </el-select>
      </div>
      <div class="flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        <button
          :title="sortOrder === 'asc' ? '升序' : '降序'"
          class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-ink-200 bg-white/60 text-ink-600 transition-colors hover:bg-white hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-300"
          @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
        >
          <component :is="sortOrder === 'asc' ? ArrowUp : ArrowDown" :size="16" />
        </button>
        <label class="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-300">
          <input v-model="showLunar" type="checkbox" class="peer sr-only" @change="toggleLunar" />
          <span class="relative h-5 w-9 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-500 dark:bg-ink-700">
            <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
          农历
        </label>
      </div>
    </div>

    <!-- Quick filter tabs -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        v-for="opt in quickFilters"
        :key="opt.key"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
        :class="(statusFilter || '') === opt.value
          ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
          : 'border border-ink-200 bg-white/70 text-ink-700 backdrop-blur hover:bg-white hover:text-ink-900 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200 dark:hover:bg-ink-800/70'"
        @click="statusFilter = opt.value"
      >
        <component :is="opt.icon" :size="16" />
        {{ opt.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="subStore.loading" class="flex flex-col items-center justify-center py-24 text-ink-500 dark:text-ink-400">
      <Loader2 :size="32" class="animate-spin text-brand-500" />
      <p class="mt-3 text-sm">加载中...</p>
    </div>

    <!-- Empty -->
    <div
      v-else-if="filteredSubscriptions.length === 0"
      class="bento-card flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300">
        <ArrowDownUp :size="28" />
      </div>
      <p class="mt-4 text-base font-medium text-ink-700 dark:text-ink-200">暂无订阅</p>
      <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">添加第一条订阅，开始追踪到期日</p>
      <button
        class="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 hover:shadow-lg"
        @click="openAdd"
      >
        <Plus :size="16" />
        添加订阅
      </button>
    </div>

    <!-- Card grid -->
    <div v-else>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <article
          v-for="sub in paginatedSubscriptions"
          :key="sub.id"
          class="bento-card group relative flex cursor-pointer flex-col p-5"
          :class="!sub.isActive ? 'opacity-60' : ''"
          @click="openDetail(sub)"
        >
          <!-- Selection checkbox -->
          <label
            v-if="selectMode"
            class="absolute left-3 top-3 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-ink-300 bg-white/80 transition-colors dark:border-ink-600 dark:bg-ink-800/80"
            :class="selectedMap[sub.id] ? 'border-brand-500 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-500' : ''"
            @click.stop
          >
            <input type="checkbox" class="sr-only" :checked="!!selectedMap[sub.id]" @change="toggleSelection(sub.id)" />
            <CheckCheck v-if="selectedMap[sub.id]" :size="14" />
          </label>

          <!-- Pin -->
          <button
            class="absolute right-4 top-4 cursor-pointer text-ink-300 transition-colors hover:text-warning dark:text-ink-600"
            :class="sub.isPinned ? 'text-warning dark:text-warning' : ''"
            :aria-label="sub.isPinned ? '取消置顶' : '置顶'"
            @click.stop="handlePin(sub)"
          >
            <Star :size="18" :fill="sub.isPinned ? 'currentColor' : 'none'" :stroke-width="sub.isPinned ? 1.5 : 2" />
          </button>

          <!-- Header -->
          <div class="flex items-start gap-3 pr-8" :class="selectMode ? 'pl-8' : ''">
            <div
              class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-white shadow-sm"
              :class="brandColor(sub.name)"
            >
              {{ brandInitial(sub.name) }}
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-base font-semibold text-ink-900 dark:text-ink-50">{{ sub.name }}</h3>
              <p v-if="sub.customType" class="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">{{ sub.customType }}</p>
            </div>
          </div>

          <!-- Status pill -->
          <div class="mt-4 flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="{
                'bg-success/10 text-success': getStatusMeta(sub).tone === 'success',
                'bg-warning/15 text-warning': getStatusMeta(sub).tone === 'warning',
                'bg-danger/10 text-danger':   getStatusMeta(sub).tone === 'danger',
                'bg-ink-100 text-ink-500 dark:bg-ink-800/60 dark:text-ink-400': getStatusMeta(sub).tone === 'muted',
              }"
            >
              <span class="h-1.5 w-1.5 rounded-full"
                :class="{
                  'bg-success': getStatusMeta(sub).tone === 'success',
                  'bg-warning': getStatusMeta(sub).tone === 'warning',
                  'bg-danger':  getStatusMeta(sub).tone === 'danger',
                  'bg-ink-400': getStatusMeta(sub).tone === 'muted',
                }"
              />
              {{ getStatusMeta(sub).label }}
            </span>
            <span v-if="sub.trialValue && sub.trialUnit" class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              试用 {{ sub.trialValue }}{{ periodLabel(sub.trialUnit) }}
            </span>
          </div>

          <!-- Expiry / progress -->
          <div class="mt-4">
            <div class="flex items-end justify-between">
              <div>
                <p class="font-mono-nums text-sm text-ink-500 dark:text-ink-400">{{ sub.expiryDate }}</p>
                <p
                  class="font-mono-nums mt-0.5 text-xl font-bold tabular"
                  :class="{
                    'text-success': getDaysLeft(sub).tone === 'success',
                    'text-warning': getDaysLeft(sub).tone === 'warning',
                    'text-danger':  getDaysLeft(sub).tone === 'danger',
                    'text-ink-400': getDaysLeft(sub).tone === 'muted',
                  }"
                >
                  {{ getDaysLeft(sub).text }}
                </p>
                <p v-if="showLunar && getLunarText(sub.expiryDate)" class="mt-0.5 text-xs text-brand-500 dark:text-brand-300">
                  {{ getLunarText(sub.expiryDate) }}
                </p>
              </div>
              <div v-if="getPriceText(sub)" class="text-right">
                <p class="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">费用</p>
                <p class="font-mono-nums text-base font-bold text-ink-900 dark:text-ink-50">{{ getPriceText(sub) }}</p>
              </div>
            </div>
            <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/60">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="{
                  'bg-success': getDaysLeft(sub).tone === 'success',
                  'bg-warning': getDaysLeft(sub).tone === 'warning',
                  'bg-danger':  getDaysLeft(sub).tone === 'danger',
                  'bg-ink-300 dark:bg-ink-700': getDaysLeft(sub).tone === 'muted',
                }"
                :style="{ width: getDaysLeft(sub).percent + '%' }"
              />
            </div>
          </div>

          <!-- Tags -->
          <div v-if="sub.category || sub.periodValue" class="mt-3 flex flex-wrap gap-1.5">
            <span v-if="sub.periodValue" class="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
              周期 {{ getPeriodLabel(sub) }}<span v-if="sub.autoRenew"> · 自动续</span>
            </span>
            <span
              v-for="cat in normalizeCategoryTokens(sub.category || '')"
              :key="cat"
              class="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              # {{ cat }}
            </span>
          </div>

          <!-- Notes -->
          <p v-if="sub.notes" class="mt-3 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">
            {{ sub.notes }}
          </p>

          <!-- Footer reminder -->
          <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
            <Bell :size="12" />
            提前 {{ getReminderText(sub) }} 提醒
          </p>

          <!-- Actions -->
          <div class="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3 dark:border-ink-800/50" @click.stop>
            <button
              class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-ink-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
              @click="openEdit(sub)"
            >
              <Pencil :size="14" /> 编辑
            </button>
            <button
              class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-ink-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
              @click="handleCopy(sub)"
            >
              <Copy :size="14" /> 复制
            </button>
            <button
              class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:text-ink-300 dark:hover:bg-sky-500/15 dark:hover:text-sky-300"
              @click="handleTestNotify(sub)"
            >
              <Bell :size="14" /> 测试
            </button>
            <button
              class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors"
              :class="sub.isActive
                ? 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800/60'
                : 'text-success hover:bg-success/10'"
              @click="handleToggle(sub)"
            >
              <component :is="sub.isActive ? Pause : Play" :size="14" />
              {{ sub.isActive ? '停用' : '启用' }}
            </button>
            <button
              class="ml-auto inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-danger/10 hover:text-danger dark:text-ink-300"
              @click="handleDelete(sub)"
            >
              <Trash2 :size="14" /> 删除
            </button>
          </div>
        </article>
      </div>

      <!-- Batch action bar -->
      <transition
        enter-active-class="transition-all duration-200"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="selectMode && selectedCount > 0"
          class="glass-panel sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3"
        >
          <label class="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-700 dark:text-ink-200">
            <input
              type="checkbox"
              class="h-4 w-4 cursor-pointer rounded border-ink-300 text-brand-500 focus:ring-brand-500/30"
              :checked="paginatedSubscriptions.length > 0 && paginatedSubscriptions.every(s => selectedMap[s.id])"
              @change="toggleSelectAll"
            />
            已选择 <span class="font-mono-nums font-bold text-brand-600 dark:text-brand-300">{{ selectedCount }}</span> 项
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/15"
              @click="handleBatchToggle(true)"
            >
              <Play :size="13" /> 批量启用
            </button>
            <button
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-200 dark:bg-ink-800/60 dark:text-ink-300 dark:hover:bg-ink-800"
              @click="handleBatchToggle(false)"
            >
              <Pause :size="13" /> 批量停用
            </button>
            <button
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15"
              @click="handleBatchDelete"
            >
              <Trash2 :size="13" /> 批量删除
            </button>
          </div>
        </div>
      </transition>

      <el-pagination
        v-if="filteredSubscriptions.length > 0"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredSubscriptions.length"
        :page-sizes="[12, 24, 48]"
        :layout="isMobile ? 'total, prev, next' : 'total, sizes, prev, pager, next'"
        :small="isMobile"
        background
        class="mt-6 justify-end"
      />
    </div>

    <SubscriptionModal
      v-if="showModal"
      :subscription="editingSub"
      :copy="copyMode"
      @close="showModal = false"
      @saved="showModal = false"
    />
    <ImportExportDrawer
      v-if="showImportExport"
      @close="showImportExport = false"
    />
    <SubscriptionDetailDrawer
      v-if="showDetail && detailSub"
      :subscription="detailSub"
      @close="showDetail = false"
      @edit="onDetailEdit"
      @copy="onDetailCopy"
      @toggle="onDetailToggle"
      @delete="onDetailDelete"
      @test="onDetailTest"
    />
  </div>
</template>
