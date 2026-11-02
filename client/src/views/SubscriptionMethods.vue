<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CreditCard, Loader2, Pencil, Plus, Search, Trash2, Wallet } from '@lucide/vue';
import { useSubscriptionStore } from '../stores/subscription';
import {
  type SubscriptionMethod,
  useSubscriptionMethodStore,
} from '../stores/subscriptionMethod';
import { fetchRates, getSymbol } from '../utils/currency';
import { getPersonalMonthlyCostOrZero } from '../utils/subscriptionCost';
import CurrencySelect from '../components/CurrencySelect.vue';

const methodStore = useSubscriptionMethodStore();
const subscriptionStore = useSubscriptionStore();
const keyword = ref('');
const showModal = ref(false);
const editing = ref<SubscriptionMethod | null>(null);
const saving = ref(false);
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

function monthlyCost(id: number) {
  ratesReady.value;
  return subscriptionsFor(id)
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + getPersonalMonthlyCostOrZero(item, 'CNY'), 0);
}

function balanceText(item: SubscriptionMethod) {
  if (item.balance === null || item.balance === undefined) return '未记录';
  return `${getSymbol(item.balanceCurrency || 'CNY')}${item.balance.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function moneyText(value: number) {
  if (!Number.isFinite(value)) return '汇率缺失';
  return `${getSymbol('CNY')}${Math.round(value).toLocaleString('zh-CN')}`;
}

function openAdd() {
  editing.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(item: SubscriptionMethod) {
  editing.value = item;
  form.value = {
    name: item.name,
    channel: item.channel || '',
    paymentMethod: item.paymentMethod || '',
    account: item.account || '',
    balance: item.balance,
    balanceCurrency: item.balanceCurrency || 'CNY',
    paymentReference: item.paymentReference || '',
  };
  showModal.value = true;
}

async function save() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入名称');
    return;
  }
  if (
    form.value.balance !== null
    && form.value.balance !== ''
    && (!Number.isFinite(form.value.balance) || form.value.balance < 0)
  ) {
    ElMessage.warning('账户余额必须是非负数');
    return;
  }
  const payload = {
    ...form.value,
    balance: form.value.balance === '' ? null : form.value.balance,
  };
  saving.value = true;
  try {
    if (editing.value) await methodStore.updateItem(editing.value.id, payload);
    else await methodStore.createItem(payload);
    showModal.value = false;
    ElMessage.success(editing.value ? '已更新订阅方式' : '已添加订阅方式');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
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

    <section v-else-if="filteredItems.length" aria-label="订阅方式列表" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <article v-for="item in filteredItems" :key="item.id" class="bento-card p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-ink-900 dark:text-ink-50">{{ item.name }}</h3>
            <p class="mt-1 truncate text-xs text-ink-500 dark:text-ink-400">
              {{ [item.channel, item.paymentMethod].filter(Boolean).join(' · ') || '未填写渠道' }}
            </p>
          </div>
          <div class="flex flex-shrink-0 gap-1">
            <button class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-800/60" :aria-label="`编辑 ${item.name}`" @click="openEdit(item)">
              <Pencil :size="16" />
            </button>
            <button class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-danger/10 hover:text-danger dark:text-ink-400" :aria-label="`删除 ${item.name}`" @click="handleDelete(item)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-xs text-ink-400">订阅账号</dt>
            <dd class="mt-1 truncate font-medium text-ink-800 dark:text-ink-100">{{ item.account || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-400">账户余额</dt>
            <dd class="font-mono-nums mt-1 font-semibold text-ink-800 dark:text-ink-100">{{ balanceText(item) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-400">使用订阅</dt>
            <dd class="font-mono-nums mt-1 font-semibold text-ink-800 dark:text-ink-100">{{ subscriptionsFor(item.id).length }}</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-400">个人月费</dt>
            <dd class="font-mono-nums mt-1 font-semibold text-ink-800 dark:text-ink-100">{{ moneyText(monthlyCost(item.id)) }}</dd>
          </div>
        </dl>
        <p v-if="item.paymentReference" class="mt-3 truncate text-xs text-ink-500 dark:text-ink-400">{{ item.paymentReference }}</p>
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

    <el-dialog v-model="showModal" :title="editing ? '编辑订阅方式' : '新增订阅方式'" width="560px" :close-on-click-modal="false">
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
            <el-input v-model.number="form.balance" type="number" :min="0" step="0.01" placeholder="未记录" class="min-w-0 flex-1" />
            <CurrencySelect v-model="form.balanceCurrency" width="132px" aria-label="余额币种" />
          </div>
        </div>
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
  </div>
</template>
