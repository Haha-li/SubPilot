<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { currencies, convert, getSymbol, fetchRates } from '../utils/currency';

const subStore = useSubscriptionStore();
const displayCurrency = ref('CNY');

function getMonthlyCostInCurrency(sub: Subscription, target: string): number {
  const price = sub.price || 0;
  if (price <= 0) return 0;
  const unit = sub.priceUnit || 'month';
  const monthly = unit === 'year' ? price / 12 : unit === 'day' ? price * 30 : price;
  return convert(monthly, sub.currency || 'CNY', target);
}

const activeSubscriptions = computed(() => subStore.subscriptions.filter(s => s.isActive));

const totalMonthly = computed(() =>
  activeSubscriptions.value.reduce((sum, s) => sum + getMonthlyCostInCurrency(s, displayCurrency.value), 0)
);

const totalYearly = computed(() => totalMonthly.value * 12);

const totalDaily = computed(() => totalMonthly.value / 30);

const paidSubscriptions = computed(() =>
  activeSubscriptions.value.filter(s => (s.price || 0) > 0)
);

const freeSubscriptions = computed(() =>
  activeSubscriptions.value.filter(s => !s.price || s.price <= 0)
);

const byType = computed(() => {
  const map: Record<string, number> = {};
  paidSubscriptions.value.forEach(s => {
    const type = s.customType || '未分类';
    map[type] = (map[type] || 0) + getMonthlyCostInCurrency(s, displayCurrency.value);
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});

const maxTypeValue = computed(() => Math.max(1, ...byType.value.map(i => i.value)));

const byCategory = computed(() => {
  const map: Record<string, number> = {};
  paidSubscriptions.value.forEach(s => {
    const cat = (s.category || '').trim();
    const tokens = cat ? cat.split(/[/,，\s]+/).filter(Boolean) : ['未分类'];
    tokens.forEach(t => {
      map[t] = (map[t] || 0) + getMonthlyCostInCurrency(s, displayCurrency.value);
    });
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});

const maxCatValue = computed(() => Math.max(1, ...byCategory.value.map(i => i.value)));

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
    activeSubscriptions.value.forEach(sub => {
      if (!sub.price || sub.price <= 0) return;
      const expiryTime = new Date(sub.expiryDate).getTime();
      const startTime = sub.startDate ? new Date(sub.startDate).getTime() : 0;
      if (expiryTime >= monthStart && startTime <= monthEnd) {
        total += getMonthlyCostInCurrency(sub, displayCurrency.value);
      }
    });
    months.push({ label: `${month + 1}月`, value: Math.round(total * 100) / 100 });
  }
  return months;
});

const maxTrendValue = computed(() => Math.max(1, ...monthlyTrend.value.map(i => i.value)));

const sortedSubs = computed(() =>
  [...subStore.subscriptions].sort((a, b) => {
    const ca = getMonthlyCostInCurrency(a, displayCurrency.value);
    const cb = getMonthlyCostInCurrency(b, displayCurrency.value);
    if (cb !== ca) return cb - ca;
    return a.name.localeCompare(b.name, 'zh-CN');
  })
);

function formatMoney(val: number): string {
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

onMounted(async () => {
  fetchRates();
  if (subStore.subscriptions.length === 0) {
    subStore.fetchSubscriptions();
  }
});
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">费用统计</h2>
        <p class="page-subtitle">订阅费用分析与概览</p>
      </div>
      <div class="currency-switcher">
        <span class="currency-label">统计币种</span>
        <el-select v-model="displayCurrency" style="width: 100px">
          <el-option v-for="c in currencies" :key="c.code" :label="c.code" :value="c.code" />
        </el-select>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-cards">
      <el-card shadow="never">
        <div class="summary-card">
          <div class="summary-value">{{ activeSubscriptions.length }}</div>
          <div class="summary-label">活跃订阅</div>
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="summary-card">
          <div class="summary-value">{{ formatMoney(totalMonthly) }}</div>
          <div class="summary-label">月度费用</div>
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="summary-card">
          <div class="summary-value">{{ formatMoney(totalYearly) }}</div>
          <div class="summary-label">年度费用</div>
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="summary-card">
          <div class="summary-value">{{ formatMoney(totalDaily) }}</div>
          <div class="summary-label">日均费用</div>
        </div>
      </el-card>
    </div>

    <!-- Charts -->
    <el-row :gutter="20" v-if="byType.length > 0 || byCategory.length > 0">
      <el-col :xs="24" :md="12" v-if="byType.length > 0">
        <el-card shadow="never">
          <template #header>
            <span class="section-title">按类型分布（月费）</span>
          </template>
          <div class="bar-chart">
            <div v-for="item in byType" :key="item.label" class="bar-row">
              <span class="bar-label">{{ item.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (item.value / maxTypeValue * 100) + '%' }"></div>
              </div>
              <span class="bar-value">{{ formatMoney(item.value) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="byType.length > 0 ? 12 : 24" v-if="byCategory.length > 0">
        <el-card shadow="never">
          <template #header>
            <span class="section-title">按分类分布（月费）</span>
          </template>
          <div class="bar-chart">
            <div v-for="item in byCategory" :key="item.label" class="bar-row">
              <span class="bar-label">{{ item.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (item.value / maxCatValue * 100) + '%' }"></div>
              </div>
              <span class="bar-value">{{ formatMoney(item.value) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Monthly Trend -->
    <el-card shadow="never" style="margin-top: 20px" v-if="monthlyTrend.some(m => m.value > 0)">
      <template #header>
        <span class="section-title">近6个月费用趋势</span>
      </template>
      <div class="trend-chart">
        <div v-for="item in monthlyTrend" :key="item.label" class="trend-col">
          <div class="trend-value">{{ formatMoney(item.value) }}</div>
          <div class="trend-track">
            <div class="trend-fill" :style="{ height: (item.value / maxTrendValue * 100) + '%' }"></div>
          </div>
          <div class="trend-label">{{ item.label }}</div>
        </div>
      </div>
    </el-card>

    <el-empty v-if="byType.length === 0 && byCategory.length === 0" description="暂无付费订阅数据" />

    <!-- Detail Table -->
    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <div class="table-header">
          <span class="section-title">全部订阅</span>
          <span class="table-count">共 {{ subStore.subscriptions.length }} 项，{{ paidSubscriptions.length }} 项付费</span>
        </div>
      </template>
      <div class="table-wrapper">
      <el-table :data="sortedSubs" stripe style="width: 100%">
        <el-table-column label="订阅名称" prop="name" min-width="120">
          <template #default="{ row }">
            <div class="name-cell">
              <span :class="{ inactive: !row.isActive }">{{ row.name }}</span>
              <el-tag v-if="!row.isActive" size="small" type="info" effect="plain">停用</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" prop="customType" min-width="100">
          <template #default="{ row }">
            {{ row.customType || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="续订周期" min-width="80">
          <template #default="{ row }">
            {{ getPeriodLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="费用" min-width="100">
          <template #default="{ row }">
            <span v-if="row.price > 0" class="money">{{ getPriceLabel(row) }}</span>
            <span v-else class="free">免费</span>
          </template>
        </el-table-column>
        <el-table-column label="折合月费" min-width="90" sortable>
          <template #default="{ row }">
            <span v-if="row.price > 0" class="money">{{ formatMoney(getMonthlyCost(row)) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.currency-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.currency-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .summary-cards {
    grid-template-columns: repeat(4, 1fr);
  }
}

.summary-card {
  text-align: center;
  padding: 8px 0;
}

.summary-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.summary-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: clamp(50px, 20vw, 80px);
  text-align: right;
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  flex: 1;
  height: 22px;
  background-color: var(--el-fill-color);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background-color: var(--el-color-primary);
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-value {
  width: clamp(50px, 20vw, 80px);
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
  text-align: right;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inactive {
  color: var(--el-text-color-secondary);
}

.money {
  font-weight: 600;
  color: var(--el-color-primary);
}

.free {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200px;
  gap: 8px;
  padding: 0 16px;
}

.trend-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
}

.trend-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
  white-space: nowrap;
}

.trend-track {
  flex: 1;
  width: 100%;
  max-width: 48px;
  background: var(--el-fill-color);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

.trend-fill {
  width: 100%;
  background: var(--el-color-primary);
  border-radius: 4px;
  transition: height 0.3s;
  min-height: 2px;
}

.trend-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}
</style>
