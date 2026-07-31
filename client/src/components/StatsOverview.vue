<script setup lang="ts">
import { computed } from 'vue';
import type { Subscription } from '../stores/subscription';
import { useSystemConfigStore } from '../stores/systemConfig';
import { getSymbol } from '../utils/currency';
import { getZonedDateTimeParts } from '../utils/dateOnly';
import {
  isSubscriptionPresentInMonth,
  type CalendarMonthRange,
} from '../utils/statsOverview';
import {
  getCostStatisticsInCurrency,
  getPersonalMonthlyCostInCurrency,
  getPersonalMonthlyCostOrZero,
} from '../utils/subscriptionCost';
import {
  Wallet, TrendingUp, CalendarRange, Coins, BarChart3, Layers, LineChart, ListTree,
  CircleAlert, PieChart,
} from '@lucide/vue';

const systemConfigStore = useSystemConfigStore();

const props = defineProps<{
  subscriptions: Subscription[];
  displayCurrency: string;
  ratesRefreshKey: number;
}>();

const costStatistics = computed(() => {
  props.ratesRefreshKey;
  return getCostStatisticsInCurrency(props.subscriptions, props.displayCurrency);
});

const hasUnavailableExchangeRate = computed(() =>
  !Number.isFinite(costStatistics.value.personalMonthlyCost)
  || !Number.isFinite(costStatistics.value.personalYearlyEstimatedCost),
);

const paidSubscriptions = computed(() => {
  props.ratesRefreshKey;
  return props.subscriptions.filter(
    (subscription) => getPersonalMonthlyCostOrZero(subscription, props.displayCurrency) > 0,
  );
});

interface TypeCostItem {
  label: string;
  value: number;
}

interface LabeledMonthRange extends CalendarMonthRange {
  label: string;
}

interface PieSegment extends TypeCostItem {
  color: string;
  percentage: number;
  start: number;
  end: number;
}

const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#0EA5E9', '#F43F5E'] as const;
const MAX_PIE_SEGMENTS = PIE_COLORS.length;

function buildTypeCosts(subscriptions: Subscription[]): TypeCostItem[] {
  const totals: Record<string, number> = {};
  subscriptions.forEach((subscription) => {
    const cost = getPersonalMonthlyCostInCurrency(subscription, props.displayCurrency);
    if (!Number.isFinite(cost) || cost <= 0) return;
    const type = subscription.customType || '未分类';
    totals[type] = (totals[type] || 0) + cost;
  });
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function buildMonthRange(year: number, monthIndex: number): LabeledMonthRange {
  const date = new Date(year, monthIndex, 1);
  const normalizedYear = date.getFullYear();
  const normalizedMonth = date.getMonth();
  const month = String(normalizedMonth + 1).padStart(2, '0');
  const lastDay = new Date(normalizedYear, normalizedMonth + 1, 0).getDate();
  return {
    start: `${normalizedYear}-${month}-01`,
    end: `${normalizedYear}-${month}-${String(lastDay).padStart(2, '0')}`,
    label: `${normalizedMonth + 1}月`,
  };
}

const byType = computed(() => buildTypeCosts(paidSubscriptions.value));

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

const currentMonthRange = computed(() => {
  const current = getZonedDateTimeParts(new Date(), systemConfigStore.timezone);
  return buildMonthRange(current.year, current.month - 1);
});

const currentMonthByType = computed(() => {
  props.ratesRefreshKey;
  const subscriptions = props.subscriptions.filter((subscription) => (
    isSubscriptionPresentInMonth(subscription, currentMonthRange.value)
  ));
  return buildTypeCosts(subscriptions);
});

const currentMonthPieItems = computed<TypeCostItem[]>(() => {
  const items = currentMonthByType.value;
  if (items.length <= MAX_PIE_SEGMENTS) return items;
  const visibleItems = items.slice(0, MAX_PIE_SEGMENTS - 1);
  const otherValue = items.slice(MAX_PIE_SEGMENTS - 1)
    .reduce((sum, item) => sum + item.value, 0);
  return [...visibleItems, { label: '其他', value: otherValue }];
});

const currentMonthTypeTotal = computed(() => currentMonthPieItems.value
  .reduce((sum, item) => sum + item.value, 0));

const currentMonthPieSegments = computed<PieSegment[]>(() => {
  const total = currentMonthTypeTotal.value;
  if (total <= 0) return [];
  let start = 0;
  return currentMonthPieItems.value.map((item, index) => {
    const percentage = item.value / total * 100;
    const segment = {
      ...item,
      color: PIE_COLORS[index],
      percentage,
      start,
      end: start + percentage,
    };
    start = segment.end;
    return segment;
  });
});

const currentMonthPieBackground = computed(() => `conic-gradient(${currentMonthPieSegments.value
  .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
  .join(', ')})`);

const currentMonthPieAriaLabel = computed(() => [
  `${currentMonthRange.value.label}个人费用按订阅类型分布`,
  ...currentMonthPieSegments.value.map((segment) => (
    `${segment.label}${formatMoney(segment.value)}，占比${formatPercentage(segment.percentage)}%`
  )),
].join('；'));

const monthlyTrend = computed(() => {
  props.ratesRefreshKey;
  const months: { label: string; value: number }[] = [];
  const current = getZonedDateTimeParts(new Date(), systemConfigStore.timezone);
  for (let offset = 5; offset >= 0; offset -= 1) {
    const range = buildMonthRange(current.year, current.month - 1 - offset);
    let total = 0;
    props.subscriptions.forEach((subscription) => {
      if (!isSubscriptionPresentInMonth(subscription, range)) return;
      total += getPersonalMonthlyCostOrZero(subscription, props.displayCurrency);
    });
    months.push({ label: range.label, value: Math.round(total * 100) / 100 });
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

function formatPercentage(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
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
  { label: '个人年度预估费用', value: formatMoney(costStatistics.value.personalYearlyEstimatedCost), icon: CalendarRange, tone: 'warning' as const },
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
        <span class="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-ink-400 sm:text-xs dark:text-ink-500">{{ kpi.label }}</span>
        <div class="flex h-9 w-9 items-center justify-center rounded-xl" :class="[toneClasses[kpi.tone].bg, toneClasses[kpi.tone].text]">
          <component :is="kpi.icon" :size="18" :stroke-width="2.25" />
        </div>
      </div>
      <p class="font-mono-nums mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-ink-50">
        {{ kpi.value }}<span v-if="kpi.suffix" class="ml-1 text-base font-normal text-ink-400">{{ kpi.suffix }}</span>
      </p>
    </div>
  </div>

  <div
    v-if="hasUnavailableExchangeRate"
    role="status"
    aria-live="polite"
    class="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
  >
    <CircleAlert :size="18" class="mt-0.5 flex-shrink-0" aria-hidden="true" />
    <span>部分订阅缺少可用汇率，费用汇总和图表暂时无法完整计算。</span>
  </div>

  <div v-if="!hasUnavailableExchangeRate" class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
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

  <div
    v-if="!hasUnavailableExchangeRate && (monthlyTrend.some((month) => month.value !== 0) || currentMonthPieSegments.length > 0)"
    class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]"
  >
    <section class="bento-card p-5" aria-labelledby="monthly-trend-title">
      <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"><LineChart :size="16" /></div>
          <h3 id="monthly-trend-title" class="text-sm font-semibold text-ink-900 dark:text-ink-50">近 6 个月个人费用趋势</h3>
        </div>
        <span class="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><TrendingUp :size="12" />净费用 · 收益为负</span>
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

    <section class="bento-card p-5" aria-labelledby="current-month-type-title">
      <header class="mb-5 flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><PieChart :size="16" /></div>
          <div>
            <h3 id="current-month-type-title" class="text-sm font-semibold text-ink-900 dark:text-ink-50">当月类型费用</h3>
            <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{{ currentMonthRange.label }} · 个人月费</p>
          </div>
        </div>
        <span v-if="currentMonthPieSegments.length" class="font-mono-nums whitespace-nowrap text-xs font-semibold text-ink-700 dark:text-ink-200">{{ formatMoney(currentMonthTypeTotal) }}</span>
      </header>

      <div v-if="currentMonthPieSegments.length" class="flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
        <div
          role="img"
          :aria-label="currentMonthPieAriaLabel"
          class="h-36 w-36 flex-shrink-0 rounded-full shadow-inner ring-1 ring-ink-200/70 dark:ring-ink-700/60"
          :style="{ background: currentMonthPieBackground }"
        />
        <ul class="w-full min-w-0 space-y-2" aria-label="当月订阅类型费用明细">
          <li v-for="segment in currentMonthPieSegments" :key="segment.label" class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: segment.color }" aria-hidden="true" />
            <span class="truncate text-xs text-ink-600 dark:text-ink-300" :title="segment.label">{{ segment.label }}</span>
            <span class="text-right">
              <span class="font-mono-nums block text-xs font-semibold text-ink-900 dark:text-ink-50">{{ formatMoney(segment.value) }}</span>
              <span class="font-mono-nums block text-[10px] text-ink-400 dark:text-ink-500">{{ formatPercentage(segment.percentage) }}%</span>
            </span>
          </li>
        </ul>
      </div>

      <div v-else class="flex h-56 flex-col items-center justify-center text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-300"><PieChart :size="22" /></div>
        <p class="mt-3 text-sm font-medium text-ink-700 dark:text-ink-200">本月暂无正向费用</p>
        <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">当月有效的付费订阅会按类型汇总</p>
      </div>
    </section>
  </div>

  <div v-if="!hasUnavailableExchangeRate && byType.length === 0 && byCategory.length === 0" class="bento-card flex flex-col items-center justify-center px-6 py-20 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300"><BarChart3 :size="28" /></div>
    <p class="mt-4 text-base font-medium text-ink-700 dark:text-ink-200">暂无正向费用数据</p>
    <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">合租收益与净费用可在顶部汇总和订阅明细中查看</p>
  </div>
</template>
