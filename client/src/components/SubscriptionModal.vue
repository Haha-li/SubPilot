<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { solar2lunar } from '../utils/lunar';
import { ElMessage } from 'element-plus';

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
  subStore.subscriptions.forEach(sub => {
    (sub.category || '').split(sep).map(t => t.trim()).filter(Boolean).forEach(t => cats.add(t));
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
});

const loading = ref(false);
const dialogVisible = ref(true);
const formRef = ref();

const isEditing = computed(() => !!props.subscription && !props.copy);
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

function getLunarForInput(dateStr: string): string {
  if (!dateStr || !form.value.showLunar) return '';
  const d = new Date(dateStr);
  const lunar = solar2lunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return lunar ? `农历: ${lunar.fullStr}` : '';
}

function calculateExpiry() {
  if (!form.value.startDate) {
    ElMessage.warning('请先选择开始日期');
    return;
  }
  const start = new Date(form.value.startDate);
  const { periodValue, periodUnit } = form.value;
  if (periodUnit === 'day') start.setDate(start.getDate() + periodValue);
  else if (periodUnit === 'month') start.setMonth(start.getMonth() + periodValue);
  else if (periodUnit === 'year') start.setFullYear(start.getFullYear() + periodValue);
  form.value.expiryDate = start.toISOString().split('T')[0];
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
    const { showLunar, category, ...rest } = form.value;
    const payload = {
      ...rest,
      category: category.join(', '),
      isActive: Number(rest.isActive),
      autoRenew: Number(rest.autoRenew),
      useLunar: Number(rest.useLunar),
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
      category: (sub.category || '').split(/[/,，\s]+/).map(t => t.trim()).filter(Boolean),
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
    };
  }
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    :width="isMobile ? '95%' : '680px'"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" label-position="top">
      <!-- Basic Info -->
      <el-row :gutter="16">
        <el-col :xs="24" :md="8">
          <el-form-item label="订阅名称" required>
            <el-input v-model="form.name" placeholder="请输入订阅名称" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="订阅类型">
            <el-select v-model="form.customType" placeholder="选择或输入类型" filterable allow-create clearable style="width: 100%">
              <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="分类标签">
            <el-select v-model="form.category" multiple filterable allow-create clearable placeholder="选择或输入分类" style="width: 100%">
              <el-option v-for="c in allCategories" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- Lunar toggle -->
      <el-row :gutter="16" class="toggle-row">
        <el-col :span="12">
          <el-switch v-model="form.showLunar" active-text="显示农历" />
        </el-col>
        <el-col :span="12">
          <el-switch v-model="form.useLunar" active-text="周期按农历" />
        </el-col>
      </el-row>

      <!-- Dates -->
      <el-row :gutter="16">
        <el-col :xs="24" :md="12">
          <el-form-item label="开始日期">
            <el-date-picker
              v-model="form.startDate"
              type="date"
              placeholder="选择开始日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
            <div v-if="form.showLunar && form.startDate" class="lunar-hint">
              {{ getLunarForInput(form.startDate) }}
            </div>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="到期日期" required>
            <el-date-picker
              v-model="form.expiryDate"
              type="date"
              placeholder="选择到期日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
            <div v-if="form.showLunar && form.expiryDate" class="lunar-hint">
              {{ getLunarForInput(form.expiryDate) }}
            </div>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- Period -->
      <el-row :gutter="16">
        <el-col :xs="24" :md="12">
          <el-form-item label="周期">
            <el-input-number v-model="form.periodValue" :min="1" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="周期单位">
            <el-select v-model="form.periodUnit" style="width: 100%">
              <el-option v-for="opt in periodOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- Price -->
      <el-row :gutter="16">
        <el-col :xs="24" :md="12">
          <el-form-item label="费用">
            <el-input v-model.number="form.price" type="number" :min="0" placeholder="0">
              <template #append>
                <el-select v-model="form.priceUnit" style="width: 80px">
                  <el-option label="元/年" value="year" />
                  <el-option label="元/月" value="month" />
                  <el-option label="元/天" value="day" />
                </el-select>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <div class="calc-row">
            <el-button type="primary" plain size="small" @click="calculateExpiry">
              自动计算到期日期
            </el-button>
          </div>
        </el-col>
      </el-row>

      <!-- Reminder -->
      <el-row :gutter="16">
        <el-col :xs="24" :md="12">
          <el-form-item label="提前提醒">
            <el-input v-model.number="form.reminderValue" type="number" :min="0">
              <template #append>
                <el-select v-model="form.reminderUnit" style="width: 80px">
                  <el-option v-for="opt in reminderUnitOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </template>
            </el-input>
            <div class="form-tip">0 = 仅到期时提醒</div>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="选项">
            <div class="option-toggles">
              <el-switch v-model="form.isActive" active-text="启用订阅" />
              <el-switch v-model="form.autoRenew" active-text="自动续订" />
            </div>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- Notes -->
      <el-form-item label="备注">
        <el-input
          v-model="form.notes"
          type="textarea"
          :rows="3"
          placeholder="可添加相关备注信息..."
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '保存中...' : '保存' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.toggle-row {
  margin-bottom: 8px;
}

.lunar-hint {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-top: 4px;
}

.calc-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.option-toggles {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
