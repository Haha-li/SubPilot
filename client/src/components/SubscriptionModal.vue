<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { solar2lunar } from '../utils/lunar';
import { getCategoryTokens, hasSharedCostCategory } from '../utils/subscriptionCost';
import { ElMessage } from 'element-plus';
import CurrencySelect from './CurrencySelect.vue';
import {
  Tag as TagIcon, Calendar as CalendarIcon, Repeat, Wallet, Bell, Sparkles,
  StickyNote, Calculator, Loader2, Save, X, Moon as MoonIcon,
} from '@lucide/vue';

const props = defineProps<{
  subscription: Subscription | null;
  copy?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const subStore = useSubscriptionStore();
const isMobile = useMediaQuery('(max-width: 768px)');

const allCategories = computed(() => {
  const cats = new Set<string>();
  const sep = /[/,，\s]+/;
  subStore.subscriptions.forEach((sub) => {
    (sub.category || '').split(sep).map((t) => t.trim()).filter(Boolean).forEach((t) => cats.add(t));
  });
  const custom = JSON.parse(localStorage.getItem('customCategories') || '[]');
  custom.forEach((c: string) => cats.add(c));
  return Array.from(cats).sort((a, b) => a.localeCompare(b, 'zh-CN'));
});

const form = ref({
  name: '',
  customType: '',
  category: [] as string[],
  startDate: '',
  expiryDate: '',
  periodValue: 1,
  periodUnit: 'month',
  reminderValue: 7,
  reminderUnit: 'day',
  isActive: true,
  autoRenew: true,
  useLunar: false,
  showLunar: true,
  notes: '',
  price: 0,
  priceUnit: 'month',
  currency: 'CNY',
  nonSelfPaid: 0,
  nonSelfPaidCurrency: 'CNY',
  hasTrial: false,
  trialValue: 7,
  trialUnit: 'day',
});

const loading = ref(false);
const dialogVisible = ref(true);

const isEditing = computed(() => !!props.subscription && !props.copy);
const isSharedSubscription = computed(() => hasSharedCostCategory(form.value.category));
const priceUnitSuffix = computed(() => ({
  day: '/天',
  month: '/月',
  year: '/年',
} as Record<string, string>)[form.value.priceUnit] || '/月');
const hadSharedCategory = ref(false);
const title = computed(() => {
  if (props.copy) return '复制订阅';
  return isEditing.value ? '编辑订阅' : '添加新订阅';
});

const periodOptions = [
  { label: '天', value: 'day' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' },
];

const reminderUnitOptions = [
  { label: '天', value: 'day' },
  { label: '小时', value: 'hour' },
];

const typeOptions = [
  '视频流媒体', '音乐', '云存储', 'AI 工具', '开发工具',
  '办公软件', '游戏', 'VPN/代理', '邮箱', '新闻/阅读',
  '教育', '健身/健康', '社交/会员', '其他',
];

function handleCategoryChange(categories: string[]) {
  const hasSharedCategory = hasSharedCostCategory(categories);
  if (hasSharedCategory && !hadSharedCategory.value && form.value.nonSelfPaid === 0) {
    form.value.nonSelfPaidCurrency = form.value.currency || 'CNY';
  }
  hadSharedCategory.value = hasSharedCategory;
}

function getLunarForInput(dateStr: string): string {
  if (!dateStr || !form.value.showLunar) return '';
  const d = new Date(dateStr);
  const lunar = solar2lunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return lunar ? lunar.fullStr : '';
}

function calculateExpiry() {
  if (!form.value.startDate) {
    ElMessage.warning('请先选择开始日期');
    return;
  }
  const date = new Date(form.value.startDate);

  if (form.value.hasTrial && form.value.trialValue && form.value.trialUnit) {
    const tv = form.value.trialValue;
    if (form.value.trialUnit === 'day') date.setDate(date.getDate() + tv);
    else if (form.value.trialUnit === 'month') date.setMonth(date.getMonth() + tv);
    else if (form.value.trialUnit === 'year') date.setFullYear(date.getFullYear() + tv);
  }

  const { periodValue, periodUnit } = form.value;
  if (periodUnit === 'day') date.setDate(date.getDate() + periodValue);
  else if (periodUnit === 'month') date.setMonth(date.getMonth() + periodValue);
  else if (periodUnit === 'year') date.setFullYear(date.getFullYear() + periodValue);

  form.value.expiryDate = date.toISOString().split('T')[0];
  ElMessage.success('已自动计算到期日期');
}

function handleClose() {
  emit('close');
}

async function handleSubmit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入订阅名称');
    return;
  }
  if (!form.value.expiryDate) {
    ElMessage.warning('请选择到期日期');
    return;
  }

  loading.value = true;
  try {
    const { showLunar, category, hasTrial, ...rest } = form.value;
    const payload = {
      ...rest,
      category: category.join(', '),
      nonSelfPaid: hasSharedCostCategory(category) ? rest.nonSelfPaid : 0,
      isActive: Number(rest.isActive),
      autoRenew: Number(rest.autoRenew),
      useLunar: Number(rest.useLunar),
      trialValue: hasTrial ? rest.trialValue : null,
      trialUnit: hasTrial ? rest.trialUnit : null,
    };
    if (isEditing.value) {
      await subStore.updateSubscription(props.subscription!.id, payload as any);
    } else {
      await subStore.createSubscription(payload as any);
    }
    ElMessage.success(isEditing.value ? '已更新' : '已添加');
    emit('saved');
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (props.subscription) {
    const sub = props.subscription;
    form.value = {
      name: props.copy ? sub.name + ' (副本)' : sub.name,
      customType: sub.customType || '',
      category: getCategoryTokens(sub.category),
      startDate: sub.startDate || '',
      expiryDate: sub.expiryDate,
      periodValue: sub.periodValue || 1,
      periodUnit: sub.periodUnit || 'month',
      reminderValue: sub.reminderValue ?? 7,
      reminderUnit: sub.reminderUnit || 'day',
      isActive: !!sub.isActive,
      autoRenew: !!sub.autoRenew,
      useLunar: !!sub.useLunar,
      showLunar: true,
      notes: sub.notes || '',
      price: sub.price || 0,
      priceUnit: sub.priceUnit || 'month',
      currency: sub.currency || 'CNY',
      nonSelfPaid: sub.nonSelfPaid || 0,
      nonSelfPaidCurrency: sub.nonSelfPaidCurrency || sub.currency || 'CNY',
      hasTrial: !!(sub.trialValue && sub.trialUnit),
      trialValue: sub.trialValue || 7,
      trialUnit: sub.trialUnit || 'day',
    };
  }
  hadSharedCategory.value = isSharedSubscription.value;
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :width="isMobile ? '95%' : '720px'"
    :close-on-click-modal="false"
    :show-close="false"
    class="sub-modal"
    @close="handleClose"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
            <Sparkles :size="18" />
          </div>
          <div>
            <h3 class="font-heading text-base font-bold text-ink-900 dark:text-ink-50">{{ title }}</h3>
            <p class="text-xs text-ink-500 dark:text-ink-400">填写订阅基本信息与提醒设置</p>
          </div>
        </div>
        <button
          class="cursor-pointer rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
          aria-label="关闭"
          @click="handleClose"
        >
          <X :size="18" />
        </button>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Section: 基础 -->
      <section class="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <h4 class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <TagIcon :size="13" />
          基础信息
        </h4>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">
              订阅名称<span class="text-danger">*</span>
            </label>
            <el-input v-model="form.name" placeholder="例如：Netflix 会员" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">订阅类型</label>
            <el-select v-model="form.customType" placeholder="选择或输入" filterable allow-create clearable class="w-full">
              <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
            </el-select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">分类标签</label>
            <el-select
              v-model="form.category"
              multiple
              filterable
              allow-create
              clearable
              placeholder="选择或输入"
              class="w-full"
              @change="handleCategoryChange"
            >
              <el-option v-for="c in allCategories" :key="c" :label="c" :value="c" />
            </el-select>
          </div>
        </div>
      </section>

      <!-- Section: 日期 -->
      <section class="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <header class="mb-3 flex items-center justify-between">
          <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <CalendarIcon :size="13" />
            日期
          </h4>
          <div class="flex items-center gap-3 text-xs">
            <label class="flex cursor-pointer items-center gap-1.5 text-ink-600 dark:text-ink-300">
              <input v-model="form.showLunar" type="checkbox" class="peer sr-only" />
              <span class="relative h-4 w-7 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-500 dark:bg-ink-700">
                <span class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3" />
              </span>
              显示农历
            </label>
            <label class="flex cursor-pointer items-center gap-1.5 text-ink-600 dark:text-ink-300">
              <input v-model="form.useLunar" type="checkbox" class="peer sr-only" />
              <span class="relative h-4 w-7 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-500 dark:bg-ink-700">
                <span class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3" />
              </span>
              周期按农历
            </label>
          </div>
        </header>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">开始日期</label>
            <el-date-picker
              v-model="form.startDate"
              type="date"
              placeholder="选择开始日期"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
            <p v-if="form.showLunar && form.startDate && getLunarForInput(form.startDate)" class="mt-1 inline-flex items-center gap-1 text-xs text-brand-500 dark:text-brand-300">
              <MoonIcon :size="11" />
              {{ getLunarForInput(form.startDate) }}
            </p>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">
              到期日期<span class="text-danger">*</span>
            </label>
            <el-date-picker
              v-model="form.expiryDate"
              type="date"
              placeholder="选择到期日期"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
            <p v-if="form.showLunar && form.expiryDate && getLunarForInput(form.expiryDate)" class="mt-1 inline-flex items-center gap-1 text-xs text-brand-500 dark:text-brand-300">
              <MoonIcon :size="11" />
              {{ getLunarForInput(form.expiryDate) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Section: 周期与费用 -->
      <section class="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <header class="mb-3 flex items-center justify-between">
          <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <Repeat :size="13" />
            周期与费用
          </h4>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            @click="calculateExpiry"
          >
            <Calculator :size="12" />
            自动计算到期日
          </button>
        </header>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">周期</label>
            <el-input-number v-model="form.periodValue" :min="1" class="w-full" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">周期单位</label>
            <el-select v-model="form.periodUnit" class="w-full">
              <el-option v-for="opt in periodOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </div>
          <div class="md:col-span-2">
            <label class="mb-1 flex items-center gap-1 text-xs font-medium text-ink-700 dark:text-ink-200">
              <Wallet :size="12" />
              费用
            </label>
            <el-input v-model.number="form.price" type="number" :min="0" placeholder="0">
              <template #prepend>
                <CurrencySelect v-model="form.currency" width="112px" aria-label="费用币种" />
              </template>
              <template #append>
                <el-select v-model="form.priceUnit" style="width: 80px">
                  <el-option label="/年" value="year" />
                  <el-option label="/月" value="month" />
                  <el-option label="/天" value="day" />
                </el-select>
              </template>
            </el-input>
          </div>
          <div v-if="isSharedSubscription" class="md:col-span-2">
            <label class="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-ink-700 dark:text-ink-200">
              <span>非自己付费</span>
              <span class="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                合租分摊
              </span>
            </label>
            <el-input v-model.number="form.nonSelfPaid" type="number" :min="0" placeholder="0">
              <template #prepend>
                <CurrencySelect
                  v-model="form.nonSelfPaidCurrency"
                  width="112px"
                  aria-label="非自己付费币种"
                />
              </template>
              <template #append>
                <span class="inline-flex w-12 items-center justify-center">{{ priceUnitSuffix }}</span>
              </template>
            </el-input>
            <p class="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
              填写他人承担的金额，可选择与支付币种不同；个人费用会按汇率换算后扣减。
            </p>
          </div>
        </div>
      </section>

      <!-- Section: 提醒与状态 -->
      <section class="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <h4 class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <Bell :size="13" />
          提醒与状态
        </h4>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">提前提醒</label>
            <el-input v-model.number="form.reminderValue" type="number" :min="0">
              <template #append>
                <el-select v-model="form.reminderUnit" style="width: 80px">
                  <el-option v-for="opt in reminderUnitOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </template>
            </el-input>
            <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">0 = 仅到期时提醒</p>
          </div>
          <div class="flex flex-col justify-center gap-3 rounded-xl bg-ink-50/60 px-4 py-3 dark:bg-ink-800/40">
            <label class="flex cursor-pointer items-center justify-between text-sm text-ink-700 dark:text-ink-200">
              <span class="font-medium">启用订阅</span>
              <input v-model="form.isActive" type="checkbox" class="peer sr-only" />
              <span class="relative h-5 w-9 rounded-full bg-ink-200 transition-colors peer-checked:bg-success dark:bg-ink-700">
                <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
            <label class="flex cursor-pointer items-center justify-between text-sm text-ink-700 dark:text-ink-200">
              <span class="font-medium">自动续订</span>
              <input v-model="form.autoRenew" type="checkbox" class="peer sr-only" />
              <span class="relative h-5 w-9 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-500 dark:bg-ink-700">
                <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
          </div>
        </div>
      </section>

      <!-- Section: 试用 -->
      <section class="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <header class="mb-3 flex items-center justify-between">
          <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <Sparkles :size="13" />
            免费试用
          </h4>
          <label class="flex cursor-pointer items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
            <input v-model="form.hasTrial" type="checkbox" class="peer sr-only" />
            <span class="relative h-4 w-7 rounded-full bg-ink-200 transition-colors peer-checked:bg-emerald-500 dark:bg-ink-700">
              <span class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3" />
            </span>
            开启试用期
          </label>
        </header>
        <div v-if="form.hasTrial">
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">试用时长</label>
          <el-input v-model.number="form.trialValue" type="number" :min="1">
            <template #append>
              <el-select v-model="form.trialUnit" style="width: 80px">
                <el-option v-for="opt in periodOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </template>
          </el-input>
          <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">从开始日期起算的免费试用期</p>
        </div>
        <p v-else class="text-xs text-ink-400 dark:text-ink-500">订阅含免费试用期时启用，参与到期日自动计算</p>
      </section>

      <!-- Section: 备注 -->
      <section class="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-700/50 dark:bg-ink-800/20">
        <h4 class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <StickyNote :size="13" />
          备注
        </h4>
        <textarea
          v-model="form.notes"
          rows="3"
          placeholder="可添加相关备注信息..."
          class="block w-full resize-none rounded-xl border border-ink-200 bg-white/60 p-3 text-sm leading-relaxed text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50"
        />
      </section>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          class="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-ink-200 bg-white/70 px-4 text-sm font-medium text-ink-700 hover:bg-white hover:text-ink-900 dark:border-ink-700/60 dark:bg-ink-800/40 dark:text-ink-200 dark:hover:bg-ink-800/70"
          @click="handleClose"
        >
          取消
        </button>
        <button
          class="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 px-5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="handleSubmit"
        >
          <component :is="loading ? Loader2 : Save" :size="15" :class="loading && 'animate-spin'" />
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
.sub-modal .el-dialog__header {
  padding: 18px 20px 14px !important;
}
.sub-modal .el-dialog__body {
  padding: 18px 20px !important;
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}
.sub-modal .el-dialog__footer {
  padding: 14px 20px !important;
}
</style>
