<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubscriptionStore } from '../stores/subscription';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Edit, Delete } from '@element-plus/icons-vue';
import api from '../utils/api';

const subStore = useSubscriptionStore();
const categorySeparator = /[/,，\s]+/;

function normalizeCategoryTokens(category: string): string[] {
  return (category || '').split(categorySeparator).map(t => t.trim()).filter(Boolean);
}

interface CategoryInfo {
  name: string;
  count: number;
  color: string;
}

const defaultColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#00ACC1', '#8E24AA', '#FF7043'];
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
  subStore.subscriptions.forEach(sub => {
    normalizeCategoryTokens(sub.category).forEach(t => {
      map[t] = (map[t] || 0) + 1;
    });
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count, color: getColor(name) }))
    .sort((a, b) => b.count - a.count);
});

function startRename(cat: CategoryInfo) {
  editingCategory.value = cat.name;
  editName.value = cat.name;
}

function cancelRename() {
  editingCategory.value = null;
}

async function confirmRename() {
  if (!editingCategory.value || !editName.value.trim()) return;
  const oldName = editingCategory.value;
  const newName = editName.value.trim();
  if (oldName === newName) { cancelRename(); return; }

  const affected = subStore.subscriptions.filter(sub =>
    normalizeCategoryTokens(sub.category).includes(oldName)
  );

  for (const sub of affected) {
    const tokens = normalizeCategoryTokens(sub.category).map(t => t === oldName ? newName : t);
    await api.put(`/subscriptions/${sub.id}`, { category: tokens.join(', ') });
  }

  if (categoryColors.value[oldName]) {
    categoryColors.value[newName] = categoryColors.value[oldName];
    delete categoryColors.value[oldName];
    localStorage.setItem('categoryColors', JSON.stringify(categoryColors.value));
  }

  await subStore.fetchSubscriptions();
  ElMessage.success(`已重命名为「${newName}」`);
  cancelRename();
}

async function handleDelete(cat: CategoryInfo) {
  await ElMessageBox.confirm(`确定删除分类「${cat.name}」？将从 ${cat.count} 个订阅中移除。`, '确认删除', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });

  const affected = subStore.subscriptions.filter(sub =>
    normalizeCategoryTokens(sub.category).includes(cat.name)
  );

  for (const sub of affected) {
    const tokens = normalizeCategoryTokens(sub.category).filter(t => t !== cat.name);
    await api.put(`/subscriptions/${sub.id}`, { category: tokens.join(', ') });
  }

  delete categoryColors.value[cat.name];
  localStorage.setItem('categoryColors', JSON.stringify(categoryColors.value));
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
    <div class="page-header">
      <h2 class="page-title">分类管理</h2>
      <p class="page-subtitle">管理订阅分类标签，重命名或删除分类</p>
    </div>

    <el-empty v-if="categories.length === 0" description="暂无分类标签" />

    <div v-else class="category-grid">
      <el-card v-for="cat in categories" :key="cat.name" shadow="hover" class="category-card">
        <div class="cat-header">
          <div class="cat-color-row">
            <div
              class="cat-color-dot"
              :style="{ background: cat.color }"
            >
              <input
                type="color"
                :value="cat.color"
                class="color-input"
                @input="(e: any) => updateColor(cat.name, e.target.value)"
              />
            </div>
            <template v-if="editingCategory === cat.name">
              <el-input v-model="editName" size="small" class="cat-rename-input" @keyup.enter="confirmRename" />
            </template>
            <template v-else>
              <span class="cat-name">{{ cat.name }}</span>
            </template>
          </div>
          <el-tag size="small" type="info">{{ cat.count }} 项</el-tag>
        </div>

        <div class="cat-actions">
          <template v-if="editingCategory === cat.name">
            <el-button size="small" type="primary" plain @click="confirmRename">确认</el-button>
            <el-button size="small" @click="cancelRename">取消</el-button>
          </template>
          <template v-else>
            <el-button size="small" type="primary" plain @click="startRename(cat)">
              <el-icon><Edit /></el-icon> 重命名
            </el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(cat)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </template>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.category-card :deep(.el-card__body) {
  padding: 16px;
}

.cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cat-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cat-color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.color-input {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 28px;
  height: 28px;
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0;
}

.cat-color-dot:hover {
  box-shadow: 0 0 0 2px var(--el-color-primary-light-3);
}

.cat-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-rename-input {
  flex: 1;
  max-width: 160px;
}

.cat-actions {
  display: flex;
  gap: 8px;
}
</style>
