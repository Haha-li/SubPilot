<script setup lang="ts">
import { computed } from 'vue';
import type { Subscription } from '../stores/subscription';
import { getSymbol } from '../utils/currency';
import {
  getCostStatisticsInCurrency,
  getPersonalMonthlyCostInCurrency,
  getPersonalMonthlyCostOrZero,
} from '../utils/subscriptionCost';
import {
  Wallet, TrendingUp, CalendarRange, Coins, BarChart3, Layers, LineChart, ListTree,
} from '@lucide/vue';

const props = defineProps<{
  subscriptions: Subscription[];
  displayCurrency: string;
}>();

const costStatistics = computed(() =>
  getCostStatisticsInCurrency(props.subscriptions, props.displayCurrency),
);

const paidSubscriptions = computed(() => props.subscriptions.filter(
  (subscription) => getPersonalMonthlyCostOrZero(subscription, props.displayCurrency) > 0,
));

const byType = computed(() => {
  const totals: Record<string, number> = {};
  paidSubscriptions.value.forEach((subscription) => {
    const cost = getPersonalMonthlyCostInCurrency(subscription, props.displayCurrency);
    if (!Number.isFinite(cost)) return;
    const type = subscription.customType || '未分类';
    totals[type] = (totals[type] || 0) + cost;
  });
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});

const byCategory = computed(() => {
  const totals: Record<string, number> = {};
  paidSubscriptions.value.forEach((subscription) => {
    const category = (subscription.category || '').trim();
    const tokens = category ? category.split(/[/,，\s]+/).filter(Boolean) : ['未分类'];
    const cost = getPersonalMonthlyCostInCurrency(subscription, props.displayCurrency);
    if (!Number.isFinite(cost)) return;
    tokens.forEach((token) => {
      totals[token] = (totals[token] || 0) + cost;
    });
  });
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});

const maxTypeValue = computed(() => Math.max(1, ...byType.value.map((item) => item.value)));
const maxCategoryValue = computed(() => Math.max(1, ...byCategory.value.map((item) => item.value)));

const monthlyTrend = computed(() => {
  const months: { label: string; value: number }[] = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();
    let total = 0;
    props.subscriptions.forEach((subscription) => {
      const expiryTime = new Date(subscription.expiryDate).getTime();
      const startTime = subscription.startDate ? new Date(subscription.startDate).getTime() : 0;
      if (expiryTime >= monthStart && startTime <= monthEnd) {
        total += getPersonalMonthlyCostOrZero(subscription, props.displayCurrency);
      }
    });
    months.push({ label: `${month + 1}月`, value: Math.round(total * 100) / 100 });
  }
  return months;
});

const trendScale = computed(() => {
  const values = monthlyTrend.value.map((item) => item.value);
  const positiveMax = Math.max(0, ...values);
  const negativeMax = Math.abs(Math.min(0, ...values));
  const range = Math.max(1, positiveMax + negativeMax);
  return { baseline: negativeMax / range * 100, range };
});

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '汇率缺失';
  const symbol = getSymbol(props.displayCurrency);
  const amount = Math.abs(value).toFixed(2);
  return value < 0 && amount !== '0.00' ? `-${symbol}${amount}` : `${symbol}${amount}`;
}

function getTrendBarStyle(value: number, index: number) {
  const height = Math.abs(value) / trendScale.value.range * 100;
  const bottom = value < 0
    ? Math.max(0, trendScale.value.baseline - height)
    : trendScale.value.baseline;
  return {
    height: value === 0 ? '2px' : `${height}%`,
    bottom: `${bottom}%`,
    transitionDelay: `${index * 60}ms`,
  };
}

const kpiCards = computed(() => [
  { label: '活跃订阅', value: String(props.subscriptions.length), suffix: '个', icon: Layers, tone: 'brand' as const },
  { label: '合租月收益', value: formatMoney(costStatistics.value.sharedMonthlyIncome), icon: TrendingUp, tone: 'income' as const },
  { label: '个人月度费用', value: formatMoney(costStatistics.value.personalMonthlyCost), icon: Wallet, tone: 'success' as const },
  { label: '个人年度费用', value: formatMoney(costStatistics.value.personalYearlyCost), icon: CalendarRange, tone: 'warning' as const },
  { label: '个人日均费用', value: formatMoney(costStatistics.value.personalDailyCost), icon: Coins, tone: 'danger' as const },
]);

const toneClasses = {
  brand: { bg: 'bg-brand-50 dark:bg-brand-500/10', text: 'text-brand-600 dark:text-brand-300' },
  income: { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-300' },
  success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-300' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-300' },
  danger: { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-300' },
};
</script>

<template>
  <div class="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
    <div v-for="kpi in kpiCards" :key="kpi.label" class="bento-card p-5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">{{ kpi.label }}</span>
        <div class="flex h-9 w-9 items-center justify-center rounded-xl" :class="[toneClasses[kpi.tone].bg, toneClasses[kpi.tone].text]">
          <component :is="kpi.icon" :size="18" :stroke-width="2.25" />
        </div>
      </div>
      <p class="font-mono-nums mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-ink-50">
        {{ kpi.value }}<span v-if="kpi.suffix" class="ml-1 text-base font-normal text-ink-400">{{ kpi.suffix }}</span>
      </p>
    </div>
  </div>

  <div class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
    <section v-if="byType.length > 0" class="bento-card p-5">
      <header class="mb-4 flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><BarChart3 :size="16" /></div>
        <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">按类型分布 <span class="text-xs font-normal text-ink-400">个人月费</span></h3>
      </header>
      <div class="space-y-2.5">
        <div v-for="(item, index) in byType" :key="item.label" class="group">
          <div class="flex items-center justify-between text-xs">
            <span class="truncate text-ink-700 dark:text-ink-200" :title="item.label">{{ item.label }}</span>
            <span class="font-mono-nums font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(item.value) }}</span>
          </div>
          <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/60">
            <div class="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500" :style="{ width: (item.value / maxTypeValue * 100) + '%', transitionDelay: (index * 30) + 'ms' }" />
          </div>
        </div>
      </div>
    </section>

    <section v-if="byCategory.length > 0" class="bento-card p-5">
      <header class="mb-4 flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><ListTree :size="16" /></div>
        <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">按分类分布 <span class="text-xs font-normal text-ink-400">个人月费</span></h3>
      </header>
      <div class="space-y-2.5">
        <div v-for="(item, index) in byCategory" :key="item.label" class="group">
          <div class="flex items-center justify-between text-xs">
            <span class="truncate text-ink-700 dark:text-ink-200" :title="item.label">{{ item.label }}</span>
            <span class="font-mono-nums font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(item.value) }}</span>
          </div>
          <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800/60">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" :style="{ width: (item.value / maxCategoryValue * 100) + '%', transitionDelay: (index * 30) + 'ms' }" />
          </div>
        </div>
      </div>
    </section>
  </div>

  <section v-if="monthlyTrend.some((month) => month.value !== 0)" class="bento-card mb-5 p-5">
    <header class="mb-5 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"><LineChart :size="16" /></div>
        <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">近 6 个月个人费用趋势</h3>
      </div>
      <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><TrendingUp :size="12" />净费用 · 收益为负</span>
    </header>
    <div class="flex h-56 items-end gap-3 px-2 md:gap-6">
      <div v-for="(item, index) in monthlyTrend" :key="item.label" class="group flex h-full flex-1 flex-col items-center">
        <div class="font-mono-nums mb-1.5 whitespace-nowrap text-[10px] font-semibold text-ink-700 opacity-100 transition-opacity duration-200 sm:text-xs md:opacity-0 md:group-hover:opacity-100 dark:text-ink-200">{{ formatMoney(item.value) }}</div>
        <div class="relative flex w-full flex-1">
          <div class="absolute left-0 right-0 h-px bg-ink-300 dark:bg-ink-600" :style="{ bottom: trendScale.baseline + '%' }" />
          <div
            class="absolute left-0 w-full shadow-sm transition-all duration-700 ease-soft"
            :class="item.value < 0
              ? 'rounded-b-lg bg-gradient-to-b from-sky-400 to-sky-500 group-hover:from-sky-500 group-hover:to-sky-600'
              : 'rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400 group-hover:from-brand-600 group-hover:to-brand-500'"
            :style="getTrendBarStyle(item.value, index)"
          />
        </div>
        <div class="mt-2 text-xs text-ink-500 dark:text-ink-400">{{ item.label }}</div>
      </div>
    </div>
  </section>

  <div v-if="byType.length === 0 && byCategory.length === 0" class="bento-card flex flex-col items-center justify-center px-6 py-20 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300"><BarChart3 :size="28" /></div>
    <p class="mt-4 text-base font-medium text-ink-700 dark:text-ink-200">暂无正向费用数据</p>
    <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">合租收益与净费用可在顶部汇总和订阅明细中查看</p>
  </div>
</template>
