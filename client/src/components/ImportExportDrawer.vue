<script setup lang="ts">
import { ref } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore } from '../stores/subscription';
import { useSystemConfigStore } from '../stores/systemConfig';
import {
  Download, Upload, FileText, FileJson, FileSpreadsheet, CalendarDays, CheckCircle2, AlertCircle, Loader2, X,
} from '@lucide/vue';
import api from '../utils/api';
import { generateICS } from '../utils/ics';
import { getDateOnlyInTimeZone } from '../utils/dateOnly';

const emit = defineEmits<{ close: [] }>();
const subStore = useSubscriptionStore();
const systemConfigStore = useSystemConfigStore();
const isMobile = useMediaQuery('(max-width: 768px)');

const drawerVisible = ref(true);
const importing = ref(false);
const exporting = ref(false);
const importResult = ref('');
const importSuccess = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

async function handleExport(format: string) {
  exporting.value = true;
  try {
    const response = await api.get(`/subscriptions/export?format=${format}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions_${getDateOnlyInTimeZone(new Date(), systemConfigStore.timezone)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出为 ${format.toUpperCase()} 文件`);
  } catch (e: any) {
    ElMessage.error('导出失败: ' + (e.message || '未知错误'));
  } finally {
    exporting.value = false;
  }
}

function handleExportICS() {
  exporting.value = true;
  try {
    const ics = generateICS(subStore.subscriptions);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions_${getDateOnlyInTimeZone(new Date(), systemConfigStore.timezone)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('已导出为 ICS 日历文件');
  } catch (e: any) {
    ElMessage.error('导出失败: ' + (e.message || '未知错误'));
  } finally {
    exporting.value = false;
  }
}

async function processFile(file: File) {
  if (importing.value) return;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'json' && ext !== 'csv') {
    ElMessage.warning('仅支持 JSON 或 CSV 文件');
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    ElMessage.warning('导入文件不能超过 10 MB');
    return;
  }

  importing.value = true;
  importResult.value = '';
  importSuccess.value = false;
  try {
    const data = await file.text();
    const { data: result } = await api.post('/subscriptions/import', { format: ext, data });
    importSuccess.value = Boolean(result.success);
    const details = [
      `新增 ${result.imported ?? 0} 条`,
      `跳过重复 ${result.skipped ?? 0} 条`,
    ];
    if (result.renewalLogsImported) details.push(`恢复续费记录 ${result.renewalLogsImported} 条`);
    if (result.renewalLogsSkipped) details.push(`跳过重复续费记录 ${result.renewalLogsSkipped} 条`);
    importResult.value = `导入完成：${details.join('，')}`;
    if (result.errors?.length) {
      importResult.value += `\n存在问题：\n${result.errors.join('\n')}`;
    }
    await subStore.fetchSubscriptions();
    ElMessage.success(result.imported > 0 ? `成功导入 ${result.imported} 条订阅` : '没有新增订阅');
  } catch (e: any) {
    const response = e.response?.data;
    const details = Array.isArray(response?.errors) ? `\n${response.errors.join('\n')}` : '';
    importResult.value = `导入失败: ${response?.message || e.message}${details}`;
    ElMessage.error(response?.message || '导入失败');
  } finally {
    importing.value = false;
  }
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) processFile(file);
  input.value = '';
}

function handleDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  processFile(file);
}

function pickFile() {
  fileInputRef.value?.click();
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    :size="isMobile ? '90%' : '440px'"
    :show-close="false"
    @close="emit('close')"
  >
    <template #header>
      <div class="flex w-full items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
            <FileText :size="18" />
          </div>
          <div>
            <h3 class="font-heading text-base font-bold text-ink-900 dark:text-ink-50">导入 / 导出</h3>
            <p class="text-xs text-ink-500 dark:text-ink-400">备份订阅数据或从文件恢复</p>
          </div>
        </div>
        <button
          class="cursor-pointer rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
          aria-label="关闭"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>
    </template>

    <div class="space-y-5">
      <!-- Export -->
      <section class="rounded-2xl border border-ink-200 bg-white/50 p-4 dark:border-ink-700/50 dark:bg-ink-800/30">
        <header class="mb-3 flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Download :size="15" />
          </div>
          <div>
            <h4 class="text-sm font-semibold text-ink-900 dark:text-ink-50">导出订阅</h4>
            <p class="text-xs text-ink-500 dark:text-ink-400">将所有订阅数据保存到本地</p>
          </div>
        </header>
        <div class="grid grid-cols-3 gap-2">
          <button
            class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-ink-200 bg-white/70 p-4 transition-all hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-900/40 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300 disabled:opacity-60"
            :disabled="exporting"
            @click="handleExport('json')"
          >
            <FileJson :size="22" :stroke-width="1.75" />
            <span class="text-sm font-semibold">JSON</span>
            <span class="text-[10px] uppercase tracking-wide text-ink-400">含续费历史</span>
          </button>
          <button
            class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-ink-200 bg-white/70 p-4 transition-all hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-900/40 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300 disabled:opacity-60"
            :disabled="exporting"
            @click="handleExport('csv')"
          >
            <FileSpreadsheet :size="22" :stroke-width="1.75" />
            <span class="text-sm font-semibold">CSV</span>
            <span class="text-[10px] uppercase tracking-wide text-ink-400">订阅表格</span>
          </button>
          <button
            class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-ink-200 bg-white/70 p-4 transition-all hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 dark:border-ink-700/60 dark:bg-ink-900/40 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300 disabled:opacity-60"
            :disabled="exporting"
            @click="handleExportICS"
          >
            <CalendarDays :size="22" :stroke-width="1.75" />
            <span class="text-sm font-semibold">ICS</span>
            <span class="text-[10px] uppercase tracking-wide text-ink-400">日历</span>
          </button>
        </div>
      </section>

      <!-- Import -->
      <section class="rounded-2xl border border-ink-200 bg-white/50 p-4 dark:border-ink-700/50 dark:bg-ink-800/30">
        <header class="mb-3 flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Upload :size="15" />
          </div>
          <div>
            <h4 class="text-sm font-semibold text-ink-900 dark:text-ink-50">导入订阅</h4>
            <p class="text-xs text-ink-500 dark:text-ink-400">JSON 可恢复续费历史，CSV 适合表格编辑</p>
          </div>
        </header>

        <div
          class="relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors"
          :class="dragOver
            ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/60 dark:bg-brand-500/10'
            : 'border-ink-200 bg-ink-50/40 hover:border-brand-300 hover:bg-brand-50/30 dark:border-ink-700/60 dark:bg-ink-800/30 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5'"
          @click="pickFile"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,.csv"
            class="hidden"
            @change="handleFileInput"
          />
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl"
            :class="importing
              ? 'bg-brand-500 text-white'
              : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'"
          >
            <component :is="importing ? Loader2 : Upload" :size="18" :class="importing && 'animate-spin'" />
          </div>
          <p class="text-sm font-medium text-ink-700 dark:text-ink-200">
            <span class="text-brand-600 dark:text-brand-300">点击选择文件</span>
            <span class="text-ink-500 dark:text-ink-400"> 或拖拽到此处</span>
          </p>
          <p class="text-xs text-ink-400 dark:text-ink-500">JSON、CSV — 最大 10 MB</p>
        </div>

        <div
          v-if="importResult"
          class="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5"
          :class="importSuccess
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger'"
        >
          <component :is="importSuccess ? CheckCircle2 : AlertCircle" :size="15" class="mt-0.5 flex-shrink-0" />
          <pre class="m-0 whitespace-pre-wrap break-all text-xs font-medium leading-relaxed">{{ importResult }}</pre>
        </div>
      </section>
    </div>
  </el-drawer>
</template>
