<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import {
  CalendarDays, CircleDollarSign, Clock, Copy, CreditCard, Pencil, ReceiptText, X,
} from '@lucide/vue';
import { useSubscriptionStore } from '../stores/subscription';
import {
  type SubscriptionMethod,
  type SubscriptionMethodLog,
  useSubscriptionMethodStore,
} from '../stores/subscriptionMethod';
import { useSystemConfigStore } from '../stores/systemConfig';
import { getSymbol } from '../utils/currency';
import { getDateOnlyInTimeZone } from '../utils/dateOnly';
import { buildSubscriptionMethodForecast } from '../utils/subscriptionMethodForecast';
import { getEstimatedRenewalCostInCurrency } from '../utils/renewalCenter';
import type { Subscription } from '../stores/subscription';

const props = defineProps<{ method: SubscriptionMethod }>();
const emit = defineEmits<{
  close: [];
  edit: [method: SubscriptionMethod];
  copy: [method: SubscriptionMethod];
  adjust: [method: SubscriptionMethod];
}>();
const methodStore = useSubscriptionMethodStore();
const subscriptionStore = useSubscriptionStore();
const systemConfigStore = useSystemConfigStore();
const isMobile = useMediaQuery('(max-width: 768px)');
const drawerVisible = ref(true);
const logs = ref<SubscriptionMethodLog[]>([]);
const loadingLogs = ref(false);

const linkedSubscriptions = computed(() => subscriptionStore.subscriptions
  .filter((item) => item.subscriptionMethodId === props.method.id)
  .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate)));
const forecast = computed(() => buildSubscriptionMethodForecast(
  props.method,
  linkedSubscriptions.value,
  getDateOnlyInTimeZone(new Date(), systemConfigStore.timezone),
));

function money(value: number, currency = props.method.balanceCurrency || 'CNY') {
  return `${getSymbol(currency)}${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function balanceText() {
  return props.method.balance === null || props.method.balance === undefined
    ? '未记录'
    : money(props.method.balance);
}

function monthsText() {
  if (forecast.value.monthsLeft === null) return forecast.value.status === 'unrecorded' ? '未记录余额' : '暂无扣款';
  const months = Math.floor(forecast.value.monthsLeft * 10) / 10;
  return `${Number.isInteger(months) ? months : months.toFixed(1)} 个月`;
}

function nextEvent(subscriptionId: number) {
  return forecast.value.events.find((event) => event.subscriptionId === subscriptionId);
}

function ownChargeText(subscription: Subscription): string {
  const currency = (subscription.currency || 'CNY').toUpperCase();
  const amount = getEstimatedRenewalCostInCurrency(subscription, currency);
  return Number.isFinite(amount) && amount > 0 ? money(amount, currency) : '';
}

function logType(type: SubscriptionMethodLog['type']) {
  return {
    initial: '初始余额',
    manual_adjustment: '手动调整',
    manual_renewal: '手动续费',
    automatic_renewal: '自动续费',
  }[type];
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: systemConfigStore.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
}

function close() {
  drawerVisible.value = false;
  setTimeout(() => emit('close'), 280);
}

watch(() => props.method.id, async (id) => {
  loadingLogs.value = true;
  try {
    logs.value = await methodStore.fetchLogs(id);
  } catch {
    logs.value = [];
  } finally {
    loadingLogs.value = false;
  }
}, { immediate: true });
</script>

<template>
  <el-drawer v-model="drawerVisible" :size="isMobile ? '100%' : '520px'" :with-header="false" @close="close">
    <div class="flex h-full flex-col">
      <header class="glass-panel sticky top-0 z-10 flex items-center justify-between px-5 py-4">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <CreditCard :size="21" />
          </div>
          <div class="min-w-0">
            <h3 class="truncate font-heading text-lg font-bold text-ink-900 dark:text-ink-50">{{ method.name }}</h3>
            <p class="truncate text-xs text-ink-500 dark:text-ink-400">{{ [method.channel, method.paymentMethod].filter(Boolean).join(' · ') || '订阅方式详情' }}</p>
          </div>
        </div>
        <button class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/60" aria-label="关闭" @click="close">
          <X :size="19" />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-5 py-5">
        <section class="grid grid-cols-2 gap-3">
          <div class="bento-card p-4">
            <p class="text-xs text-ink-500 dark:text-ink-400">当前余额</p>
            <p class="font-mono-nums mt-1 text-xl font-bold text-ink-900 dark:text-ink-50">{{ balanceText() }}</p>
          </div>
          <div class="bento-card p-4">
            <p class="text-xs text-ink-500 dark:text-ink-400">预计可用</p>
            <p class="font-mono-nums mt-1 text-xl font-bold text-ink-900 dark:text-ink-50">{{ monthsText() }}</p>
          </div>
          <div class="bento-card p-4">
            <p class="text-xs text-ink-500 dark:text-ink-400">下次扣款</p>
            <p class="font-mono-nums mt-1 text-sm font-bold text-ink-900 dark:text-ink-50">{{ forecast.nextChargeDate || '暂无' }}</p>
            <p v-if="forecast.nextChargeDate" class="mt-1 text-xs text-ink-500">{{ money(forecast.nextChargeAmount) }}</p>
          </div>
          <div class="bento-card p-4">
            <p class="text-xs text-ink-500 dark:text-ink-400">预计用完</p>
            <p class="font-mono-nums mt-1 text-sm font-bold text-ink-900 dark:text-ink-50">{{ forecast.exhaustionDate || '暂无' }}</p>
            <p v-if="forecast.mismatchCount" class="mt-1 text-xs text-ink-400">{{ forecast.mismatchCount }} 个按当天汇率折算</p>
          </div>
        </section>

        <section class="mt-5">
          <h4 class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
            <CalendarDays :size="14" /> 关联订阅
          </h4>
          <div v-if="linkedSubscriptions.length" class="space-y-2">
            <div v-for="subscription in linkedSubscriptions" :key="subscription.id" class="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-700/60 dark:bg-ink-900/35">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{{ subscription.name }}</p>
                  <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">{{ subscription.expiryDate }} · {{ subscription.isActive ? '启用' : '停用' }}</p>
                </div>
                <div class="flex-shrink-0 text-right text-xs">
                  <template v-if="ownChargeText(subscription) && subscription.autoRenew">
                    <p class="font-mono-nums font-semibold text-ink-800 dark:text-ink-100">{{ ownChargeText(subscription) }}</p>
                    <p v-if="nextEvent(subscription.id)" class="mt-1 text-ink-400">{{ nextEvent(subscription.id)!.date }}</p>
                    <p v-else class="mt-1 text-warning">汇率缺失，暂不计入</p>
                  </template>
                  <span v-else-if="subscription.isActive && !subscription.autoRenew" class="text-ink-400">不自动续费</span>
                  <span v-else-if="subscription.isActive" class="text-ink-400">免费</span>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="rounded-xl bg-ink-50/70 p-4 text-sm text-ink-500 dark:bg-ink-800/30 dark:text-ink-400">暂无关联订阅</p>
        </section>

        <section class="mt-5">
          <h4 class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
            <ReceiptText :size="14" /> 余额流水
          </h4>
          <div v-loading="loadingLogs" class="min-h-16 space-y-2">
            <div v-for="log in logs" :key="log.id" class="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-700/60 dark:bg-ink-900/35">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink-800 dark:text-ink-100">{{ logType(log.type) }}<span v-if="log.subscriptionName"> · {{ log.subscriptionName }}</span></p>
                  <p class="mt-1 text-xs text-ink-400"><Clock :size="11" class="mr-1 inline" />{{ formatTime(log.createdAt) }}</p>
                </div>
                <p class="font-mono-nums flex-shrink-0 text-sm font-bold" :class="log.amount >= 0 ? 'text-success' : 'text-danger'">
                  {{ log.amount >= 0 ? '+' : '' }}{{ money(log.amount) }}
                </p>
              </div>
              <p class="font-mono-nums mt-2 text-xs text-ink-500 dark:text-ink-400">{{ money(log.beforeBalance) }} → {{ money(log.afterBalance) }}</p>
              <p v-if="log.note" class="mt-1 text-xs text-ink-500 dark:text-ink-400">{{ log.note }}</p>
            </div>
            <p v-if="!loadingLogs && logs.length === 0" class="rounded-xl bg-ink-50/70 p-4 text-sm text-ink-500 dark:bg-ink-800/30 dark:text-ink-400">暂无余额流水</p>
          </div>
        </section>
      </div>

      <footer class="border-t border-ink-200/60 px-5 py-3 dark:border-ink-700/40">
        <div class="flex flex-wrap justify-end gap-1">
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-success hover:bg-success/10" @click="emit('adjust', method)"><CircleDollarSign :size="15" /> 调整余额</button>
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-ink-600 hover:bg-amber-50 hover:text-amber-600 dark:text-ink-300 dark:hover:bg-amber-500/15" @click="emit('copy', method)"><Copy :size="15" /> 复制</button>
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-ink-600 hover:bg-brand-50 hover:text-brand-600 dark:text-ink-300 dark:hover:bg-brand-500/15" @click="emit('edit', method)"><Pencil :size="15" /> 编辑</button>
        </div>
      </footer>
    </div>
  </el-drawer>
</template>
