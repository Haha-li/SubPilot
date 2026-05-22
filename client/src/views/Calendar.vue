<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore } from '../stores/subscription';

const subStore = useSubscriptionStore();
const currentDate = ref(new Date());
const isMobile = useMediaQuery('(max-width: 768px)');
const selectedDate = ref('');

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

const selectedSubs = computed(() => {
  if (!selectedDate.value) return [];
  return getSubsForDate(selectedDate.value);
});

function getDateFromCell(td: HTMLElement): string | null {
  const dayEl = td.querySelector('.el-calendar-day');
  if (!dayEl) return null;
  const text = dayEl.textContent?.trim() || '';
  const dayNum = parseInt(text);
  if (isNaN(dayNum)) return null;

  const classes = td.className || '';
  let date: Date;
  if (classes.includes('prev')) {
    date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, dayNum);
  } else if (classes.includes('next')) {
    date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, dayNum);
  } else {
    date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), dayNum);
  }
  return date.toISOString().split('T')[0];
}

function renderCalendarCells() {
  nextTick(() => {
    const cells = document.querySelectorAll('.el-calendar-table td');
    cells.forEach((td) => {
      const dayEl = td.querySelector('.el-calendar-day');
      if (!dayEl) return;

      // Remove old injected content
      dayEl.querySelectorAll('.cal-subs-injected').forEach(el => el.remove());
      dayEl.querySelectorAll('.cal-dots').forEach(el => el.remove());

      const dateStr = getDateFromCell(td as HTMLElement);
      if (!dateStr) return;
      const subs = getSubsForDate(dateStr);
      if (subs.length === 0) return;

      if (isMobile.value) {
        // Mobile: show small dots
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'cal-dots';
        subs.forEach(sub => {
          const dot = document.createElement('span');
          dot.className = sub.isExpiry ? 'cal-dot cal-dot-danger' : 'cal-dot cal-dot-warning';
          dotsWrap.appendChild(dot);
        });
        dayEl.appendChild(dotsWrap);

        // Click handler to show detail below
        (td as HTMLElement).style.cursor = 'pointer';
        td.addEventListener('click', () => {
          selectedDate.value = selectedDate.value === dateStr ? '' : dateStr;
        });
      } else {
        // Desktop: show full tags
        const container = document.createElement('div');
        container.className = 'cal-subs-injected';
        subs.forEach(sub => {
          const tag = document.createElement('span');
          tag.className = sub.isExpiry ? 'cal-tag cal-tag-danger' : 'cal-tag cal-tag-warning';
          const icon = sub.isExpiry ? '● ' : '◆ ';
          tag.textContent = icon + sub.name;
          tag.title = sub.isExpiry ? `${sub.name} - 今日到期` : `${sub.name} - 即将到期`;
          container.appendChild(tag);
        });
        dayEl.appendChild(container);
      }
    });
  });
}

onMounted(() => {
  subStore.fetchSubscriptions().then(renderCalendarCells);
});

watch(currentDate, () => {
  selectedDate.value = '';
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
      <p class="page-subtitle">
        <template v-if="isMobile">点击有标记的日期查看详情</template>
        <template v-else>按日历视图查看订阅到期日期（<span style="color:var(--el-color-danger)">● 到期</span> = 当日到期　<span style="color:var(--el-color-warning)">◆ 提醒</span> = 提前提醒）</template>
      </p>
    </div>

    <el-card shadow="never">
      <el-calendar v-model="currentDate" />
    </el-card>

    <!-- Mobile detail panel -->
    <transition name="el-fade-in">
      <el-card v-if="isMobile && selectedDate && selectedSubs.length > 0" shadow="never" class="detail-card">
        <div class="detail-header">
          <span class="detail-date">{{ selectedDate }}</span>
          <el-button text size="small" @click="selectedDate = ''">关闭</el-button>
        </div>
        <div
          v-for="sub in selectedSubs"
          :key="sub.name"
          class="detail-item"
        >
          <span class="detail-dot" :class="sub.isExpiry ? 'cal-dot-danger' : 'cal-dot-warning'" />
          <span class="detail-name">{{ sub.name }}</span>
          <el-tag size="small" :type="sub.isExpiry ? 'danger' : 'warning'" effect="light">
            {{ sub.isExpiry ? '今日到期' : '即将到期' }}
          </el-tag>
        </div>
      </el-card>
    </transition>
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

.detail-card {
  margin-top: 16px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.detail-date {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.detail-name {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
</style>

<style>
.cal-subs-injected {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  max-height: 56px;
  overflow-y: auto;
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

/* Mobile dots */
.cal-dots {
  display: flex;
  gap: 3px;
  justify-content: center;
  margin-top: 4px;
}

.cal-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cal-dot-danger {
  background-color: var(--el-color-danger, #f56c6c);
}

.cal-dot-warning {
  background-color: var(--el-color-warning, #e6a23c);
}

@media (max-width: 768px) {
  .el-calendar-table td {
    height: auto !important;
  }
  .el-calendar-day {
    min-height: 44px !important;
    padding: 2px 4px !important;
  }
}
</style>
