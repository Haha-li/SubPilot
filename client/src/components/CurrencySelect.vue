<script setup lang="ts">
import { computed, ref } from 'vue';
import { currencies, matchesCurrency } from '../utils/currency';

const props = withDefaults(defineProps<{
  modelValue: string;
  width?: string;
  size?: 'large' | 'default' | 'small';
  placeholder?: string;
  ariaLabel?: string;
}>(), {
  width: '128px',
  size: 'default',
  placeholder: '选择币种',
  ariaLabel: '币种',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const keyword = ref('');

const selected = computed({
  get: () => props.modelValue || 'CNY',
  set: (value: string) => emit('update:modelValue', value),
});

const filteredCurrencies = computed(() => currencies.filter((currency) => matchesCurrency(currency, keyword.value)));

function handleFilter(value: string) {
  keyword.value = value;
}

function handleVisibleChange(visible: boolean) {
  if (!visible) keyword.value = '';
}
</script>

<template>
  <el-select
    v-model="selected"
    filterable
    :filter-method="handleFilter"
    :style="{ width }"
    :size="size"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
    no-match-text="无匹配币种"
    @visible-change="handleVisibleChange"
  >
    <el-option
      v-for="currency in filteredCurrencies"
      :key="currency.code"
      :label="currency.code"
      :value="currency.code"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="w-12 shrink-0 font-mono-nums text-xs font-semibold text-ink-900 dark:text-ink-50">
          {{ currency.code }}
        </span>
        <span class="w-9 shrink-0 truncate text-xs text-ink-500 dark:text-ink-400">
          {{ currency.symbol }}
        </span>
        <span class="truncate text-xs text-ink-600 dark:text-ink-300" :title="currency.label">
          {{ currency.label }}
        </span>
      </div>
    </el-option>
  </el-select>
</template>
