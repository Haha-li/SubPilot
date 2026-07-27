<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { useRenewalStore, type RenewalHistoryItem, type RenewalSource } from '../stores/renewal';
import { useSystemConfigStore } from '../stores/systemConfig';
import { fetchRates, getSymbol } from '../utils/currency';
import {
  differenceInCalendarDays,
  getDateOnlyInTimeZone,
  getDaysUntilDate,
} from '../utils/dateOnly';
import {
  buildRenewalForecast,
  getEstimatedRenewalCostCny,
  getRenewedExpiryDate,
  getSuggestedRenewalPeriods,
} from '../utils/renewalCenter';
import SubscriptionBrandIcon from '../components/SubscriptionBrandIcon.vue';
import SubscriptionModal from '../components/SubscriptionModal.vue';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCheck,
  Clock,
  DollarSign,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Repeat,
  Search,
  X,
} from '@lucide/vue';

const SubscriptionDetailDrawer = defineAsyncComponent(() => import('../components/SubscriptionDetailDrawer.vue'));

const subscriptionStore = useSubscriptionStore();
const renewalStore = useRenewalStore();
const systemConfigStore = useSystemConfigStore();
const isMobile = useMediaQuery('(max-width: 768px)');

const queueFilter = ref<'attention' | 'upcoming' | 'expired' | 'auto' | 'all'>('attention');
const queueSearch = ref('');
const selectedMap = reactive<Record<number, boolean>>({});
const ratesRefreshKey = ref(0);
const currentTime = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const historyPage = ref(1);
const historyPageSize = ref(20);
const historySource = ref<RenewalSource | ''>('');
const historySearch = ref('');

const renewDialogVisible = ref(false);
const renewalTarget = ref<Subscription | null>(null);
const renewalPeriods = ref(1);
const renewalNotes = ref('');
const showDetail = ref(false);
const detailSubscription = ref<Subscription | null>(null);
const showEditModal = ref(false);
const editingSubscription = ref<Subscription | null>(null);

const today = computed(() => getDateOnlyInTimeZone(currentTime.value, systemConfigStore.timezone));

function getDays(subscription: Subscription): number {
  return getDaysUntilDate(subscription.expiryDate, currentTime.value, systemConfigStore.timezone);
}

const activeSubscriptions = computed(() => subscriptionStore.subscriptions.filter((subscription) => subscription.isActive));
const expiringWithin30 = computed(() => activeSubscriptions.value.filter((subscription) => {
  const days = getDays(subscription);
  return days >= 0 && days <= 30;
}));
const expiredSubscriptions = computed(() => activeSubscriptions.value.filter((subscription) => getDays(subscription) < 0));
const autoRenewSubscriptions = computed(() => activeSubscriptions.value.filter((subscription) => subscription.autoRenew));

const forecast = computed(() => {
  ratesRefreshKey.value;
  return buildRenewalForecast(activeSubscriptions.value, today.value, 6);
});
const next30Events = computed(() => forecast.value.events.filter((event) => {
  const days = differenceInCalendarDays(today.value, event.date);
  return days >= 0 && days <= 30;
}));
const next30Cost = computed(() => next30Events.value.reduce((sum, event) => sum + event.amount, 0));
const sixMonthCost = computed(() => forecast.value.months.reduce((sum, month) => sum + month.amount, 0));
const forecastMax = computed(() => Math.max(1, ...forecast.value.months.map((month) => month.amount)));

const queueTabs = computed(() => [
  { key: 'attention' as const, label: '待处理', count: expiringWithin30.value.length + expiredSubscriptions.value.length },
  { key: 'upcoming' as const, label: '30 天内', count: expiringWithin30.value.length },
  { key: 'expired' as const, label: '已过期', count: expiredSubscriptions.value.length },
  { key: 'auto' as const, label: '自动续费', count: autoRenewSubscriptions.value.length },
  { key: 'all' as const, label: '全部启用', count: activeSubscriptions.value.length },
]);

const filteredQueue = computed(() => {
  let subscriptions = activeSubscriptions.value.filter((subscription) => {
    const days = getDays(subscription);
    if (queueFilter.value === 'attention') return days <= 30;
    if (queueFilter.value === 'upcoming') return days >= 0 && days <= 30;
    if (queueFilter.value === 'expired') return days < 0;
    if (queueFilter.value === 'auto') return Boolean(subscription.autoRenew);
    return true;
  });
  const keyword = queueSearch.value.trim().toLocaleLowerCase();
  if (keyword) {
    subscriptions = subscriptions.filter((subscription) => (
      [subscription.name, subscription.customType, subscription.category, subscription.notes]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(keyword)
    ));
  }
  return subscriptions.sort((left, right) => {
    const dateDifference = left.expiryDate.localeCompare(right.expiryDate);
    return dateDifference || left.name.localeCompare(right.name, 'zh-CN');
  });
});

const selectedIds = computed(() => Object.keys(selectedMap).map(Number));
const selectedCount = computed(() => selectedIds.value.length);
const allVisibleSelected = computed(() => (
  filteredQueue.value.length > 0
  && filteredQueue.value.every((subscription) => selectedMap[subscription.id])
));
const renewalPreview = computed(() => (
  renewalTarget.value
    ? getRenewedExpiryDate(renewalTarget.value, renewalPeriods.value)
    : null
));
const recommendedPeriods = computed(() => (
  renewalTarget.value
    ? getSuggestedRenewalPeriods(renewalTarget.value, today.value)
    : 1
));

function formatCny(value: number): string {
  if (!Number.isFinite(value)) return '汇率缺失';
  return `${getSymbol('CNY')}${Math.round(value).toLocaleString('zh-CN')}`;
}

function formatMoney(value: number, currency: string): string {
  const amount = Number(value || 0);
  return `${getSymbol(currency || 'CNY')}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function periodLabel(value: number, unit: string): string {
  const label = { day: '天', month: '月', year: '年' }[unit] || unit;
  return `${value || 1}${label}`;
}

function queueStatus(subscription: Subscription) {
  const days = getDays(subscription);
  if (!Number.isFinite(days)) return { label: '日期无效', tone: 'danger' as const };
  if (days < 0) return { label: `已过期 ${Math.abs(days)} 天`, tone: 'danger' as const };
  if (days === 0) return { label: '今天到期', tone: 'danger' as const };
  if (days <= 7) return { label: `还剩 ${days} 天`, tone: 'warning' as const };
  if (days <= 30) return { label: `还剩 ${days} 天`, tone: 'brand' as const };
  return { label: `还剩 ${days} 天`, tone: 'success' as const };
}

function formatRenewedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: systemConfigStore.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
}

function sourceLabel(source: RenewalSource): string {
  return source === 'automatic' ? '自动续费' : '手动续费';
}

function clearSelection() {
  Object.keys(selectedMap).forEach((id) => delete selectedMap[Number(id)]);
}

function toggleSelection(id: number) {
  if (selectedMap[id]) delete selectedMap[id];
  else selectedMap[id] = true;
}

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    clearSelection();
    return;
  }
  filteredQueue.value.forEach((subscription) => { selectedMap[subscription.id] = true; });
}

function openRenew(subscription: Subscription) {
  renewalTarget.value = subscription;
  renewalPeriods.value = getSuggestedRenewalPeriods(subscription, today.value);
  renewalNotes.value = '';
  renewDialogVisible.value = true;
}

function openDetail(subscription: Subscription) {
  detailSubscription.value = subscription;
  showDetail.value = true;
}

function openHistorySubscription(item: RenewalHistoryItem) {
  const subscription = subscriptionStore.subscriptions.find((candidate) => candidate.id === item.subscriptionId);
  if (subscription) openDetail(subscription);
}

function openEdit(subscription: Subscription) {
  showDetail.value = false;
  editingSubscription.value = subscription;
  showEditModal.value = true;
}

function getErrorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as any)?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage) return responseMessage;
  return error instanceof Error && error.message ? error.message : fallback;
}

async function refreshData() {
  await Promise.all([
    subscriptionStore.fetchSubscriptions(),
    loadHistory(),
  ]);
  clearSelection();
}

async function handleRefresh() {
  try {
    await refreshData();
    ElMessage.success('续费数据已刷新');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '刷新续费数据失败'));
  }
}

async function confirmRenewal() {
  if (!renewalTarget.value || !renewalPreview.value) return;
  try {
    const result = await renewalStore.renewSubscription(
      renewalTarget.value.id,
      renewalPeriods.value,
      renewalNotes.value,
    );
    ElMessage.success(`已续费至 ${result.renewal.newExpiryDate}`);
    renewDialogVisible.value = false;
    await refreshData();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '续费失败'));
  }
}

async function handleBatchRenew() {
  const selected = activeSubscriptions.value.filter((subscription) => selectedMap[subscription.id]);
  if (selected.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `将为 ${selected.length} 项订阅续费；已过期项目会按各自周期补齐到当前日期。`,
      '确认批量续费',
      { confirmButtonText: '确认续费', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    const items = selected.map((subscription) => ({
      id: subscription.id,
      periods: getSuggestedRenewalPeriods(subscription, today.value),
    }));
    const result = await renewalStore.batchRenew(items, '续费中心批量续费');
    ElMessage.success(`已完成 ${result.updated} 项续费`);
    await refreshData();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '批量续费失败'));
  }
}

async function handleBatchAutoRenew(enabled: boolean) {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定为已选择的 ${selectedIds.value.length} 项订阅${enabled ? '开启' : '关闭'}自动续费？`,
      enabled ? '开启自动续费' : '关闭自动续费',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    const result = await renewalStore.batchSetAutoRenew(selectedIds.value, enabled);
    ElMessage.success(`已更新 ${result.updated} 项订阅`);
    await refreshData();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '批量更新自动续费失败'));
  }
}

async function handleToggle(subscription: Subscription) {
  try {
    await subscriptionStore.toggleSubscription(subscription.id, !subscription.isActive);
    ElMessage.success(subscription.isActive ? '已停用' : '已启用');
    showDetail.value = false;
    await refreshData();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '更新订阅状态失败'));
  }
}

async function handleDelete(subscription: Subscription) {
  try {
    await ElMessageBox.confirm(`确定删除「${subscription.name}」？`, '确认删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await subscriptionStore.deleteSubscription(subscription.id);
    ElMessage.success('已删除');
    showDetail.value = false;
    await refreshData();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '删除订阅失败'));
  }
}

async function handleTest(subscription: Subscription) {
  try {
    const result = await subscriptionStore.testNotify(subscription.id);
    ElMessage.info(result.message);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '测试通知失败'));
  }
}

function handleEditSaved() {
  showEditModal.value = false;
  void refreshData().catch((error) => {
    ElMessage.error(getErrorMessage(error, '刷新订阅数据失败'));
  });
}

async function loadHistory() {
  await renewalStore.fetchHistory({
    page: historyPage.value,
    pageSize: historyPageSize.value,
    source: historySource.value,
    search: historySearch.value.trim(),
  });
}

function requestHistory() {
  void loadHistory().catch((error) => {
    ElMessage.error(getErrorMessage(error, '加载续费历史失败'));
  });
}

function resetHistoryPageAndLoad() {
  if (historyPage.value === 1) requestHistory();
  else historyPage.value = 1;
}

function applyHistorySearch() {
  resetHistoryPageAndLoad();
}

watch([queueFilter, queueSearch], clearSelection);
watch(historySource, resetHistoryPageAndLoad);
watch(historyPage, requestHistory);
watch(historyPageSize, resetHistoryPageAndLoad);

onMounted(async () => {
  clockTimer = setInterval(() => { currentTime.value = new Date(); }, 60_000);
  try {
    await Promise.all([
      subscriptionStore.fetchSubscriptions(),
      loadHistory(),
      systemConfigStore.fetchSystemConfig(),
      fetchRates().finally(() => { ratesRefreshKey.value += 1; }),
    ]);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载续费中心失败'));
  }
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<template>
  <div class="min-h-[calc(100vh-5.5rem)] md:min-h-[calc(100vh-4rem)]">
    <header class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div class="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <RefreshCw :size="13" />
          系统时区 · {{ systemConfigStore.timezone }}
        </div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">续费中心</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">集中处理到期订阅、自动续费和未来支出</p>
      </div>
      <button
        class="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
        :disabled="subscriptionStore.loading || renewalStore.loadingHistory"
        @click="handleRefresh"
      >
        <RefreshCw :size="16" :class="subscriptionStore.loading ? 'animate-spin' : ''" />
        刷新数据
      </button>
    </header>

    <section aria-label="续费概览" class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="bento-card flex items-center gap-3 p-4 md:p-5">
        <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <CalendarDays :size="20" />
        </div>
        <div class="min-w-0">
          <p class="font-mono-nums text-2xl font-bold text-ink-900 dark:text-ink-50">{{ expiringWithin30.length }}</p>
          <p class="text-xs text-ink-500 dark:text-ink-400">30 天内到期</p>
        </div>
      </div>
      <div class="bento-card flex items-center gap-3 p-4 md:p-5">
        <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
          <AlertCircle :size="20" />
        </div>
        <div class="min-w-0">
          <p class="font-mono-nums text-2xl font-bold text-ink-900 dark:text-ink-50">{{ expiredSubscriptions.length }}</p>
          <p class="text-xs text-ink-500 dark:text-ink-400">需要补续</p>
        </div>
      </div>
      <div class="bento-card flex items-center gap-3 p-4 md:p-5">
        <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Repeat :size="20" />
        </div>
        <div class="min-w-0">
          <p class="font-mono-nums text-2xl font-bold text-ink-900 dark:text-ink-50">{{ autoRenewSubscriptions.length }}</p>
          <p class="text-xs text-ink-500 dark:text-ink-400">自动续费中</p>
        </div>
      </div>
      <div class="bento-card flex items-center gap-3 p-4 md:p-5">
        <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
          <DollarSign :size="20" />
        </div>
        <div class="min-w-0">
          <p class="font-mono-nums truncate text-2xl font-bold text-ink-900 dark:text-ink-50">{{ formatCny(next30Cost) }}</p>
          <p class="text-xs text-ink-500 dark:text-ink-400">未来 30 天预计支出</p>
        </div>
      </div>
    </section>

    <div class="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
      <section class="bento-card min-w-0 overflow-hidden" aria-labelledby="renewal-queue-title">
        <div class="border-b border-ink-100 px-4 py-4 dark:border-ink-800/60 md:px-5">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 id="renewal-queue-title" class="font-heading text-lg font-bold text-ink-900 dark:text-ink-50">续费队列</h3>
                <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">过期订阅续费时会自动建议补齐周期数</p>
              </div>
              <div class="relative w-full lg:w-64">
                <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  v-model="queueSearch"
                  type="search"
                  aria-label="搜索续费队列"
                  placeholder="搜索订阅..."
                  class="block min-h-10 w-full rounded-xl border border-ink-200 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50"
                />
              </div>
            </div>
            <div class="renewal-tabs flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="续费队列筛选">
              <button
                v-for="tab in queueTabs"
                :key="tab.key"
                role="tab"
                :aria-selected="queueFilter === tab.key"
                class="inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                :class="queueFilter === tab.key
                  ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
                  : 'bg-ink-50 text-ink-600 hover:bg-ink-100 dark:bg-ink-800/40 dark:text-ink-300 dark:hover:bg-ink-800/70'"
                @click="queueFilter = tab.key"
              >
                {{ tab.label }}
                <span class="font-mono-nums rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] dark:bg-ink-900/50">{{ tab.count }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="subscriptionStore.loading" class="flex flex-col items-center justify-center py-24 text-ink-500 dark:text-ink-400">
          <Loader2 :size="28" class="animate-spin text-brand-500" />
          <p class="mt-3 text-sm">正在加载续费队列...</p>
        </div>

        <div v-else-if="filteredQueue.length === 0" class="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCheck :size="24" />
          </div>
          <p class="mt-4 font-medium text-ink-800 dark:text-ink-100">当前筛选下无需处理</p>
          <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">所有订阅都在计划内</p>
        </div>

        <div v-else>
          <div class="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 dark:border-ink-800/60 dark:bg-ink-900/20 md:px-5">
            <label class="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-300">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-ink-300 text-brand-500 focus:ring-brand-500/30"
                :checked="allVisibleSelected"
                @change="toggleSelectAll"
              />
              全选当前 {{ filteredQueue.length }} 项
            </label>
            <span class="font-mono-nums text-xs text-ink-400">已选 {{ selectedCount }}</span>
          </div>

          <ul class="divide-y divide-ink-100 dark:divide-ink-800/60">
            <li
              v-for="subscription in filteredQueue"
              :key="subscription.id"
              class="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-4 transition-colors hover:bg-brand-50/35 dark:hover:bg-brand-500/5 md:grid-cols-[auto_minmax(180px,1.2fr)_minmax(130px,0.7fr)_minmax(110px,0.55fr)_auto] md:items-center md:px-5"
            >
              <label class="flex min-h-11 cursor-pointer items-center">
                <input
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer rounded border-ink-300 text-brand-500 focus:ring-brand-500/30"
                  :checked="!!selectedMap[subscription.id]"
                  :aria-label="`选择 ${subscription.name}`"
                  @change="toggleSelection(subscription.id)"
                />
              </label>

              <button
                class="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                @click="openDetail(subscription)"
              >
                <SubscriptionBrandIcon
                  :name="subscription.name"
                  :icon-url="subscription.iconUrl"
                  :background-color="subscription.iconBackgroundColor"
                />
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{{ subscription.name }}</span>
                  <span class="mt-0.5 block truncate text-xs text-ink-500 dark:text-ink-400">
                    {{ subscription.category || subscription.customType || periodLabel(subscription.periodValue, subscription.periodUnit) }}
                  </span>
                </span>
              </button>

              <div class="col-start-2 md:col-start-auto">
                <p class="font-mono-nums text-sm font-semibold text-ink-800 dark:text-ink-100">{{ subscription.expiryDate }}</p>
                <span
                  class="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="{
                    'bg-danger/10 text-danger': queueStatus(subscription).tone === 'danger',
                    'bg-warning/15 text-warning': queueStatus(subscription).tone === 'warning',
                    'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300': queueStatus(subscription).tone === 'brand',
                    'bg-success/10 text-success': queueStatus(subscription).tone === 'success',
                  }"
                >
                  {{ queueStatus(subscription).label }}
                </span>
              </div>

              <div class="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto md:block">
                <p class="font-mono-nums text-sm font-semibold text-ink-800 dark:text-ink-100">{{ formatCny(getEstimatedRenewalCostCny(subscription)) }}</p>
                <span
                  class="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="subscription.autoRenew
                    ? 'bg-success/10 text-success'
                    : 'bg-ink-100 text-ink-500 dark:bg-ink-800/60 dark:text-ink-400'"
                >
                  <Repeat :size="11" /> {{ subscription.autoRenew ? '自动续费' : '手动续费' }}
                </span>
              </div>

              <div class="col-span-2 flex justify-end md:col-span-1">
                <button
                  class="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="renewalStore.mutating"
                  @click="openRenew(subscription)"
                >
                  <RefreshCw :size="14" /> 快速续费
                </button>
              </div>
            </li>
          </ul>
        </div>

        <div
          v-if="selectedCount > 0"
          class="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-brand-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-brand-500/25 dark:bg-ink-900/95 sm:flex-row sm:items-center sm:justify-between md:px-5"
        >
          <p class="text-sm font-medium text-ink-700 dark:text-ink-200">
            已选择 <span class="font-mono-nums font-bold text-brand-600 dark:text-brand-300">{{ selectedCount }}</span> 项
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
              :disabled="renewalStore.mutating"
              @click="handleBatchRenew"
            >
              <RefreshCw :size="13" /> 批量续费
            </button>
            <button
              class="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success transition-colors hover:bg-success/15 disabled:opacity-60"
              :disabled="renewalStore.mutating"
              @click="handleBatchAutoRenew(true)"
            >
              <Repeat :size="13" /> 开启自动续费
            </button>
            <button
              class="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-200 disabled:opacity-60 dark:bg-ink-800/60 dark:text-ink-300 dark:hover:bg-ink-800"
              :disabled="renewalStore.mutating"
              @click="handleBatchAutoRenew(false)"
            >
              <X :size="13" /> 关闭自动续费
            </button>
          </div>
        </div>
      </section>

      <aside class="space-y-5">
        <section class="bento-card p-5" aria-labelledby="forecast-title">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 id="forecast-title" class="font-heading text-lg font-bold text-ink-900 dark:text-ink-50">6 个月支出预测</h3>
              <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">基于启用订阅和当前汇率</p>
            </div>
            <div class="rounded-xl bg-success/10 p-2 text-success"><DollarSign :size="18" /></div>
          </div>
          <p class="font-mono-nums mt-5 text-3xl font-bold text-ink-900 dark:text-ink-50">{{ formatCny(sixMonthCost) }}</p>
          <div class="mt-5 space-y-3">
            <div v-for="month in forecast.months" :key="month.key" class="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3">
              <span class="text-xs font-medium text-ink-500 dark:text-ink-400">{{ month.label }}</span>
              <div class="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/70">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-300"
                  :style="{ width: month.amount > 0 ? `${Math.max(4, month.amount / forecastMax * 100)}%` : '0%' }"
                />
              </div>
              <span class="font-mono-nums min-w-[68px] text-right text-xs font-semibold text-ink-700 dark:text-ink-200">{{ formatCny(month.amount) }}</span>
            </div>
          </div>
        </section>

        <section class="bento-card p-5" aria-labelledby="upcoming-plan-title">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 id="upcoming-plan-title" class="font-heading text-base font-bold text-ink-900 dark:text-ink-50">近期续费计划</h3>
              <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">未来 30 天共 {{ next30Events.length }} 笔</p>
            </div>
            <Clock :size="18" class="text-brand-500" />
          </div>
          <ul v-if="next30Events.length" class="mt-4 space-y-2.5">
            <li v-for="event in next30Events.slice(0, 5)" :key="`${event.subscriptionId}-${event.date}`" class="flex items-center justify-between gap-3 rounded-xl bg-ink-50/80 px-3 py-2.5 dark:bg-ink-800/35">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{{ event.subscriptionName }}</p>
                <p class="font-mono-nums mt-0.5 text-xs text-ink-500 dark:text-ink-400">{{ event.date }}</p>
              </div>
              <span class="font-mono-nums flex-shrink-0 text-sm font-semibold text-ink-800 dark:text-ink-100">{{ formatCny(event.amount) }}</span>
            </li>
          </ul>
          <div v-else class="mt-4 rounded-xl bg-success/10 px-3 py-5 text-center text-sm text-success">未来 30 天暂无续费计划</div>
        </section>
      </aside>
    </div>

    <section class="bento-card overflow-hidden" aria-labelledby="renewal-history-title">
      <div class="border-b border-ink-100 px-4 py-4 dark:border-ink-800/60 md:px-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <History :size="18" class="text-brand-500" />
              <h3 id="renewal-history-title" class="font-heading text-lg font-bold text-ink-900 dark:text-ink-50">续费历史</h3>
            </div>
            <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">手动与自动续费记录统一归档</p>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-[160px_minmax(220px,320px)_auto]">
            <el-select v-model="historySource" clearable placeholder="全部来源" class="w-full" aria-label="按续费来源筛选">
              <el-option label="手动续费" value="manual" />
              <el-option label="自动续费" value="automatic" />
            </el-select>
            <div class="relative">
              <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink-400" />
              <input
                v-model="historySearch"
                type="search"
                placeholder="搜索订阅或备注..."
                aria-label="搜索续费历史"
                class="block h-10 w-full rounded-xl border border-ink-200 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50"
                @keyup.enter="applyHistorySearch"
              />
            </div>
            <button
              class="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-white hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200 dark:hover:bg-ink-800/70"
              @click="applyHistorySearch"
            >
              <Search :size="14" /> 查询
            </button>
          </div>
        </div>
      </div>

      <div v-if="renewalStore.loadingHistory" class="flex flex-col items-center justify-center py-20 text-ink-500 dark:text-ink-400">
        <Loader2 :size="28" class="animate-spin text-brand-500" />
        <p class="mt-3 text-sm">正在加载续费历史...</p>
      </div>
      <div v-else-if="renewalStore.history.length === 0" class="px-6 py-16 text-center">
        <History :size="28" class="mx-auto text-ink-300 dark:text-ink-600" />
        <p class="mt-3 text-sm font-medium text-ink-700 dark:text-ink-200">暂无续费记录</p>
        <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">完成一次手动或自动续费后会显示在这里</p>
      </div>
      <ol v-else class="divide-y divide-ink-100 dark:divide-ink-800/60">
        <li v-for="item in renewalStore.history" :key="item.id" class="grid gap-3 px-4 py-4 md:grid-cols-[minmax(190px,1fr)_minmax(220px,1.35fr)_minmax(130px,0.65fr)_minmax(130px,0.65fr)] md:items-center md:px-5">
          <button
            class="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            :disabled="!subscriptionStore.subscriptions.some(subscription => subscription.id === item.subscriptionId)"
            @click="openHistorySubscription(item)"
          >
            <SubscriptionBrandIcon
              :name="item.subscriptionName"
              :icon-url="item.subscriptionIconUrl"
              :background-color="item.subscriptionIconBackgroundColor"
            />
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{{ item.subscriptionName }}</span>
              <span class="font-mono-nums mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ formatRenewedAt(item.renewedAt) }}</span>
            </span>
          </button>

          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="item.source === 'automatic'
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'bg-ink-100 text-ink-600 dark:bg-ink-800/60 dark:text-ink-300'"
              >
                <component :is="item.source === 'automatic' ? Repeat : Pencil" :size="11" />
                {{ sourceLabel(item.source) }}
              </span>
              <span v-if="item.periodsAdvanced > 1" class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">补续 {{ item.periodsAdvanced }} 个周期</span>
            </div>
            <div class="font-mono-nums mt-2 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
              <span>{{ item.previousExpiryDate || '—' }}</span>
              <ArrowRight :size="13" />
              <span class="font-semibold text-ink-800 dark:text-ink-100">{{ item.newExpiryDate || '—' }}</span>
            </div>
            <p v-if="item.notes" class="mt-1.5 line-clamp-1 text-xs text-ink-500 dark:text-ink-400" :title="item.notes">{{ item.notes }}</p>
          </div>

          <div>
            <p class="text-xs text-ink-400 dark:text-ink-500">续费金额</p>
            <p class="font-mono-nums mt-1 text-sm font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(item.price, item.currency) }}</p>
          </div>
          <div>
            <p class="text-xs text-ink-400 dark:text-ink-500">续费周期</p>
            <p class="mt-1 text-sm font-semibold text-ink-800 dark:text-ink-100">{{ periodLabel(item.periodValue, item.periodUnit) }}</p>
          </div>
        </li>
      </ol>

      <div v-if="renewalStore.total > 0" class="flex justify-end border-t border-ink-100 px-4 py-3 dark:border-ink-800/60 md:px-5">
        <el-pagination
          v-model:current-page="historyPage"
          v-model:page-size="historyPageSize"
          :total="renewalStore.total"
          :page-sizes="[10, 20, 50]"
          :layout="isMobile ? 'total, prev, next' : 'total, sizes, prev, pager, next'"
          :small="isMobile"
          background
        />
      </div>
    </section>

    <el-dialog
      v-model="renewDialogVisible"
      :width="isMobile ? 'calc(100% - 24px)' : '480px'"
      title="快速续费"
      destroy-on-close
      align-center
    >
      <div v-if="renewalTarget" class="space-y-5">
        <div class="flex items-center gap-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/40">
          <SubscriptionBrandIcon
            :name="renewalTarget.name"
            :icon-url="renewalTarget.iconUrl"
            :background-color="renewalTarget.iconBackgroundColor"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{{ renewalTarget.name }}</p>
            <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">每 {{ periodLabel(renewalTarget.periodValue, renewalTarget.periodUnit) }} · 预计 {{ formatCny(getEstimatedRenewalCostCny(renewalTarget)) }}</p>
          </div>
        </div>

        <div>
          <label for="renewal-periods" class="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">续费周期数</label>
          <el-input-number
            id="renewal-periods"
            v-model="renewalPeriods"
            :min="1"
            :max="10000"
            controls-position="right"
            class="w-full"
          />
          <p v-if="getDays(renewalTarget) < 0" class="mt-2 text-xs text-warning">
            该订阅已过期，建议至少续 {{ recommendedPeriods }} 个周期以补齐到当前日期。
          </p>
        </div>

        <div class="rounded-xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-500/25 dark:bg-brand-500/10">
          <p class="text-xs font-medium text-brand-600 dark:text-brand-300">到期日期变化</p>
          <div class="font-mono-nums mt-2 flex items-center gap-3 text-sm">
            <span class="text-ink-500 dark:text-ink-400">{{ renewalTarget.expiryDate }}</span>
            <ArrowRight :size="15" class="text-brand-500" />
            <span class="font-bold text-ink-900 dark:text-ink-50">{{ renewalPreview || '无法计算' }}</span>
          </div>
        </div>

        <div>
          <label for="renewal-notes" class="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">续费备注（可选）</label>
          <el-input id="renewal-notes" v-model="renewalNotes" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="例如：已通过应用商店续费" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="renewDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="renewalStore.mutating" :disabled="!renewalPreview" @click="confirmRenewal">
            确认续费
          </el-button>
        </div>
      </template>
    </el-dialog>

    <SubscriptionDetailDrawer
      v-if="showDetail && detailSubscription"
      :subscription="detailSubscription"
      @close="showDetail = false"
      @edit="openEdit"
      @toggle="handleToggle"
      @delete="handleDelete"
      @test="handleTest"
    />
    <SubscriptionModal
      v-if="showEditModal"
      :subscription="editingSubscription"
      @close="showEditModal = false"
      @saved="handleEditSaved"
    />
  </div>
</template>

<style scoped>
.renewal-tabs {
  scrollbar-width: none;
}
.renewal-tabs::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation: none;
  }
  [class*='transition-'] {
    transition-duration: 0.01ms !important;
  }
}
</style>
