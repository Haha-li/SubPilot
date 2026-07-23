<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { getSymbol, fetchRates } from '../utils/currency';
import {
  getPersonalMonthlyCostInCurrency,
  getPersonalMonthlyCostOrZero,
  hasSharedCostCategory,
} from '../utils/subscriptionCost';
import CurrencySelect from '../components/CurrencySelect.vue';
import StatsOverview from '../components/StatsOverview.vue';

const subStore = useSubscriptionStore();
const displayCurrency = ref('CNY');
const isMobile = useMediaQuery('(max-width: 768px)');
const subscriptionPage = ref(1);
const subscriptionPageSize = 10;
const ratesRefreshKey = ref(0);

const activeSubscriptions = computed(() => subStore.subscriptions.filter((s) => s.isActive));

const paidSubscriptions = computed(() => {
  ratesRefreshKey.value;
  return activeSubscriptions.value.filter(
    (subscription) => getPersonalMonthlyCostOrZero(subscription, displayCurrency.value) > 0,
  );
});

const sortedSubs = computed(() => {
  ratesRefreshKey.value;
  return [...subStore.subscriptions].sort((a, b) => {
    const ca = getPersonalMonthlyCostOrZero(a, displayCurrency.value);
    const cb = getPersonalMonthlyCostOrZero(b, displayCurrency.value);
    if (cb !== ca) return cb - ca;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
});

const paginatedSubs = computed(() => {
  const start = (subscriptionPage.value - 1) * subscriptionPageSize;
  return sortedSubs.value.slice(start, start + subscriptionPageSize);
});

function formatMoney(val: number): string {
  if (!Number.isFinite(val)) return '汇率缺失';
  const symbol = getSymbol(displayCurrency.value);
  const amount = Math.abs(val).toFixed(2);
  return val < 0 && amount !== '0.00' ? `-${symbol}${amount}` : `${symbol}${amount}`;
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

function getNonSelfPaidLabel(sub: Subscription): string {
  if (!hasSharedCostCategory(sub.category) || !sub.nonSelfPaid || sub.nonSelfPaid <= 0) return '';
  const unitMap: Record<string, string> = { day: '/天', month: '/月', year: '/年' };
  const symbol = getSymbol(sub.nonSelfPaidCurrency || sub.currency || 'CNY');
  return symbol + sub.nonSelfPaid.toFixed(2) + (unitMap[sub.nonSelfPaidUnit || sub.priceUnit] || '/月');
}

watch(displayCurrency, () => {
  subscriptionPage.value = 1;
});

watch(() => sortedSubs.value.length, (total) => {
  const maxPage = Math.max(1, Math.ceil(total / subscriptionPageSize));
  if (subscriptionPage.value > maxPage) {
    subscriptionPage.value = maxPage;
  }
});

onMounted(() => {
  void fetchRates().finally(() => {
    ratesRefreshKey.value += 1;
  });
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

    <StatsOverview
      :subscriptions="activeSubscriptions"
      :display-currency="displayCurrency"
      :rates-refresh-key="ratesRefreshKey"
    />

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
          <el-table-column label="订阅总费用" min-width="120">
            <template #default="{ row }">
              <span v-if="row.price > 0" class="font-mono-nums font-semibold text-brand-600 dark:text-brand-300">{{ getPriceLabel(row) }}</span>
              <span v-else class="text-xs text-ink-400">免费</span>
            </template>
          </el-table-column>
          <el-table-column label="他人承担" min-width="110">
            <template #default="{ row }">
              <span v-if="getNonSelfPaidLabel(row)" class="font-mono-nums text-ink-600 dark:text-ink-300">{{ getNonSelfPaidLabel(row) }}</span>
              <span v-else class="text-ink-400">-</span>
            </template>
          </el-table-column>
          <el-table-column label="个人折合月费" min-width="120" sortable>
            <template #default="{ row }">
              <span
                v-if="row.price > 0 || getNonSelfPaidLabel(row)"
                class="font-mono-nums font-semibold"
                :class="getPersonalMonthlyCostInCurrency(row, displayCurrency) < 0
                  ? 'text-sky-600 dark:text-sky-300'
                  : 'text-ink-900 dark:text-ink-50'"
              >
                {{ formatMoney(getPersonalMonthlyCostInCurrency(row, displayCurrency)) }}
              </span>
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
