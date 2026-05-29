<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubscriptionStore } from '../stores/subscription';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Pencil, Trash2, Plus, Check, X, Tag as TagIcon, Palette } from '@lucide/vue';
import api from '../utils/api';

const subStore = useSubscriptionStore();
const categorySeparator = /[/,，\s]+/;

const newCategoryName = ref('');
const customCategories = ref<string[]>(JSON.parse(localStorage.getItem('customCategories') || '[]'));

function normalizeCategoryTokens(category: string): string[] {
  return (category || '').split(categorySeparator).map((t) => t.trim()).filter(Boolean);
}

interface CategoryInfo {
  name: string;
  count: number;
  color: string;
}

const defaultColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#A855F7', '#EC4899', '#F97316'];
const categoryColors = ref<Record<string, string>>(JSON.parse(localStorage.getItem('categoryColors') || '{}'));
const editingCategory = ref<string | null>(null);
const editName = ref('');

function getColor(name: string): string {
  if (categoryColors.value[name]) return categoryColors.value[name];
  const idx = Math.abs(name.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 0)) % defaultColors.length;
  return defaultColors[idx];
}

const categories = computed<CategoryInfo[]>(() => {
  const map: Record<string, number> = {};
  subStore.subscriptions.forEach((sub) => {
    normalizeCategoryTokens(sub.category).forEach((t) => {
      map[t] = (map[t] || 0) + 1;
    });
  });
  customCategories.value.forEach((c) => {
    if (!(c in map)) map[c] = 0;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count, color: getColor(name) }))
    .sort((a, b) => b.count - a.count);
});

const usedCount = computed(() => categories.value.filter((c) => c.count > 0).length);

function startRename(cat: CategoryInfo) {
  editingCategory.value = cat.name;
  editName.value = cat.name;
}

function cancelRename() {
  editingCategory.value = null;
}

function handleAdd() {
  const name = newCategoryName.value.trim();
  if (!name) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  const sep = /[/,，\s]+/;
  const tokens = name.split(sep).map((t) => t.trim()).filter(Boolean);
  let added = 0;
  let skipped = 0;
  tokens.forEach((t) => {
    if (customCategories.value.includes(t) || categories.value.some((c) => c.name === t)) {
      skipped++;
    } else {
      customCategories.value.push(t);
      added++;
    }
  });
  if (added > 0) {
    localStorage.setItem('customCategories', JSON.stringify(customCategories.value));
    ElMessage.success(`已添加 ${added} 个分类`);
  } else if (skipped > 0) {
    ElMessage.info('分类已存在');
  }
  newCategoryName.value = '';
}

async function confirmRename() {
  if (!editingCategory.value || !editName.value.trim()) return;
  const oldName = editingCategory.value;
  const newName = editName.value.trim();
  if (oldName === newName) {
    cancelRename();
    return;
  }

  const affected = subStore.subscriptions.filter((sub) =>
    normalizeCategoryTokens(sub.category).includes(oldName),
  );

  for (const sub of affected) {
    const tokens = normalizeCategoryTokens(sub.category).map((t) => (t === oldName ? newName : t));
    await api.put(`/subscriptions/${sub.id}`, { category: tokens.join(', ') });
  }

  if (categoryColors.value[oldName]) {
    categoryColors.value[newName] = categoryColors.value[oldName];
    delete categoryColors.value[oldName];
    localStorage.setItem('categoryColors', JSON.stringify(categoryColors.value));
  }

  const idx = customCategories.value.indexOf(oldName);
  if (idx >= 0) {
    customCategories.value[idx] = newName;
    localStorage.setItem('customCategories', JSON.stringify(customCategories.value));
  }

  await subStore.fetchSubscriptions();
  ElMessage.success(`已重命名为「${newName}」`);
  cancelRename();
}

async function handleDelete(cat: CategoryInfo) {
  try {
    await ElMessageBox.confirm(
      `确定删除分类「${cat.name}」？将从 ${cat.count} 个订阅中移除。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  const affected = subStore.subscriptions.filter((sub) =>
    normalizeCategoryTokens(sub.category).includes(cat.name),
  );

  for (const sub of affected) {
    const tokens = normalizeCategoryTokens(sub.category).filter((t) => t !== cat.name);
    await api.put(`/subscriptions/${sub.id}`, { category: tokens.join(', ') });
  }

  delete categoryColors.value[cat.name];
  localStorage.setItem('categoryColors', JSON.stringify(categoryColors.value));
  customCategories.value = customCategories.value.filter((c) => c !== cat.name);
  localStorage.setItem('customCategories', JSON.stringify(customCategories.value));
  await subStore.fetchSubscriptions();
  ElMessage.success('已删除分类');
}

function updateColor(name: string, color: string) {
  categoryColors.value[name] = color;
  localStorage.setItem('categoryColors', JSON.stringify(categoryColors.value));
}

onMounted(() => {
  if (subStore.subscriptions.length === 0) subStore.fetchSubscriptions();
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">分类管理</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">
          共 <span class="font-mono-nums font-semibold text-ink-700 dark:text-ink-200">{{ categories.length }}</span> 个分类，其中
          <span class="font-mono-nums font-semibold text-ink-700 dark:text-ink-200">{{ usedCount }}</span> 个使用中
        </p>
      </div>
      <form class="flex items-center gap-2" @submit.prevent="handleAdd">
        <div class="relative">
          <TagIcon :size="16" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            v-model="newCategoryName"
            type="text"
            placeholder="新分类名称（支持空格分隔）"
            class="block w-56 rounded-xl border border-ink-200 bg-white/60 py-2 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50 dark:placeholder:text-ink-500"
          />
        </div>
        <button
          type="submit"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg active:scale-[0.98]"
        >
          <Plus :size="16" />
          新增
        </button>
      </form>
    </div>

    <!-- Empty -->
    <div
      v-if="categories.length === 0"
      class="bento-card flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300">
        <TagIcon :size="28" />
      </div>
      <p class="mt-4 text-base font-medium text-ink-700 dark:text-ink-200">暂无分类标签</p>
      <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">在订阅中添加分类，或在上方手动新增</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <article
        v-for="cat in categories"
        :key="cat.name"
        class="bento-card group relative overflow-hidden p-5"
      >
        <!-- color stripe -->
        <span
          class="absolute left-0 top-0 h-full w-1"
          :style="{ background: cat.color }"
        />

        <!-- Header -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <label
              class="relative flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ring-white/40 transition-transform hover:scale-105"
              :style="{ background: cat.color }"
              :title="`点击修改颜色 · ${cat.color}`"
            >
              <Palette :size="14" class="text-white/90" />
              <input
                type="color"
                :value="cat.color"
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                @input="(e: any) => updateColor(cat.name, e.target.value)"
              />
            </label>

            <div v-if="editingCategory === cat.name" class="min-w-0 flex-1">
              <input
                v-model="editName"
                type="text"
                class="block w-full rounded-lg border border-ink-200 bg-white/80 px-2.5 py-1.5 text-sm font-semibold text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/60 dark:text-ink-50"
                @keyup.enter="confirmRename"
                @keyup.escape="cancelRename"
              />
            </div>
            <h3 v-else class="min-w-0 flex-1 truncate text-base font-semibold text-ink-900 dark:text-ink-50">{{ cat.name }}</h3>
          </div>

          <span
            class="font-mono-nums inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="cat.count > 0
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
              : 'bg-ink-100 text-ink-500 dark:bg-ink-800/60 dark:text-ink-400'"
          >
            {{ cat.count }} 项
          </span>
        </div>

        <!-- Actions -->
        <div class="mt-4 flex items-center gap-2">
          <template v-if="editingCategory === cat.name">
            <button
              class="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/15"
              @click="confirmRename"
            >
              <Check :size="14" /> 确认
            </button>
            <button
              class="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-200 dark:bg-ink-800/60 dark:text-ink-300"
              @click="cancelRename"
            >
              <X :size="14" /> 取消
            </button>
          </template>
          <template v-else>
            <button
              class="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-ink-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
              @click="startRename(cat)"
            >
              <Pencil :size="14" /> 重命名
            </button>
            <button
              class="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-danger/10 hover:text-danger dark:text-ink-300"
              @click="handleDelete(cat)"
            >
              <Trash2 :size="14" /> 删除
            </button>
          </template>
        </div>
      </article>
    </div>
  </div>
</template>
