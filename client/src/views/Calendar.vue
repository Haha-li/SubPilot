<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { ChevronLeft, ChevronRight, CalendarDays, Circle, Dot, X } from '@lucide/vue';

const subStore = useSubscriptionStore();
const isMobile = useMediaQuery('(max-width: 768px)');

const today = new Date();
const todayStr = toDateStr(today);

const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const selectedDate = ref<string>('');

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const activeSubscriptions = computed(() =>
  subStore.subscriptions.filter((s) => s.isActive),
);

type Mark = { name: string; isExpiry: boolean; sub: Subscription };

function getSubsForDate(dateStr: string): Mark[] {
  return activeSubscriptions.value
    .filter((s) => {
      if (s.expiryDate === dateStr) return true;
      const cellTime = new Date(dateStr).getTime();
      const expiryTime = new Date(s.expiryDate).getTime();
      const diffDays = Math.ceil((expiryTime - cellTime) / (1000 * 60 * 60 * 24));
      const reminderDays = s.reminderUnit === 'day' ? (s.reminderValue ?? 7) : 0;
      return diffDays > 0 && diffDays <= reminderDays;
    })
    .map((s) => ({ name: s.name, isExpiry: s.expiryDate === dateStr, sub: s }));
}

type Cell = {
  date: Date;
  dateStr: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  marks: Mark[];
};

const calendarGrid = computed<Cell[]>(() => {
  const year = cursor.value.getFullYear();
  const month = cursor.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const cells: Cell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    const dateStr = toDateStr(d);
    cells.push({
      date: d,
      dateStr,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: dateStr === todayStr,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      marks: getSubsForDate(dateStr),
    });
  }
  return cells;
});

const monthLabel = computed(
  () => `${cursor.value.getFullYear()} 年 ${cursor.value.getMonth() + 1} 月`,
);

const monthSummary = computed(() => {
  const year = cursor.value.getFullYear();
  const month = cursor.value.getMonth();
  let expiry = 0;
  let reminder = 0;
  calendarGrid.value
    .filter((c) => c.inMonth)
    .forEach((c) => {
      c.marks.forEach((m) => {
        if (m.isExpiry) expiry++;
        else reminder++;
      });
    });
  return { year, month: month + 1, expiry, reminder };
});

const selectedSubs = computed<Mark[]>(() =>
  selectedDate.value ? getSubsForDate(selectedDate.value) : [],
);

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1);
  selectedDate.value = '';
}

function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1);
  selectedDate.value = '';
}

function goToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate.value = todayStr;
}

function selectCell(cell: Cell) {
  if (!cell.inMonth) {
    cursor.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1);
  }
  selectedDate.value = selectedDate.value === cell.dateStr ? '' : cell.dateStr;
}

onMounted(() => {
  if (subStore.subscriptions.length === 0) subStore.fetchSubscriptions();
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">订阅日历</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">
          点击有标记的日期查看详情
          <span class="ml-2 hidden md:inline-flex items-center gap-1.5 text-xs">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-danger" /> 当日到期
            <span class="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-warning" /> 提前提醒
          </span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-ink-200 bg-white/70 px-3 text-sm font-medium text-ink-700 backdrop-blur transition-colors hover:bg-white hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200 dark:hover:bg-ink-800/70"
          @click="goToday"
        >
          <CalendarDays :size="16" />
          今天
        </button>
        <button
          class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-ink-200 bg-white/70 text-ink-700 transition-colors hover:bg-white hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200"
          aria-label="上一月"
          @click="prevMonth"
        >
          <ChevronLeft :size="18" />
        </button>
        <span class="font-heading min-w-[8rem] text-center text-base font-bold text-ink-900 dark:text-ink-50">{{ monthLabel }}</span>
        <button
          class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-ink-200 bg-white/70 text-ink-700 transition-colors hover:bg-white hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200"
          aria-label="下一月"
          @click="nextMonth"
        >
          <ChevronRight :size="18" />
        </button>
      </div>
    </div>

    <!-- Summary strip -->
    <div class="mb-5 flex flex-wrap items-center gap-2 text-xs">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 font-medium text-danger">
        <Circle :size="10" fill="currentColor" :stroke-width="0" />
        本月到期 <span class="font-mono-nums font-bold">{{ monthSummary.expiry }}</span>
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 font-medium text-warning">
        <Circle :size="10" fill="currentColor" :stroke-width="0" />
        本月提醒 <span class="font-mono-nums font-bold">{{ monthSummary.reminder }}</span>
      </span>
    </div>

    <!-- Calendar grid -->
    <section class="bento-card overflow-hidden">
      <!-- Weekday header -->
      <div class="grid grid-cols-7 border-b border-ink-100 dark:border-ink-800/60">
        <div
          v-for="(d, i) in weekdayLabels"
          :key="d"
          class="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide"
          :class="i === 0 || i === 6 ? 'text-ink-400 dark:text-ink-500' : 'text-ink-500 dark:text-ink-400'"
        >
          {{ d }}
        </div>
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-7">
        <button
          v-for="cell in calendarGrid"
          :key="cell.dateStr"
          class="relative flex flex-col gap-1 border-b border-r border-ink-100 px-2 py-2 text-left transition-colors duration-150 dark:border-ink-800/60"
          :class="[
            cell.inMonth
              ? 'bg-white/40 hover:bg-brand-50/70 dark:bg-transparent dark:hover:bg-brand-500/10'
              : 'bg-ink-50/40 text-ink-300 hover:bg-ink-100/50 dark:bg-ink-900/20 dark:text-ink-600 dark:hover:bg-ink-800/30',
            cell.marks.length > 0 ? 'cursor-pointer' : 'cursor-default',
            selectedDate === cell.dateStr && 'ring-2 ring-inset ring-brand-500 dark:ring-brand-400',
            isMobile ? 'min-h-[60px]' : 'min-h-[96px]',
          ]"
          @click="selectCell(cell)"
        >
          <!-- Day number -->
          <div class="flex items-center justify-between">
            <span
              class="font-mono-nums inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium"
              :class="[
                cell.isToday
                  ? 'bg-brand-500 text-white shadow-sm'
                  : cell.inMonth
                    ? cell.isWeekend ? 'text-ink-500 dark:text-ink-400' : 'text-ink-800 dark:text-ink-100'
                    : 'text-ink-300 dark:text-ink-600',
              ]"
            >
              {{ cell.day }}
            </span>
            <span
              v-if="!isMobile && cell.marks.length > 2"
              class="font-mono-nums rounded-full bg-ink-100 px-1.5 text-[10px] font-semibold text-ink-500 dark:bg-ink-800/60 dark:text-ink-400"
            >
              +{{ cell.marks.length }}
            </span>
          </div>

          <!-- Marks: dots on mobile, tags on desktop -->
          <template v-if="cell.marks.length > 0">
            <div v-if="isMobile" class="flex flex-wrap gap-1">
              <span
                v-for="(m, mi) in cell.marks.slice(0, 4)"
                :key="mi"
                class="h-1.5 w-1.5 rounded-full"
                :class="m.isExpiry ? 'bg-danger' : 'bg-warning'"
              />
              <Dot v-if="cell.marks.length > 4" :size="10" class="text-ink-400" />
            </div>
            <div v-else class="flex flex-col gap-0.5">
              <span
                v-for="(m, mi) in cell.marks.slice(0, 2)"
                :key="mi"
                class="truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                :class="m.isExpiry
                  ? 'bg-danger/10 text-danger'
                  : 'bg-warning/15 text-warning'"
                :title="m.name"
              >
                <span class="mr-0.5">{{ m.isExpiry ? '●' : '◆' }}</span>{{ m.name }}
              </span>
            </div>
          </template>
        </button>
      </div>
    </section>

    <!-- Date detail (mobile drawer / desktop inline) -->
    <transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2"
    >
      <section
        v-if="selectedDate && selectedSubs.length > 0"
        class="bento-card mt-4 p-5"
      >
        <header class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <CalendarDays :size="18" />
            </div>
            <div>
              <p class="font-mono-nums text-sm text-ink-500 dark:text-ink-400">{{ selectedDate }}</p>
              <p class="text-base font-semibold text-ink-900 dark:text-ink-50">该日 {{ selectedSubs.length }} 项订阅</p>
            </div>
          </div>
          <button
            class="cursor-pointer rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
            aria-label="关闭"
            @click="selectedDate = ''"
          >
            <X :size="18" />
          </button>
        </header>

        <ul class="divide-y divide-ink-100 dark:divide-ink-800/50">
          <li
            v-for="m in selectedSubs"
            :key="m.sub.id"
            class="flex items-center gap-3 py-2.5"
          >
            <span
              class="h-2 w-2 flex-shrink-0 rounded-full"
              :class="m.isExpiry ? 'bg-danger' : 'bg-warning'"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{{ m.sub.name }}</p>
              <p v-if="m.sub.customType" class="truncate text-xs text-ink-500 dark:text-ink-400">{{ m.sub.customType }}</p>
            </div>
            <span
              class="rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="m.isExpiry
                ? 'bg-danger/10 text-danger'
                : 'bg-warning/15 text-warning'"
            >
              {{ m.isExpiry ? '今日到期' : '即将到期' }}
            </span>
          </li>
        </ul>
      </section>
    </transition>
  </div>
</template>
