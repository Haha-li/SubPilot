<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useSubscriptionStore } from '../stores/subscription';

const subStore = useSubscriptionStore();
const currentDate = ref(new Date());

const activeSubscriptions = computed(() => subStore.subscriptions.filter(s => s.isActive));

function getSubsForDate(dateStr: string): { name: string; isExpiry: boolean }[] {
  return activeSubscriptions.value
    .filter(s => {
      if (s.expiryDate === dateStr) return true;
      const cellTime = new Date(dateStr).getTime();
      const expiryTime = new Date(s.expiryDate).getTime();
      const diffDays = Math.ceil((expiryTime - cellTime) / (1000 * 60 * 60 * 24));
      const reminderDays = s.reminderUnit === 'day' ? (s.reminderValue ?? 7) : 0;
      return diffDays > 0 && diffDays <= reminderDays;
    })
    .map(s => ({
      name: s.name,
      isExpiry: s.expiryDate === dateStr,
    }));
}

function renderCalendarCells() {
  nextTick(() => {
    const cells = document.querySelectorAll('.el-calendar-table td');
    cells.forEach((td) => {
      const dayEl = td.querySelector('.el-calendar-day')
      if (!dayEl) return;

      // Remove old injected tags
      dayEl.querySelectorAll('.cal-subs-injected').forEach(el => el.remove());

      // Get date from the cell's text content and current calendar month
      const text = dayEl.textContent?.trim() || '';
      const dayNum = parseInt(text);
      if (isNaN(dayNum)) return;

      // Determine which month this cell belongs to
      const classes = (td as HTMLElement).className || '';
      let date: Date;
      if (classes.includes('prev')) {
        date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, dayNum);
      } else if (classes.includes('next')) {
        date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, dayNum);
      } else {
        date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), dayNum);
      }

      const dateStr = date.toISOString().split('T')[0];
      const subs = getSubsForDate(dateStr);
      if (subs.length === 0) return;

      const container = document.createElement('div');
      container.className = 'cal-subs-injected';
      subs.forEach(sub => {
        const tag = document.createElement('span');
        tag.className = sub.isExpiry ? 'cal-tag cal-tag-danger' : 'cal-tag cal-tag-warning';
        const dot = sub.isExpiry ? '● ' : '◆ ';
        tag.textContent = dot + sub.name;
        tag.title = sub.isExpiry ? `${sub.name} - 今日到期` : `${sub.name} - 即将到期`;
        container.appendChild(tag);
      });
      dayEl.appendChild(container);
    });
  });
}

onMounted(() => {
  subStore.fetchSubscriptions().then(renderCalendarCells);
});

watch(currentDate, () => {
  renderCalendarCells();
});

watch(() => subStore.subscriptions, () => {
  renderCalendarCells();
});
</script>

<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">订阅日历</h2>
      <p class="page-subtitle">按日历视图查看订阅到期日期（<span style="color:var(--el-color-danger)">● 到期</span> = 当日到期　<span style="color:var(--el-color-warning)">◆ 提醒</span> = 提前提醒）</p>
    </div>

    <el-card shadow="never">
      <el-calendar v-model="currentDate" />
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
</style>

<style>
.cal-subs-injected {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.cal-tag {
  display: block;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-top: 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-tag-danger {
  background-color: var(--el-color-danger-light-9, #fef0f0);
  color: var(--el-color-danger, #f56c6c);
  border: 1px solid var(--el-color-danger-light-7, #fac8c8);
}

.cal-tag-warning {
  background-color: var(--el-color-warning-light-9, #fdf6ec);
  color: var(--el-color-warning, #e6a23c);
  border: 1px solid var(--el-color-warning-light-7, #f5dab1);
}
</style>
