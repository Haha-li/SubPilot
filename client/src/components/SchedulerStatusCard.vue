<script setup lang="ts">
import { computed } from 'vue';
import {
  Activity, AlertCircle, CheckCircle2, Clock3, Play, Radio, RefreshCw,
} from '@lucide/vue';
import type { SchedulerStatusSnapshot } from '../types/scheduler';

const props = defineProps<{
  status: SchedulerStatusSnapshot | null;
  loading: boolean;
  running: boolean;
}>();

defineEmits<{
  refresh: [];
  run: [];
}>();

const execution = computed(() => props.status?.lastExecution || null);
const outcomeLabel = computed(() => {
  if (!execution.value) return '尚未执行';
  if (execution.value.outcome === 'success') return '执行成功';
  if (execution.value.outcome === 'failed') return '执行失败';
  return '已跳过';
});
const outcomeClasses = computed(() => {
  if (execution.value?.outcome === 'success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (execution.value?.outcome === 'failed') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
});

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '暂无记录';
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: props.status?.timezone || 'Asia/Shanghai',
    hour12: false,
  });
}
</script>

<template>
  <section class="bento-card p-5" aria-labelledby="scheduler-status-title">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2.5">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300">
          <Activity :size="18" />
        </div>
        <div>
          <h3 id="scheduler-status-title" class="text-sm font-semibold text-ink-900 dark:text-ink-50">推送运行状态</h3>
          <p class="text-xs text-ink-500 dark:text-ink-400">查看调度心跳、下次计划与最近执行结果</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-ink-200 bg-white/70 text-ink-500 transition-colors duration-200 hover:bg-white hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-400 dark:hover:bg-ink-800/60"
          :disabled="loading || running"
          aria-label="刷新推送运行状态"
          title="刷新状态"
          @click="$emit('refresh')"
        >
          <RefreshCw :size="16" :class="loading && 'animate-spin'" />
        </button>
        <button
          type="button"
          class="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-colors duration-200 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="running || loading"
          title="立即按当前订阅与提醒条件执行真实推送检查"
          @click="$emit('run')"
        >
          <RefreshCw v-if="running" :size="16" class="animate-spin" />
          <Play v-else :size="16" />
          {{ running ? '检查中...' : '立即执行检查' }}
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-ink-200 bg-white/60 p-4 dark:border-ink-700/60 dark:bg-ink-900/40">
        <div class="mb-2 flex items-center gap-2 text-xs font-medium text-ink-500 dark:text-ink-400">
          <Radio :size="14" /> 平台上次触发
        </div>
        <time class="font-mono text-sm font-semibold text-ink-900 dark:text-ink-50" :datetime="status?.lastTriggerAt || undefined">
          {{ formatDateTime(status?.lastTriggerAt) }}
        </time>
      </div>

      <div class="rounded-2xl border border-ink-200 bg-white/60 p-4 dark:border-ink-700/60 dark:bg-ink-900/40">
        <div class="mb-2 flex items-center gap-2 text-xs font-medium text-ink-500 dark:text-ink-400">
          <Clock3 :size="14" /> 下次计划检查
        </div>
        <time class="font-mono text-sm font-semibold text-ink-900 dark:text-ink-50" :datetime="status?.nextRunAt || undefined">
          {{ formatDateTime(status?.nextRunAt) }}
        </time>
      </div>

      <div class="rounded-2xl border border-ink-200 bg-white/60 p-4 dark:border-ink-700/60 dark:bg-ink-900/40">
        <div class="mb-2 text-xs font-medium text-ink-500 dark:text-ink-400">最近实际执行</div>
        <div class="flex items-center gap-2">
          <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="outcomeClasses">{{ outcomeLabel }}</span>
          <span v-if="execution" class="text-xs text-ink-500 dark:text-ink-400">
            {{ execution?.source === 'manual' ? '手动' : '定时' }}
          </span>
        </div>
        <p class="mt-2 text-xs text-ink-500 dark:text-ink-400">{{ formatDateTime(execution?.completedAt) }}</p>
      </div>

      <div class="rounded-2xl border border-ink-200 bg-white/60 p-4 dark:border-ink-700/60 dark:bg-ink-900/40">
        <div class="mb-2 text-xs font-medium text-ink-500 dark:text-ink-400">检查结果</div>
        <p class="font-mono text-sm font-semibold text-ink-900 dark:text-ink-50">
          {{ execution?.checkedCount || 0 }} 检查 · {{ execution?.matchedCount || 0 }} 匹配 · {{ execution?.sentCount || 0 }} 成功
        </p>
        <p v-if="execution?.failedCount" class="mt-2 text-xs text-rose-600 dark:text-rose-300">{{ execution.failedCount }} 个订阅发送失败</p>
      </div>
    </div>

    <div
      class="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
      :class="execution?.outcome === 'failed'
        ? 'border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
        : 'border-ink-200 bg-ink-50/70 text-ink-600 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-300'"
      role="status"
      aria-live="polite"
    >
      <AlertCircle v-if="execution?.outcome === 'failed'" :size="16" class="mt-0.5 flex-shrink-0" />
      <CheckCircle2 v-else :size="16" class="mt-0.5 flex-shrink-0" />
      <span>{{ execution?.message || '尚无实际检查记录，可点击“立即执行检查”验证完整推送链路。' }}</span>
    </div>
  </section>
</template>
