<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubscriptionStore } from '../stores/subscription';

const subStore = useSubscriptionStore();
const currentDate = ref(new Date());

const activeSubscriptions = computed(() => subStore.subscriptions.filter(s => s.isActive));

function getSubsForDate(date: Date): { name: string; type: string }[] {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  return activeSubscriptions.value
    .filter(s => s.expiryDate === dateStr)
    .map(s => ({ name: s.name, type: s.customType || '' }));
}

function getCellStyle(data: { isSelected: boolean; type: string }) {
  if (data.type === 'current') return {};
  return {};
}

onMounted(() => {
  if (subStore.subscriptions.length === 0) subStore.fetchSubscriptions();
});
</script>

<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">订阅日历</h2>
      <p class="page-subtitle">按日历视图查看订阅到期日期</p>
    </div>

    <el-card shadow="never">
      <el-calendar v-model="currentDate">
        <template #dateCell="{ data }">
          <div class="cal-cell" :class="{ 'is-other': data.type !== 'current' }">
            <span class="cal-day">{{ data.day.split('-')[2] }}</span>
            <div class="cal-subs">
              <div
                v-for="sub in getSubsForDate(new Date(data.date))"
                :key="sub.name"
                class="cal-sub-item"
              >
                <el-tag size="small" effect="light" type="danger">{{ sub.name }}</el-tag>
              </div>
            </div>
          </div>
        </template>
      </el-calendar>
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

.cal-cell {
  min-height: 72px;
  display: flex;
  flex-direction: column;
}

.cal-cell.is-other {
  opacity: 0.4;
}

.cal-day {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.cal-subs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.cal-sub-item :deep(.el-tag) {
  font-size: 11px;
  height: 20px;
  padding: 0 6px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
