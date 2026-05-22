<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';

const subStore = useSubscriptionStore();

function getMonthlyCost(sub: Subscription): number {
  const price = sub.price || 0;
  if (price <= 0) return 0;
  const unit = sub.periodUnit || 'month';
  const value = sub.periodValue || 1;
  if (unit === 'month') return price / value;
  if (unit === 'year') return price / (value * 12);
  if (unit === 'day') return (price * 30) / value;
  return price;
}

const activeSubscriptions = computed(() => subStore.subscriptions.filter(s => s.isActive));

const totalMonthly = computed(() =>
  activeSubscriptions.value.reduce((sum, s) => sum + getMonthlyCost(s), 0)
);

const totalYearly = computed(() => totalMonthly.value * 12);

const paidSubscriptions = computed(() =>
  subStore.subscriptions.filter(s => (s.price || 0) > 0)
);

const byType = computed(() => {
  const map: Record<string, number> = {};
  activeSubscriptions.value.forEach(s => {
    const type = s.customType || '未分类';
    map[type] = (map[type] || 0) + getMonthlyCost(s);
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
});

const maxTypeValue = computed(() => Math.max(1, ...byType.value.map(i => i.value)));

const byCategory = computed(() => {
  const map: Record<string, number> = {};
  activeSubscriptions.value.forEach(s => {
    const tokens = (s.category || '未分类').split(/[/,，\s]+/).filter(Boolean);
    tokens.forEach(t => {
      map[t] = (map[t] || 0) + getMonthlyCost(s);
    });
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
});

const maxCatValue = computed(() => Math.max(1, ...byCategory.value.map(i => i.value)));

const sortedSubs = computed(() =>
  [...paidSubscriptions.value].sort((a, b) => getMonthlyCost(b) - getMonthlyCost(a))
);

function formatMoney(val: number): string {
  return '¥' + val.toFixed(2);
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
          <div class="summary-value">{{ paidSubscriptions.length }}</div>
          <div class="summary-label">付费订阅</div>
        </div>
      </el-card>
    </div>

    <el-row :gutter="20">
      <!-- By Type -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <span class="section-title">按类型分布</span>
          </template>
          <div v-if="byType.length === 0" class="empty-chart">暂无付费数据</div>
          <div v-else class="bar-chart">
            <div v-for="item in byType" :key="item.label" class="bar-row">
              <span class="bar-label">{{ item.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (item.value / maxTypeValue * 100) + '%' }"></div>
              </div>
              <span class="bar-value">{{ formatMoney(item.value) }}/月</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- By Category -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <span class="section-title">按分类分布</span>
          </template>
          <div v-if="byCategory.length === 0" class="empty-chart">暂无付费数据</div>
          <div v-else class="bar-chart">
            <div v-for="item in byCategory" :key="item.label" class="bar-row">
              <span class="bar-label">{{ item.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (item.value / maxCatValue * 100) + '%' }"></div>
              </div>
              <span class="bar-value">{{ formatMoney(item.value) }}/月</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Detail Table -->
    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <span class="section-title">费用明细</span>
      </template>
      <el-table :data="sortedSubs" stripe style="width: 100%">
        <el-table-column label="订阅名称" prop="name" />
        <el-table-column label="类型" prop="customType" width="140" />
        <el-table-column label="周期" width="100">
          <template #default="{ row }">
            {{ row.periodValue }}{{ row.periodUnit === 'day' ? '天' : row.periodUnit === 'year' ? '年' : '月' }}
          </template>
        </el-table-column>
        <el-table-column label="原价/周期" width="110">
          <template #default="{ row }">
            {{ row.price > 0 ? formatMoney(row.price) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="折合月费" width="110" sortable>
          <template #default="{ row }">
            <span class="money">{{ formatMoney(getMonthlyCost(row)) }}</span>
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
  width: 90px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
}

.empty-chart {
  text-align: center;
  padding: 32px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.money {
  font-weight: 600;
  color: var(--el-color-primary);
}
</style>
