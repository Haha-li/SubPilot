<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import type { Subscription } from '../stores/subscription';
import { solar2lunar } from '../utils/lunar';
import { getSymbol } from '../utils/currency';
import api from '../utils/api';
import {
  Pencil, Bell, Pause, Play, Trash2, Star, CalendarDays,
  Repeat, Tag, DollarSign, Clock, FileText, X, History,
} from '@lucide/vue';

const props = defineProps<{ subscription: Subscription }>();
const emit = defineEmits<{
  close: [];
  edit: [sub: Subscription];
  toggle: [sub: Subscription];
  delete: [sub: Subscription];
  test: [sub: Subscription];
}>();

const isMobile = useMediaQuery('(max-width: 768px)');
const drawerVisible = ref(true);
const renewalLogs = ref<any[]>([]);
const loadingRenewals = ref(false);

async function loadRenewalHistory() {
  loadingRenewals.value = true;
  try {
    const { data } = await api.get(`/renewals/${props.subscription.id}`);
    renewalLogs.value = data || [];
  } catch (e) {
    console.error('加载续费历史失败', e);
  } finally {
    loadingRenewals.value = false;
  }
}

onMounted(() => {
  loadRenewalHistory();
});

// 格式化函数与 Dashboard 同源，详情视图自带一份避免循环依赖
const unitMap: Record<string, string> = { day: '天', month: '月', year: '年' };
const priceUnitMap: Record<string, string> = { day: '/天', month: '/月', year: '/年' };

function periodLabel(unit?: string) {
  return unit ? (unitMap[unit] || unit) : '';
}
function getPeriodLabel(sub: Subscription) {
  if (!sub.periodValue) return '—';
  return `${sub.periodValue} ${periodLabel(sub.periodUnit)}`;
}
function getReminderText(sub: Subscription) {
  const v = sub.reminderValue ?? 7;
  const u = sub.reminderUnit || 'day';
  return u === 'hour' ? `${v} 小时前` : `${v} 天前`;
}
function getPriceText(sub: Subscription) {
  if (!sub.price || sub.price <= 0) return '—';
  const sym = getSymbol(sub.currency || 'CNY');
  return `${sym}${sub.price.toFixed(2)}${priceUnitMap[sub.priceUnit] || '/月'}`;
}
function getLunarText(dateStr: string) {
  const d = new Date(dateStr);
  const lunar = solar2lunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return lunar ? lunar.fullStr : '';
}
function getDaysLeft(sub: Subscription) {
  const diffMs = new Date(sub.expiryDate).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (!sub.isActive) return { text: '已停用', tone: 'muted' as const };
  if (diffDays < 0) return { text: `已过期 ${Math.abs(diffDays)} 天`, tone: 'danger' as const };
  if (diffDays === 0) return { text: '今天到期', tone: 'danger' as const };
  if (diffDays <= 7) return { text: `还剩 ${diffDays} 天`, tone: 'warning' as const };
  return { text: `还剩 ${diffDays} 天`, tone: 'success' as const };
}
function getStatusMeta(sub: Subscription) {
  if (!sub.isActive) return { label: '已停用', tone: 'muted' as const };
  const diffMs = new Date(sub.expiryDate).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const rv = sub.reminderValue ?? 7;
  const ru = sub.reminderUnit || 'day';
  const diffHours = diffMs / (1000 * 60 * 60);
  const isSoon = ru === 'hour' ? (diffHours >= 0 && diffHours <= rv) : (diffDays >= 0 && diffDays <= rv);
  if (diffDays < 0) return { label: '已过期', tone: 'danger' as const };
  if (isSoon) return { label: '即将到期', tone: 'warning' as const };
  return { label: '正常', tone: 'success' as const };
}
function brandInitial(name: string) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}
function normalizeCategoryTokens(category: string): string[] {
  return (category || '').split(/[/,，\s]+/).map((t) => t.trim()).filter(Boolean);
}

const statusMeta = computed(() => getStatusMeta(props.subscription));
const daysLeft = computed(() => getDaysLeft(props.subscription));
const lunarText = computed(() => getLunarText(props.subscription.expiryDate));
const categoryTokens = computed(() => normalizeCategoryTokens(props.subscription.category || ''));

function handleClose() {
  // 等关闭动画结束再卸载组件
  drawerVisible.value = false;
  setTimeout(() => emit('close'), 280);
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    direction="rtl"
    :size="isMobile ? '100%' : '460px'"
    :with-header="false"
    @close="handleClose"
  >
    <div class="flex h-full flex-col">
      <!-- 自定义头部 -->
      <div class="glass-panel sticky top-0 z-10 flex items-center justify-between px-5 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white shadow-md shadow-brand-500/30">
            {{ brandInitial(subscription.name) }}
          </div>
          <div class="min-w-0">
            <h3 class="truncate font-heading text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50">
              {{ subscription.name }}
            </h3>
            <p v-if="subscription.customType" class="truncate text-xs text-ink-500 dark:text-ink-400">
              {{ subscription.customType }}
            </p>
          </div>
        </div>
        <button
          class="cursor-pointer rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800/60 dark:hover:text-ink-100"
          aria-label="关闭"
          @click="handleClose"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto px-5 py-5">
        <!-- 状态条 -->
        <div class="mb-5 flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            :class="{
              'bg-success/10 text-success': statusMeta.tone === 'success',
              'bg-warning/15 text-warning': statusMeta.tone === 'warning',
              'bg-danger/10 text-danger':   statusMeta.tone === 'danger',
              'bg-ink-100 text-ink-500 dark:bg-ink-800/60 dark:text-ink-400': statusMeta.tone === 'muted',
            }"
          >
            <span class="h-1.5 w-1.5 rounded-full"
              :class="{
                'bg-success': statusMeta.tone === 'success',
                'bg-warning': statusMeta.tone === 'warning',
                'bg-danger':  statusMeta.tone === 'danger',
                'bg-ink-400': statusMeta.tone === 'muted',
              }"
            />
            {{ statusMeta.label }}
          </span>
          <span v-if="subscription.isPinned" class="inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
            <Star :size="12" :fill="'currentColor'" /> 已置顶
          </span>
          <span v-if="subscription.trialValue && subscription.trialUnit" class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            试用 {{ subscription.trialValue }}{{ periodLabel(subscription.trialUnit) }}
          </span>
        </div>

        <!-- 剩余天数大数 -->
        <div class="bento-card mb-5 p-5">
          <p class="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">到期日</p>
          <p class="font-mono-nums mt-1 text-sm text-ink-600 dark:text-ink-300">{{ subscription.expiryDate }}</p>
          <p
            class="font-mono-nums mt-1 text-3xl font-bold tabular"
            :class="{
              'text-success': daysLeft.tone === 'success',
              'text-warning': daysLeft.tone === 'warning',
              'text-danger':  daysLeft.tone === 'danger',
              'text-ink-400': daysLeft.tone === 'muted',
            }"
          >
            {{ daysLeft.text }}
          </p>
          <p v-if="lunarText" class="mt-1 text-xs text-brand-500 dark:text-brand-300">{{ lunarText }}</p>
        </div>

        <!-- 基本信息 grid -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bento-card p-4">
            <div class="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
              <CalendarDays :size="13" /> 开始日
            </div>
            <p class="font-mono-nums mt-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100">
              {{ subscription.startDate || '—' }}
            </p>
          </div>
          <div class="bento-card p-4">
            <div class="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
              <Repeat :size="13" /> 周期
            </div>
            <p class="mt-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100">
              {{ getPeriodLabel(subscription) }}<span v-if="subscription.autoRenew" class="ml-1 text-xs text-ink-400">· 自动续</span>
            </p>
          </div>
          <div class="bento-card p-4">
            <div class="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
              <Bell :size="13" /> 提醒
            </div>
            <p class="mt-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100">
              提前 {{ getReminderText(subscription) }}
            </p>
          </div>
          <div class="bento-card p-4">
            <div class="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
              <DollarSign :size="13" /> 费用
            </div>
            <p class="font-mono-nums mt-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100">
              {{ getPriceText(subscription) }}
            </p>
          </div>
        </div>

        <!-- 分类 -->
        <div v-if="categoryTokens.length" class="mt-5">
          <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500 dark:text-ink-400">
            <Tag :size="13" /> 分类
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="cat in categoryTokens"
              :key="cat"
              class="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              # {{ cat }}
            </span>
          </div>
        </div>

        <!-- 备注 -->
        <div v-if="subscription.notes" class="mt-5">
          <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500 dark:text-ink-400">
            <FileText :size="13" /> 备注
          </div>
          <div class="bento-card whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
            {{ subscription.notes }}
          </div>
        </div>

        <!-- 元信息 -->
        <div class="mt-5 space-y-1.5 text-xs text-ink-400 dark:text-ink-500">
          <p class="flex items-center gap-1.5">
            <Clock :size="12" /> 创建于 {{ subscription.createdAt || '—' }}
          </p>
          <p v-if="subscription.updatedAt" class="flex items-center gap-1.5">
            <Clock :size="12" /> 更新于 {{ subscription.updatedAt }}
          </p>
        </div>

        <!-- 续费历史 -->
        <div v-if="renewalLogs.length > 0" class="mt-5">
          <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500 dark:text-ink-400">
            <History :size="13" /> 续费历史
          </div>
          <div class="space-y-2">
            <div
              v-for="log in renewalLogs"
              :key="log.id"
              class="flex items-center justify-between rounded-lg border border-ink-200 bg-white/60 px-3 py-2 text-xs dark:border-ink-700/60 dark:bg-ink-900/40"
            >
              <div class="flex items-center gap-2">
                <span class="font-mono-nums text-ink-600 dark:text-ink-300">{{ log.renewedAt.split('T')[0] }}</span>
                <span v-if="log.price > 0" class="font-mono-nums font-semibold text-ink-900 dark:text-ink-50">
                  {{ getSymbol(log.currency) }}{{ log.price.toFixed(2) }}
                </span>
              </div>
              <span class="text-ink-400 dark:text-ink-500">
                {{ log.periodValue }}{{ ({ day: '天', month: '月', year: '年' } as Record<string, string>)[log.periodUnit] || log.periodUnit }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="border-t border-ink-200/60 px-5 py-3 dark:border-ink-700/40">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-ink-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
            @click="emit('edit', subscription)"
          >
            <Pencil :size="14" /> 编辑
          </button>
          <button
            class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:text-ink-300 dark:hover:bg-sky-500/15 dark:hover:text-sky-300"
            @click="emit('test', subscription)"
          >
            <Bell :size="14" /> 测试通知
          </button>
          <button
            class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors"
            :class="subscription.isActive
              ? 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800/60'
              : 'text-success hover:bg-success/10'"
            @click="emit('toggle', subscription)"
          >
            <component :is="subscription.isActive ? Pause : Play" :size="14" />
            {{ subscription.isActive ? '停用' : '启用' }}
          </button>
          <button
            class="ml-auto inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-danger/10 hover:text-danger dark:text-ink-300"
            @click="emit('delete', subscription)"
          >
            <Trash2 :size="14" /> 删除
          </button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>
