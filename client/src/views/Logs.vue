<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useNotifyLogsStore, type NotifyLog } from '../stores/notifyLogs';
import { useSubscriptionStore } from '../stores/subscription';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
  Trash2, Send, CheckCircle2, XCircle, FileText, Filter, Inbox, X as XIcon,
} from '@lucide/vue';

const logsStore = useNotifyLogsStore();
const subStore = useSubscriptionStore();
const isMobile = useMediaQuery('(max-width: 768px)');

const subscriptionId = ref('');
const channel = ref('');
const status = ref('');
const startDate = ref('');
const endDate = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

const detailVisible = ref(false);
const detailLog = ref<NotifyLog | null>(null);

const channelMap: Record<string, string> = {
  telegram: 'Telegram',
  wechat: '企业微信',
  bark: 'Bark',
  webhook: 'Webhook',
  email: '邮件',
  notifyx: 'NotifyX',
  pushplus: 'PushPlus',
};

const channelTone: Record<string, string> = {
  telegram: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  wechat:   'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  bark:     'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  webhook:  'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  email:    'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  notifyx:  'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300',
  pushplus: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
};

async function fetchLogs() {
  const params: Record<string, any> = {
    page: currentPage.value,
    pageSize: pageSize.value,
  };
  if (subscriptionId.value) params.subscriptionId = subscriptionId.value;
  if (channel.value) params.channel = channel.value;
  if (status.value) params.status = status.value;
  if (startDate.value) params.startDate = startDate.value;
  if (endDate.value) params.endDate = endDate.value;
  await logsStore.fetchLogs(params);
}

function handlePageChange() {
  fetchLogs();
}

function handlePageSizeChange() {
  currentPage.value = 1;
  fetchLogs();
}

function handleFilterChange() {
  currentPage.value = 1;
  fetchLogs();
}

async function handleClear() {
  try {
    await ElMessageBox.confirm('确定清空所有通知日志？此操作不可撤销。', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await logsStore.clearLogs();
    ElMessage.success('日志已清空');
  } catch {}
}

function showDetail(log: NotifyLog) {
  detailLog.value = log;
  detailVisible.value = true;
}

function formatTime(val: string | null): string {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

onMounted(() => {
  fetchLogs();
  if (subStore.subscriptions.length === 0) {
    subStore.fetchSubscriptions();
  }
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">通知日志</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">查看通知发送记录与失败原因</p>
      </div>
      <button
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        @click="handleClear"
      >
        <Trash2 :size="16" />
        清空日志
      </button>
    </div>

    <!-- Filters -->
    <div class="bento-card mb-5 p-4">
      <div class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
        <Filter :size="14" />
        筛选
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div class="md:col-span-3">
          <el-select v-model="subscriptionId" placeholder="全部订阅" clearable class="w-full" @change="handleFilterChange">
            <el-option v-for="sub in subStore.subscriptions" :key="sub.id" :label="sub.name" :value="String(sub.id)" />
          </el-select>
        </div>
        <div class="md:col-span-2">
          <el-select v-model="channel" placeholder="全部渠道" clearable class="w-full" @change="handleFilterChange">
            <el-option label="Telegram" value="telegram" />
            <el-option label="企业微信" value="wechat" />
            <el-option label="Bark" value="bark" />
            <el-option label="Webhook" value="webhook" />
            <el-option label="邮件" value="email" />
            <el-option label="NotifyX" value="notifyx" />
            <el-option label="PushPlus" value="pushplus" />
          </el-select>
        </div>
        <div class="md:col-span-2">
          <el-select v-model="status" placeholder="全部状态" clearable class="w-full" @change="handleFilterChange">
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
          </el-select>
        </div>
        <div class="md:col-span-2">
          <el-date-picker
            v-model="startDate"
            type="date"
            placeholder="开始日期"
            value-format="YYYY-MM-DD"
            class="w-full"
            @change="handleFilterChange"
          />
        </div>
        <div class="md:col-span-3">
          <el-date-picker
            v-model="endDate"
            type="date"
            placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="w-full"
            @change="handleFilterChange"
          />
        </div>
      </div>
    </div>

    <!-- Logs list (cards on mobile, table on desktop) -->
    <section class="bento-card overflow-hidden p-0">
      <!-- Mobile cards -->
      <div v-if="isMobile" class="divide-y divide-ink-100 dark:divide-ink-800/50">
        <div
          v-if="logsStore.logs.length === 0 && !logsStore.loading"
          class="flex flex-col items-center px-6 py-16 text-center"
        >
          <Inbox :size="32" class="text-ink-300 dark:text-ink-600" />
          <p class="mt-3 text-sm text-ink-500 dark:text-ink-400">暂无日志</p>
        </div>
        <article
          v-for="log in logsStore.logs"
          :key="log.id"
          class="cursor-pointer p-4 transition-colors hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
          @click="showDetail(log)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{{ log.subscriptionName }}</p>
              <p class="font-mono-nums mt-0.5 text-xs text-ink-500 dark:text-ink-400">{{ formatTime(log.createdAt) }}</p>
            </div>
            <span
              class="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="log.status === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'"
            >
              <component :is="log.status === 'success' ? CheckCircle2 : XCircle" :size="12" />
              {{ log.status === 'success' ? '成功' : '失败' }}
            </span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <span
              class="rounded-md px-2 py-0.5 text-xs font-medium"
              :class="channelTone[log.channel] || 'bg-ink-100 text-ink-600'"
            >
              {{ channelMap[log.channel] || log.channel }}
            </span>
            <p v-if="log.message" class="line-clamp-1 flex-1 text-xs text-ink-500 dark:text-ink-400">{{ log.message }}</p>
          </div>
        </article>
      </div>

      <!-- Desktop table -->
      <div v-else class="overflow-x-auto">
        <el-table
          :data="logsStore.logs"
          v-loading="logsStore.loading"
          stripe
          style="width: 100%"
          :empty-text="' '"
        >
          <el-table-column label="订阅" prop="subscriptionName" min-width="140">
            <template #default="{ row }">
              <span class="font-medium text-ink-900 dark:text-ink-50">{{ row.subscriptionName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="渠道" min-width="100">
            <template #default="{ row }">
              <span
                class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                :class="channelTone[row.channel] || 'bg-ink-100 text-ink-600 dark:bg-ink-800/60 dark:text-ink-300'"
              >
                <Send :size="11" />
                {{ channelMap[row.channel] || row.channel }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="90">
            <template #default="{ row }">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="row.status === 'success'
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'"
              >
                <component :is="row.status === 'success' ? CheckCircle2 : XCircle" :size="12" />
                {{ row.status === 'success' ? '成功' : '失败' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="消息" prop="message" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="text-sm text-ink-600 dark:text-ink-300">{{ row.message || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">
              <span class="font-mono-nums text-xs text-ink-500 dark:text-ink-400">{{ formatTime(row.createdAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="80" align="center">
            <template #default="{ row }">
              <button
                class="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
                @click="showDetail(row)"
              >
                <FileText :size="13" />
                详情
              </button>
            </template>
          </el-table-column>

          <template #empty>
            <div class="flex flex-col items-center px-6 py-12 text-center">
              <Inbox :size="32" class="text-ink-300 dark:text-ink-600" />
              <p class="mt-3 text-sm text-ink-500 dark:text-ink-400">暂无日志</p>
            </div>
          </template>
        </el-table>
      </div>

      <div v-if="logsStore.total > pageSize" class="flex justify-end p-4">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="logsStore.total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="isMobile ? 'total, prev, next' : 'total, sizes, prev, pager, next'"
          :small="isMobile"
          background
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      :width="isMobile ? '95%' : '600px'"
      :show-close="false"
      class="log-detail-dialog"
      @close="detailLog = null"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <FileText :size="18" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-ink-900 dark:text-ink-50">通知详情</h3>
              <p v-if="detailLog" class="font-mono-nums text-xs text-ink-500 dark:text-ink-400">{{ formatTime(detailLog.createdAt) }}</p>
            </div>
          </div>
          <button
            class="cursor-pointer rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
            aria-label="关闭"
            @click="detailVisible = false"
          >
            <XIcon :size="18" />
          </button>
        </div>
      </template>

      <div v-if="detailLog" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/40">
            <p class="text-xs font-medium uppercase tracking-wide text-ink-400">订阅</p>
            <p class="mt-1 truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{{ detailLog.subscriptionName }}</p>
          </div>
          <div class="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/40">
            <p class="text-xs font-medium uppercase tracking-wide text-ink-400">渠道</p>
            <p class="mt-1 text-sm font-semibold text-ink-900 dark:text-ink-50">{{ channelMap[detailLog.channel] || detailLog.channel }}</p>
          </div>
          <div class="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/40">
            <p class="text-xs font-medium uppercase tracking-wide text-ink-400">状态</p>
            <span
              class="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="detailLog.status === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'"
            >
              <component :is="detailLog.status === 'success' ? CheckCircle2 : XCircle" :size="12" />
              {{ detailLog.status === 'success' ? '成功' : '失败' }}
            </span>
          </div>
          <div class="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/40">
            <p class="text-xs font-medium uppercase tracking-wide text-ink-400">结果</p>
            <p class="mt-1 line-clamp-2 text-sm text-ink-700 dark:text-ink-300">{{ detailLog.message || '-' }}</p>
          </div>
        </div>

        <div v-if="detailLog.content">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">推送内容</p>
          <pre class="max-h-60 overflow-auto rounded-xl border border-ink-200 bg-ink-50 p-3 text-xs leading-relaxed text-ink-800 dark:border-ink-700/60 dark:bg-ink-900/60 dark:text-ink-200">{{ detailLog.content }}</pre>
        </div>
        <div v-else class="rounded-xl bg-ink-50 py-6 text-center text-sm text-ink-400 dark:bg-ink-800/40">
          暂无推送内容记录
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style>
.log-detail-dialog .el-dialog__header {
  margin-right: 0 !important;
  padding-bottom: 16px !important;
  border-bottom: 1px solid var(--border-subtle);
}
.log-detail-dialog .el-dialog__body {
  padding-top: 20px !important;
}
</style>
