<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { convert, getSymbol, fetchRates } from '../utils/currency';
import CurrencySelect from '../components/CurrencySelect.vue';
import {
  Wallet, TrendingUp, CalendarRange, Coins, BarChart3, Layers, LineChart, ListTree,
} from '@lucide/vue';

const subStore = useSubscriptionStore();
const displayCurrency = ref('CNY');
const isMobile = useMediaQuery('(max-width: 768px)');
const subscriptionPage = ref(1);
const subscriptionPageSize = 10;

function getMonthlyCostInCurrency(sub: Subscription, target: string): number {
  const price = sub.price || 0;
  if (price <= 0) return 0;
  const unit = sub.priceUnit || 'month';
  const monthly = unit === 'year' ? price / 12 : unit === 'day' ? price * 30 : price;
  return convert(monthly, sub.currency || 'CNY', target);
}

function getMonthlyCostOrZero(sub: Subscription, target: string): number {
  const value = getMonthlyCostInCurrency(sub, target);
  return Number.isFinite(value) ? value : 0;
}

const activeSubscriptions = computed(() => subStore.subscriptions.filter((s) => s.isActive));

const totalMonthly = computed(() =>
  activeSubscriptions.value.reduce((sum, s) => sum + getMonthlyCostOrZero(s, displayCurrency.value), 0),
);

const totalYearly = computed(() => totalMonthly.value * 12);
const totalDaily = computed(() => totalMonthly.value / 30);

const paidSubscriptions = computed(() => activeSubscriptions.value.filter((s) => (s.price || 0) > 0));

const byType = computed(() => {
  const map: Record<string, number> = {};
  paidSubscriptions.value.forEach((s) => {
    const cost = getMonthlyCostInCurrency(s, displayCurrency.value);
    if (!Number.isFinite(cost)) return;
    const type = s.customType || '未分类';
    map[type] = (map[type] || 0) + cost;
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});
const maxTypeValue = computed(() => Math.max(1, ...byType.value.map((i) => i.value)));

const byCategory = computed(() => {
  const map: Record<string, number> = {};
  paidSubscriptions.value.forEach((s) => {
    const cat = (s.category || '').trim();
    const tokens = cat ? cat.split(/[/,，\s]+/).filter(Boolean) : ['未分类'];
    const cost = getMonthlyCostInCurrency(s, displayCurrency.value);
    if (!Number.isFinite(cost)) return;
    tokens.forEach((t) => {
      map[t] = (map[t] || 0) + cost;
    });
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});
const maxCatValue = computed(() => Math.max(1, ...byCategory.value.map((i) => i.value)));

const monthlyTrend = computed(() => {
  const months: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();
    let total = 0;
    activeSubscriptions.value.forEach((sub) => {
      if (!sub.price || sub.price <= 0) return;
      const expiryTime = new Date(sub.expiryDate).getTime();
      const startTime = sub.startDate ? new Date(sub.startDate).getTime() : 0;
      if (expiryTime >= monthStart && startTime <= monthEnd) {
        total += getMonthlyCostOrZero(sub, displayCurrency.value);
      }
    });
    months.push({ label: `${month + 1}月`, value: Math.round(total * 100) / 100 });
  }
  return months;
});
const maxTrendValue = computed(() => Math.max(1, ...monthlyTrend.value.map((i) => i.value)));

const sortedSubs = computed(() =>
  [...subStore.subscriptions].sort((a, b) => {
    const ca = getMonthlyCostOrZero(a, displayCurrency.value);
    const cb = getMonthlyCostOrZero(b, displayCurrency.value);
    if (cb !== ca) return cb - ca;
    return a.name.localeCompare(b.name, 'zh-CN');
  }),
);

const paginatedSubs = computed(() => {
  const start = (subscriptionPage.value - 1) * subscriptionPageSize;
  return sortedSubs.value.slice(start, start + subscriptionPageSize);
});

function formatMoney(val: number): string {
  if (!Number.isFinite(val)) return '汇率缺失';
  return getSymbol(displayCurrency.value) + val.toFixed(2);
}

function getPeriodLabel(sub: Subscription): string {
  const unitMap: Record<string, string> = { day: '天', month: '月', year: '年' };
  return `${sub.periodValue}${unitMap[sub.periodUnit] || sub.periodUnit}`;
}

function getPriceLabel(sub: Subscription): string {
  const unitMap: Record<string, string> = { day: '/天', month: '/月', year: '/年' };
  const sym = getSymbol(sub.currency || 'CNY');
  return `${sym}${(sub.price || 0).toFixed(2)}${unitMap[sub.priceUnit] || '/月'}`;
}

const kpiCards = computed(() => [
  {
    label: '活跃订阅',
    value: String(activeSubscriptions.value.length),
    suffix: '个',
    icon: Layers,
    tone: 'brand' as const,
  },
  {
    label: '月度费用',
    value: formatMoney(totalMonthly.value),
    icon: Wallet,
    tone: 'success' as const,
  },
  {
    label: '年度费用',
    value: formatMoney(totalYearly.value),
    icon: CalendarRange,
    tone: 'warning' as const,
  },
  {
    label: '日均费用',
    value: formatMoney(totalDaily.value),
    icon: Coins,
    tone: 'danger' as const,
  },
]);

const toneClasses = {
  brand:   { bg: 'bg-brand-50 dark:bg-brand-500/10',     text: 'text-brand-600 dark:text-brand-300' },
  success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-300' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-500/10',     text: 'text-amber-600 dark:text-amber-300' },
  danger:  { bg: 'bg-rose-50 dark:bg-rose-500/10',       text: 'text-rose-600 dark:text-rose-300' },
};

watch(displayCurrency, () => {
  subscriptionPage.value = 1;
});

watch(() => sortedSubs.value.length, (total) => {
  const maxPage = Math.max(1, Math.ceil(total / subscriptionPageSize));
  if (subscriptionPage.value > maxPage) {
    subscriptionPage.value = maxPage;
  }
});

onMounted(async () => {
  fetchRates();
  if (subStore.subscriptions.length === 0) {
    subStore.fetchSubscriptions();
  }
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">费用统计</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">订阅费用分析与概览</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-medium uppercase tracking-wide text-ink-400">币种</span>
        <CurrencySelect v-model="displayCurrency" width="132px" aria-label="统计币种" />
      </div>
    </div>

    <!-- KPI Bento -->
    <div class="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div
        v-for="kpi in kpiCards"
        :key="kpi.label"
        class="bento-card p-5"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
            {{ kpi.label }}
          </span>
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl"
            :class="[toneClasses[kpi.tone].bg, toneClasses[kpi.tone].text]"
          >
            <component :is="kpi.icon" :size="18" :stroke-width="2.25" />
          </div>
        </div>
        <p class="font-mono-nums mt-3 text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {{ kpi.value }}<span v-if="kpi.suffix" class="ml-1 text-base font-normal text-ink-400">{{ kpi.suffix }}</span>
        </p>
      </div>
    </div>

    <!-- Distribution Bento (2 cols) -->
    <div class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section v-if="byType.length > 0" class="bento-card p-5">
        <header class="mb-4 flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <BarChart3 :size="16" />
          </div>
          <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">按类型分布 <span class="text-xs font-normal text-ink-400">月费</span></h3>
        </header>
        <div class="space-y-2.5">
          <div v-for="(item, idx) in byType" :key="item.label" class="group">
            <div class="flex items-center justify-between text-xs">
              <span class="truncate text-ink-700 dark:text-ink-200" :title="item.label">{{ item.label }}</span>
              <span class="font-mono-nums font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(item.value) }}</span>
            </div>
            <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/60">
              <div
                class="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                :style="{ width: (item.value / maxTypeValue * 100) + '%', transitionDelay: (idx * 30) + 'ms' }"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="byCategory.length > 0" class="bento-card p-5">
        <header class="mb-4 flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ListTree :size="16" />
          </div>
          <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">按分类分布 <span class="text-xs font-normal text-ink-400">月费</span></h3>
        </header>
        <div class="space-y-2.5">
          <div v-for="(item, idx) in byCategory" :key="item.label" class="group">
            <div class="flex items-center justify-between text-xs">
              <span class="truncate text-ink-700 dark:text-ink-200" :title="item.label">{{ item.label }}</span>
              <span class="font-mono-nums font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(item.value) }}</span>
            </div>
            <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/60">
              <div
                class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                :style="{ width: (item.value / maxCatValue * 100) + '%', transitionDelay: (idx * 30) + 'ms' }"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Trend Bento -->
    <section v-if="monthlyTrend.some((m) => m.value > 0)" class="bento-card mb-5 p-5">
      <header class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <LineChart :size="16" />
          </div>
          <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">近 6 个月费用趋势</h3>
        </div>
        <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          <TrendingUp :size="12" />
          同期对比
        </span>
      </header>
      <div class="flex h-56 items-end gap-3 px-2 md:gap-6">
        <div
          v-for="(item, idx) in monthlyTrend"
          :key="item.label"
          class="group flex h-full flex-1 flex-col items-center"
        >
          <div class="font-mono-nums mb-1.5 text-xs font-semibold text-ink-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-ink-200">
            {{ formatMoney(item.value) }}
          </div>
          <div class="relative flex flex-1 w-full items-end">
            <div
              class="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400 shadow-sm transition-all duration-700 ease-soft group-hover:from-brand-600 group-hover:to-brand-500"
              :style="{
                height: Math.max(2, (item.value / maxTrendValue * 100)) + '%',
                transitionDelay: (idx * 60) + 'ms',
              }"
            />
          </div>
          <div class="mt-2 text-xs text-ink-500 dark:text-ink-400">{{ item.label }}</div>
        </div>
      </div>
    </section>

    <!-- Empty -->
    <div
      v-if="byType.length === 0 && byCategory.length === 0"
      class="bento-card flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300">
        <BarChart3 :size="28" />
      </div>
      <p class="mt-4 text-base font-medium text-ink-700 dark:text-ink-200">暂无付费订阅数据</p>
      <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">添加订阅并填写费用后，统计图表会出现在这里</p>
    </div>

    <!-- Detail Table -->
    <section class="bento-card overflow-hidden p-5">
      <header class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">全部订阅</h3>
        <span class="text-xs text-ink-500 dark:text-ink-400">
          共 <span class="font-mono-nums font-semibold text-ink-700 dark:text-ink-200">{{ subStore.subscriptions.length }}</span> 项 ·
          <span class="font-mono-nums font-semibold text-ink-700 dark:text-ink-200">{{ paidSubscriptions.length }}</span> 项付费
        </span>
      </header>
      <div class="-mx-5 overflow-x-auto">
        <el-table :data="paginatedSubs" stripe style="width: 100%">
          <el-table-column label="订阅名称" prop="name" min-width="140">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <span :class="row.isActive ? 'text-ink-900 dark:text-ink-50' : 'text-ink-400'">{{ row.name }}</span>
                <span v-if="!row.isActive" class="rounded-md bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">停用</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" prop="customType" min-width="100">
            <template #default="{ row }">
              <span class="text-ink-600 dark:text-ink-300">{{ row.customType || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="续订周期" min-width="90">
            <template #default="{ row }">
              <span class="font-mono-nums text-ink-600 dark:text-ink-300">{{ getPeriodLabel(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="费用" min-width="110">
            <template #default="{ row }">
              <span v-if="row.price > 0" class="font-mono-nums font-semibold text-brand-600 dark:text-brand-300">{{ getPriceLabel(row) }}</span>
              <span v-else class="text-xs text-ink-400">免费</span>
            </template>
          </el-table-column>
          <el-table-column label="折合月费" min-width="100" sortable>
            <template #default="{ row }">
              <span v-if="row.price > 0" class="font-mono-nums font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(getMonthlyCostInCurrency(row, displayCurrency)) }}</span>
              <span v-else class="text-ink-400">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-if="sortedSubs.length > subscriptionPageSize" class="flex justify-end pt-4">
        <el-pagination
          v-model:current-page="subscriptionPage"
          :page-size="subscriptionPageSize"
          :total="sortedSubs.length"
          :layout="isMobile ? 'total, prev, next' : 'total, prev, pager, next'"
          :small="isMobile"
          background
        />
      </div>
    </section>
  </div>
</template>
