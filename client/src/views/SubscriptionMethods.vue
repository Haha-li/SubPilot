<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import {
  CircleDollarSign, Copy, CreditCard, Loader2, Pencil, Plus, Search, Trash2, Wallet,
} from '@lucide/vue';
import { useSubscriptionStore } from '../stores/subscription';
import { useSystemConfigStore } from '../stores/systemConfig';
import {
  type SubscriptionMethod,
  useSubscriptionMethodStore,
} from '../stores/subscriptionMethod';
import { fetchRates, getSymbol } from '../utils/currency';
import { getDateOnlyInTimeZone } from '../utils/dateOnly';
import {
  buildSubscriptionMethodForecast,
  type BalanceStatus,
} from '../utils/subscriptionMethodForecast';
import CurrencySelect from '../components/CurrencySelect.vue';

const MethodDetailDrawer = defineAsyncComponent(() => import('../components/SubscriptionMethodDetailDrawer.vue'));
const methodStore = useSubscriptionMethodStore();
const subscriptionStore = useSubscriptionStore();
const systemConfigStore = useSystemConfigStore();
const keyword = ref('');
const showModal = ref(false);
const editing = ref<SubscriptionMethod | null>(null);
const copying = ref(false);
const copyBalance = ref(false);
const copySourceBalance = ref<number | null>(null);
const saving = ref(false);
const adjustmentVisible = ref(false);
const adjusting = ref<SubscriptionMethod | null>(null);
const adjustmentAmount = ref<number | ''>('');
const adjustmentNote = ref('');
const adjustmentSaving = ref(false);
const detailMethod = ref<SubscriptionMethod | null>(null);
const ratesReady = ref(0);
const channelOptions = [
  '官网直订', 'iOS App Store', 'Google Play', '第三方平台/代理商',
  '运营商代订', '家庭/他人共享', '公司/组织提供', '线下购买', '其他',
];
const paymentOptions = [
  '信用卡', '借记卡', 'Apple 账户余额', 'Google Play 余额', '平台余额',
  '支付宝', '微信支付', 'PayPal', '银行代扣', '银行转账', '礼品卡/兑换码', '其他',
];
const form = ref(emptyForm());
const balanceLocked = computed(() => !!editing.value && typeof form.value.balance === 'number');
const adjustedBalance = computed(() => {
  const current = adjusting.value?.balance ?? 0;
  const amount = adjustmentAmount.value === '' ? 0 : Math.round(Number(adjustmentAmount.value) * 100) / 100;
  return Number.isFinite(amount) ? Math.round((current + amount) * 100) / 100 : current;
});

function emptyForm() {
  return {
    name: '',
    channel: '',
    paymentMethod: '',
    account: '',
    balance: null as number | null | '',
    balanceCurrency: 'CNY',
    paymentReference: '',
  };
}

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  if (!query) return methodStore.items;
  return methodStore.items.filter((item) => (
    [item.name, item.channel, item.paymentMethod, item.account, item.paymentReference]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(query)
  ));
});

function subscriptionsFor(id: number) {
  return subscriptionStore.subscriptions.filter((item) => item.subscriptionMethodId === id);
}

function methodForecast(item: SubscriptionMethod) {
  ratesReady.value;
  return buildSubscriptionMethodForecast(
    item,
    subscriptionsFor(item.id),
    getDateOnlyInTimeZone(new Date(), systemConfigStore.timezone),
  );
}

function balanceText(item: SubscriptionMethod) {
  if (item.balance === null || item.balance === undefined) return '未记录';
  const currency = item.balanceCurrency || 'CNY';
  return `${getSymbol(currency)}${item.balance.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function activeCount(id: number) {
  return subscriptionsFor(id).filter((item) => item.isActive).length;
}

function monthsLeftText(item: SubscriptionMethod): string {
  const forecast = methodForecast(item);
  if (forecast.monthsLeft === null) return forecast.status === 'unrecorded' ? '未记录余额' : '暂无每月支出';
  const months = Math.floor(forecast.monthsLeft * 10) / 10;
  const text = Number.isInteger(months) ? String(months) : months.toFixed(1);
  return forecast.exhaustionDate
    ? `预计 ${forecast.exhaustionDate} 用完 · ${text} 个月`
    : `预计还能用 ${text} 个月`;
}

function moneyText(value: number, currency: string) {
  if (!Number.isFinite(value)) return '汇率缺失';
  return `${getSymbol(currency)}${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}/月`;
}

function statusMeta(status: BalanceStatus) {
  return {
    unrecorded: { label: '未记录余额', classes: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400' },
    insufficient: { label: '余额不足', classes: 'bg-danger/10 text-danger' },
    warning: { label: '不足 3 个月', classes: 'bg-warning/15 text-warning' },
    healthy: { label: '余额充足', classes: 'bg-success/10 text-success' },
    idle: { label: '暂无扣款', classes: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
  }[status];
}

function formFrom(item: SubscriptionMethod) {
  return {
    name: item.name,
    channel: item.channel || '',
    paymentMethod: item.paymentMethod || '',
    account: item.account || '',
    balance: item.balance,
    balanceCurrency: item.balanceCurrency || 'CNY',
    paymentReference: item.paymentReference || '',
  };
}

function openAdd() {
  editing.value = null;
  copying.value = false;
  copyBalance.value = false;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(item: SubscriptionMethod) {
  detailMethod.value = null;
  editing.value = item;
  copying.value = false;
  copyBalance.value = false;
  form.value = formFrom(item);
  showModal.value = true;
}

function openCopy(item: SubscriptionMethod) {
  detailMethod.value = null;
  editing.value = null;
  copying.value = true;
  copyBalance.value = false;
  copySourceBalance.value = item.balance;
  form.value = { ...formFrom(item), name: `${item.name} 副本`, balance: null };
  showModal.value = true;
}

function openAdjustment(item: SubscriptionMethod) {
  detailMethod.value = null;
  adjusting.value = item;
  adjustmentAmount.value = '';
  adjustmentNote.value = '';
  adjustmentVisible.value = true;
}

function openDetail(item: SubscriptionMethod) {
  detailMethod.value = item;
}

async function save() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入名称');
    return;
  }
  if (
    form.value.balance !== null
    && form.value.balance !== ''
    && !Number.isFinite(form.value.balance)
  ) {
    ElMessage.warning('账户余额必须是数字');
    return;
  }
  const payload = {
    ...form.value,
    balance: copying.value && !copyBalance.value
      ? null
      : form.value.balance === '' ? null : form.value.balance,
  };
  saving.value = true;
  try {
    if (editing.value) await methodStore.updateItem(editing.value.id, payload);
    else await methodStore.createItem(payload);
    showModal.value = false;
    ElMessage.success(editing.value ? '已更新订阅方式' : copying.value ? '已复制订阅方式' : '已添加订阅方式');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function saveAdjustment() {
  if (!adjusting.value) return;
  const amount = Math.round(Number(adjustmentAmount.value) * 100) / 100;
  if (!Number.isFinite(amount) || amount === 0) {
    ElMessage.warning('请输入非零调整金额，最多两位小数');
    return;
  }
  adjustmentSaving.value = true;
  try {
    await methodStore.adjustBalance(adjusting.value.id, amount, adjustmentNote.value);
    adjustmentVisible.value = false;
    ElMessage.success(amount > 0 ? '余额已增加' : '余额已扣减');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '调整余额失败');
  } finally {
    adjustmentSaving.value = false;
  }
}

async function handleDelete(item: SubscriptionMethod) {
  const used = subscriptionsFor(item.id).length;
  if (used > 0) {
    ElMessage.warning(`仍有 ${used} 个订阅使用「${item.name}」`);
    return;
  }
  try {
    await ElMessageBox.confirm(`确定删除订阅方式「${item.name}」？`, '确认删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await methodStore.deleteItem(item.id);
    ElMessage.success('已删除订阅方式');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '删除失败');
  }
}

onMounted(async () => {
  void fetchRates().finally(() => { ratesReady.value += 1; });
  try {
    await Promise.all([
      methodStore.fetchItems(),
      subscriptionStore.subscriptions.length ? Promise.resolve() : subscriptionStore.fetchSubscriptions(),
    ]);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '订阅方式加载失败');
  }
});
</script>

<template>
  <div>
    <header class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">订阅方式</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">统一维护渠道、账号和余额。订阅里只需要选择。</p>
      </div>
      <div class="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
        <label class="relative min-w-0 flex-1 lg:w-72">
          <Search :size="16" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            v-model="keyword"
            type="search"
            aria-label="搜索订阅方式"
            placeholder="搜索名称、渠道或账号"
            class="block h-11 w-full rounded-xl border border-ink-200 bg-white/70 py-2 pl-10 pr-3 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50 md:text-sm"
          />
        </label>
        <button class="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-colors hover:bg-brand-600" @click="openAdd">
          <Plus :size="16" /> 新增方式
        </button>
      </div>
    </header>

    <div v-if="methodStore.loading" class="flex min-h-64 items-center justify-center" role="status">
      <Loader2 :size="26" class="animate-spin text-brand-500" />
      <span class="ml-2 text-sm text-ink-500 dark:text-ink-400">加载订阅方式...</span>
    </div>

    <section v-else-if="filteredItems.length" aria-label="订阅方式列表" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in filteredItems" :key="item.id" class="bento-card flex min-w-0 cursor-pointer flex-col p-5" @click="openDetail(item)">
        <div class="flex min-w-0 items-start gap-3">
          <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <CreditCard :size="22" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-base font-semibold text-ink-900 dark:text-ink-50" :title="item.name">{{ item.name }}</h3>
            <p class="mt-1 truncate text-xs text-ink-500 dark:text-ink-400">{{ item.account || '未填写账号' }}</p>
          </div>
          <span class="flex-shrink-0 rounded-full px-2 py-1 text-xs font-semibold" :class="statusMeta(methodForecast(item).status).classes">
            {{ statusMeta(methodForecast(item).status).label }}
          </span>
        </div>

        <div class="mt-4 flex min-h-6 flex-wrap gap-1.5">
          <span v-if="item.channel" class="max-w-full truncate rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">{{ item.channel }}</span>
          <span v-if="item.paymentMethod" class="max-w-full truncate rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">{{ item.paymentMethod }}</span>
          <span v-if="item.paymentReference" class="max-w-full truncate rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">{{ item.paymentReference }}</span>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-ink-50/80 px-3 py-3 dark:bg-ink-800/40">
            <p class="text-xs text-ink-500 dark:text-ink-400">账户余额</p>
            <p class="font-mono-nums mt-1 truncate text-lg font-bold text-ink-900 dark:text-ink-50">{{ balanceText(item) }}</p>
          </div>
          <div class="rounded-xl bg-brand-50/80 px-3 py-3 dark:bg-brand-500/10" title="按订阅里的费用折成每月，不含非自己付费">
            <p class="text-xs text-ink-500 dark:text-ink-400">每月支出</p>
            <p class="font-mono-nums mt-1 truncate text-lg font-bold text-ink-900 dark:text-ink-50">{{ moneyText(methodForecast(item).monthlyFee, item.balanceCurrency || 'CNY') }}</p>
          </div>
        </div>
        <p class="mt-2 text-xs font-medium text-ink-500 dark:text-ink-400">{{ monthsLeftText(item) }} · {{ activeCount(item.id) }} 个启用订阅</p>
        <p v-if="methodForecast(item).nextChargeDate" class="mt-1 text-xs text-ink-400 dark:text-ink-500">
          下次 {{ methodForecast(item).nextChargeDate }} 扣 {{ moneyText(methodForecast(item).nextChargeAmount, item.balanceCurrency || 'CNY').replace('/月', '') }}
        </p>

        <div class="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-ink-100 pt-4 dark:border-ink-800/50">
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-ink-600 transition-colors hover:bg-success/10 hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success dark:text-ink-300" @click.stop="openAdjustment(item)">
            <CircleDollarSign :size="15" /> 调整余额
          </button>
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-ink-600 transition-colors hover:bg-amber-50 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:text-ink-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-300" @click.stop="openCopy(item)">
            <Copy :size="15" /> 复制
          </button>
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-ink-300 dark:hover:bg-ink-800/60" @click.stop="openEdit(item)">
            <Pencil :size="15" /> 编辑
          </button>
          <button class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-ink-600 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger dark:text-ink-300" @click.stop="handleDelete(item)">
            <Trash2 :size="15" /> 删除
          </button>
        </div>
      </article>
    </section>

    <section v-else class="bento-card flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300">
        <component :is="keyword ? Search : CreditCard" :size="28" />
      </div>
      <h3 class="mt-4 text-base font-semibold text-ink-800 dark:text-ink-100">{{ keyword ? '没有匹配结果' : '还没有订阅方式' }}</h3>
      <p class="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">先在这里添加 iOS 内购、卡付或平台余额，创建订阅时直接选择。</p>
      <button v-if="!keyword" class="mt-5 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600" @click="openAdd">
        <Plus :size="16" /> 添加第一个
      </button>
    </section>

    <el-dialog v-model="showModal" :title="editing ? '编辑订阅方式' : copying ? '复制订阅方式' : '新增订阅方式'" width="560px" :close-on-click-modal="false">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">名称<span class="text-danger">*</span></label>
          <el-input v-model="form.name" maxlength="100" placeholder="例如：美区 Apple ID" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">订阅渠道</label>
          <el-select v-model="form.channel" filterable allow-create default-first-option clearable placeholder="选择或输入" class="w-full">
            <el-option v-for="item in channelOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">支付方式</label>
          <el-select v-model="form.paymentMethod" filterable allow-create default-first-option clearable placeholder="选择或输入" class="w-full">
            <el-option v-for="item in paymentOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">订阅账号</label>
          <el-input v-model="form.account" maxlength="320" placeholder="邮箱、手机号或用户名" />
        </div>
        <div>
          <label class="mb-1 flex items-center gap-1 text-xs font-medium text-ink-700 dark:text-ink-200"><Wallet :size="12" /> 账户余额</label>
          <div class="flex gap-2">
            <el-input v-model.number="form.balance" type="number" step="0.01" placeholder="未记录" class="min-w-0 flex-1" :disabled="!!editing" />
            <CurrencySelect v-model="form.balanceCurrency" width="132px" aria-label="余额币种" :disabled="balanceLocked" />
          </div>
        </div>
        <div v-if="copying" class="md:col-span-2 rounded-xl bg-ink-50/70 px-3 py-2 dark:bg-ink-800/30">
          <label class="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-700 dark:text-ink-200">
            <span>复制当前余额</span>
            <el-switch v-model="copyBalance" @change="form.balance = copyBalance ? copySourceBalance : null" />
          </label>
          <p class="mt-1 text-xs text-ink-400">默认不复制余额，只复制渠道、账号等配置。</p>
        </div>
        <div v-if="editing" class="md:col-span-2 text-xs text-ink-400">余额请使用“调整余额”保留流水。已记录余额后不能改币种。</div>
        <div class="md:col-span-2">
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">付款标识</label>
          <el-input v-model="form.paymentReference" maxlength="200" placeholder="例如：Visa 尾号 1234" />
          <p class="mt-1 text-xs text-ink-400">只填写卡片名称或尾号，不要保存完整卡号、CVV 或密码。</p>
        </div>
      </div>
      <template #footer>
        <button class="mr-2 inline-flex h-10 cursor-pointer items-center rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700 dark:border-ink-700 dark:text-ink-200" @click="showModal = false">取消</button>
        <button class="inline-flex h-10 cursor-pointer items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white disabled:opacity-60" :disabled="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </template>
    </el-dialog>

    <el-dialog v-model="adjustmentVisible" title="调整余额" width="440px" :close-on-click-modal="false">
      <div v-if="adjusting" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-ink-50/80 p-3 dark:bg-ink-800/40">
            <p class="text-xs text-ink-500 dark:text-ink-400">当前余额</p>
            <p class="font-mono-nums mt-1 text-lg font-bold text-ink-900 dark:text-ink-50">{{ balanceText(adjusting) }}</p>
          </div>
          <div class="rounded-xl bg-brand-50/80 p-3 dark:bg-brand-500/10">
            <p class="text-xs text-ink-500 dark:text-ink-400">调整后</p>
            <p class="font-mono-nums mt-1 text-lg font-bold text-ink-900 dark:text-ink-50">
              {{ getSymbol(adjusting.balanceCurrency || 'CNY') }}{{ adjustedBalance.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) }} {{ adjusting.balanceCurrency || 'CNY' }}
            </p>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">调整金额</label>
          <el-input v-model.number="adjustmentAmount" type="number" step="0.01" placeholder="正数增加，负数扣减">
            <template #append>{{ adjusting.balanceCurrency || 'CNY' }}</template>
          </el-input>
          <div class="mt-2 flex flex-wrap gap-2">
            <button v-for="amount in [50, 100, 200, -10, -20]" :key="amount" type="button" class="cursor-pointer rounded-lg bg-ink-100 px-2.5 py-1 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-600 dark:bg-ink-800 dark:text-ink-300" @click="adjustmentAmount = amount">
              {{ amount > 0 ? '+' : '' }}{{ amount }}
            </button>
          </div>
          <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">正数表示充值，负数表示手动扣减。</p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-200">调整备注</label>
          <el-input v-model="adjustmentNote" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="例如：礼品卡充值、退款或手动修正" />
        </div>
      </div>
      <template #footer>
        <button class="mr-2 inline-flex h-10 cursor-pointer items-center rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700 dark:border-ink-700 dark:text-ink-200" @click="adjustmentVisible = false">取消</button>
        <button class="inline-flex h-10 cursor-pointer items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white disabled:opacity-60" :disabled="adjustmentSaving" @click="saveAdjustment">
          {{ adjustmentSaving ? '保存中...' : '确认调整' }}
        </button>
      </template>
    </el-dialog>

    <MethodDetailDrawer
      v-if="detailMethod"
      :method="detailMethod"
      @close="detailMethod = null"
      @edit="openEdit"
      @copy="openCopy"
      @adjust="openAdjustment"
    />
  </div>
</template>
