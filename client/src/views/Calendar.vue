<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubscriptionStore } from '../stores/subscription';

const subStore = useSubscriptionStore();
const currentDate = ref(new Date());

const activeSubscriptions = computed(() => subStore.subscriptions.filter(s => s.isActive));

function getSubsForDate(dateStr: string): { name: string; type: string; isExpiry: boolean }[] {
  return activeSubscriptions.value
    .filter(s => {
      if (s.expiryDate === dateStr) return true;
      // Also show if this date is within reminder window and before expiry
      const cellTime = new Date(dateStr).getTime();
      const expiryTime = new Date(s.expiryDate).getTime();
      const diffDays = Math.ceil((expiryTime - cellTime) / (1000 * 60 * 60 * 24));
      const reminderDays = s.reminderUnit === 'day' ? (s.reminderValue ?? 7) : 0;
      return diffDays > 0 && diffDays <= reminderDays;
    })
    .map(s => ({
      name: s.name,
      type: s.customType || '',
      isExpiry: s.expiryDate === dateStr,
    }));
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
                v-for="sub in getSubsForDate(data.day)"
                :key="sub.name"
                class="cal-sub-item"
              >
                <el-tag size="small" effect="light" :type="sub.isExpiry ? 'danger' : 'warning'">{{ sub.name }}</el-tag>
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
