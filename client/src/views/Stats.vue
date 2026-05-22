<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';

const subStore = useSubscriptionStore();

function getMonthlyCost(sub: Subscription): number {
  const price = sub.price || 0;
  if (price <= 0) return 0;
  const unit = sub.priceUnit || 'month';
  if (unit === 'month') return price;
  if (unit === 'year') return price / 12;
  if (unit === 'day') return price * 30;
  return price;
}

const activeSubscriptions = computed(() => subStore.subscriptions.filter(s => s.isActive));

const totalMonthly = computed(() =>
  activeSubscriptions.value.reduce((sum, s) => sum + getMonthlyCost(s), 0)
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
    map[type] = (map[type] || 0) + getMonthlyCost(s);
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
      map[t] = (map[t] || 0) + getMonthlyCost(s);
    });
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
});

const maxCatValue = computed(() => Math.max(1, ...byCategory.value.map(i => i.value)));

const sortedSubs = computed(() =>
  [...subStore.subscriptions].sort((a, b) => {
    const ca = getMonthlyCost(a);
    const cb = getMonthlyCost(b);
    if (cb !== ca) return cb - ca;
    return a.name.localeCompare(b.name, 'zh-CN');
  })
);

function formatMoney(val: number): string {
  return '¥' + val.toFixed(2);
}

function getPeriodLabel(sub: Subscription): string {
  const unitMap: Record<string, string> = { day: '天', month: '月', year: '年' };
  return `${sub.periodValue}${unitMap[sub.periodUnit] || sub.periodUnit}`;
}

function getPriceLabel(sub: Subscription): string {
  const unitMap: Record<string, string> = { day: '/天', month: '/月', year: '/年' };
  return formatMoney(sub.price) + (unitMap[sub.priceUnit] || '/月');
}

onMounted(() => {
  if (subStore.subscriptions.length === 0) {
    subStore.fetchSubscriptions();
  }
});
</script>

<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">费用统计</h2>
      <p class="page-subtitle">订阅费用分析与概览</p>
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

    <el-empty v-if="byType.length === 0 && byCategory.length === 0" description="暂无付费订阅数据" />

    <!-- Detail Table -->
    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <div class="table-header">
          <span class="section-title">全部订阅</span>
          <span class="table-count">共 {{ subStore.subscriptions.length }} 项，{{ paidSubscriptions.length }} 项付费</span>
        </div>
      </template>
      <el-table :data="sortedSubs" stripe style="width: 100%">
        <el-table-column label="订阅名称" prop="name" min-width="120">
          <template #default="{ row }">
            <div class="name-cell">
              <span :class="{ inactive: !row.isActive }">{{ row.name }}</span>
              <el-tag v-if="!row.isActive" size="small" type="info" effect="plain">停用</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" prop="customType" width="120">
          <template #default="{ row }">
            {{ row.customType || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="续订周期" width="100">
          <template #default="{ row }">
            {{ getPeriodLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="费用" width="130">
          <template #default="{ row }">
            <span v-if="row.price > 0" class="money">{{ getPriceLabel(row) }}</span>
            <span v-else class="free">免费</span>
          </template>
        </el-table-column>
        <el-table-column label="折合月费" width="110" sortable>
          <template #default="{ row }">
            <span v-if="row.price > 0" class="money">{{ formatMoney(getMonthlyCost(row)) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 24px;
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
  width: 80px;
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
  width: 80px;
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
</style>
