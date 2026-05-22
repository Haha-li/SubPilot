<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useSubscriptionStore, type Subscription } from '../stores/subscription';
import { solar2lunar } from '../utils/lunar';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Plus, Search, Delete, CopyDocument, Edit, Bell, VideoPause, VideoPlay, Download, Star } from '@element-plus/icons-vue';
import SubscriptionModal from '../components/SubscriptionModal.vue';
import ImportExportDrawer from '../components/ImportExportDrawer.vue';

const subStore = useSubscriptionStore();

const searchKeyword = ref('');
const categoryFilter = ref('');
const showLunar = ref(localStorage.getItem('showLunar') === 'true');
const statusFilter = ref('');
const sortBy = ref(localStorage.getItem('sortBy') || 'expiry');
const sortOrder = ref(localStorage.getItem('sortOrder') || 'asc');
const showImportExport = ref(false);
const showModal = ref(false);
const editingSub = ref<Subscription | null>(null);
const copyMode = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);

// Bulk selection
const selectMode = ref(false);
const selectedMap = ref<Record<number, boolean>>({});
const selectedCount = computed(() => Object.keys(selectedMap.value).length);

watch([sortBy, sortOrder], () => {
  localStorage.setItem('sortBy', sortBy.value);
  localStorage.setItem('sortOrder', sortOrder.value);
});

const categorySeparator = /[/,，\s]+/;

function normalizeCategoryTokens(category: string): string[] {
  return category.split(categorySeparator).map((t) => t.trim()).filter(Boolean);
}

const allCategories = computed(() => {
  const cats = new Set<string>();
  subStore.subscriptions.forEach((sub) => {
    normalizeCategoryTokens(sub.category || '').forEach((t) => cats.add(t));
  });
  return Array.from(cats).sort((a, b) => a.localeCompare(b, 'zh-CN'));
});

const filteredSubscriptions = computed(() => {
  let list = [...subStore.subscriptions];

  if (categoryFilter.value) {
    list = list.filter((sub) =>
      normalizeCategoryTokens(sub.category || '').some((t) => t.toLowerCase() === categoryFilter.value.toLowerCase())
    );
  }

  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.toLowerCase();
    list = list.filter((sub) => {
      const haystack = [sub.name, sub.customType, sub.notes, sub.category].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(kw);
    });
  }

  if (statusFilter.value) {
    list = list.filter((sub) => {
      if (statusFilter.value === 'active') return sub.isActive;
      if (statusFilter.value === 'inactive') return !sub.isActive;
      if (statusFilter.value === 'expired') {
        return sub.isActive && new Date(sub.expiryDate).getTime() < Date.now();
      }
      if (statusFilter.value === 'soon') {
        if (!sub.isActive) return false;
        const diffDays = Math.ceil((new Date(sub.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }
      return true;
    });
  }

  list.sort((a, b) => {
    // Pinned items first
    const pinDiff = (b.isPinned || 0) - (a.isPinned || 0);
    if (pinDiff !== 0) return pinDiff;

    let cmp = 0;
    if (sortBy.value === 'name') cmp = a.name.localeCompare(b.name, 'zh-CN');
    else if (sortBy.value === 'created') cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    else if (sortBy.value === 'price') cmp = (b.price || 0) - (a.price || 0);
    else cmp = (a.expiryDate || '').localeCompare(b.expiryDate || '');
    return sortOrder.value === 'desc' ? -cmp : cmp;
  });

  return list;
});

const paginatedSubscriptions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredSubscriptions.value.slice(start, start + pageSize.value);
});

watch([searchKeyword, categoryFilter, statusFilter], () => {
  currentPage.value = 1;
  selectedMap.value = {};
});

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  selectedMap.value = {};
}

function toggleSelection(id: number) {
  const next = { ...selectedMap.value };
  if (next[id]) delete next[id]; else next[id] = true;
  selectedMap.value = next;
}

function toggleSelectAll() {
  const allSelected = paginatedSubscriptions.value.every(s => selectedMap.value[s.id]);
  const next: Record<number, boolean> = {};
  if (!allSelected) paginatedSubscriptions.value.forEach(s => { next[s.id] = true; });
  selectedMap.value = next;
}

async function handleBatchToggle(enable: boolean) {
  const ids = Object.keys(selectedMap.value).map(Number);
  for (const id of ids) await subStore.toggleSubscription(id, enable);
  ElMessage.success(enable ? '已批量启用' : '已批量停用');
  selectedMap.value = {};
  selectMode.value = false;
}

async function handleBatchDelete() {
  const count = selectedCount.value;
  try {
    await ElMessageBox.confirm(`确定删除 ${count} 项订阅？`, '批量删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
    const ids = Object.keys(selectedMap.value).map(Number);
    for (const id of ids) await subStore.deleteSubscription(id);
    ElMessage.success(`已删除 ${count} 项`);
    selectedMap.value = {};
    selectMode.value = false;
  } catch {}
}

function getDaysLeft(sub: Subscription): { text: string; type: 'danger' | 'warning' | 'info'; percent: number } {
  const now = new Date();
  const expiry = new Date(sub.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let totalDays = 30;
  if (sub.startDate) {
    const start = new Date(sub.startDate);
    totalDays = Math.max(1, Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }
  const elapsed = totalDays - diffDays;
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));

  if (diffDays < 0) {
    return { text: `已过期 ${Math.abs(diffDays)} 天`, type: 'danger', percent: 100 };
  } else if (diffDays === 0) {
    return { text: '今天到期', type: 'danger', percent: 100 };
  } else if (diffDays <= 7) {
    return { text: `还剩 ${diffDays} 天`, type: 'warning', percent };
  } else {
    return { text: `还剩 ${diffDays} 天`, type: 'info', percent };
  }
}

function getProgressStatus(sub: Subscription): 'exception' | 'warning' | 'success' {
  const now = new Date();
  const expiry = new Date(sub.expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'exception';
  if (diffDays <= 7) return 'warning';
  return 'success';
}

function getStatusType(sub: Subscription): 'danger' | 'warning' | 'success' | 'info' {
  if (!sub.isActive) return 'info';

  const now = new Date();
  const expiry = new Date(sub.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const reminderValue = sub.reminderValue ?? 7;
  const reminderUnit = sub.reminderUnit || 'day';
  const diffHours = diffMs / (1000 * 60 * 60);

  let isSoon = false;
  if (reminderUnit === 'hour') {
    isSoon = diffHours >= 0 && diffHours <= reminderValue;
  } else {
    isSoon = diffDays >= 0 && diffDays <= reminderValue;
  }

  if (diffDays < 0) return 'danger';
  if (isSoon) return 'warning';
  return 'success';
}

function getStatusText(sub: Subscription): string {
  if (!sub.isActive) return '已停用';
  const now = new Date();
  const expiry = new Date(sub.expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const reminderValue = sub.reminderValue ?? 7;
  const reminderUnit = sub.reminderUnit || 'day';
  const diffHours = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

  let isSoon = false;
  if (reminderUnit === 'hour') {
    isSoon = diffHours >= 0 && diffHours <= reminderValue;
  } else {
    isSoon = diffDays >= 0 && diffDays <= reminderValue;
  }

  if (diffDays < 0) return '已过期';
  if (isSoon) return '即将到期';
  return '正常';
}

function getLunarText(dateStr: string): string {
  if (!showLunar.value) return '';
  const d = new Date(dateStr);
  const lunar = solar2lunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return lunar ? lunar.fullStr : '';
}

function getPeriodLabel(sub: Subscription): string {
  if (!sub.periodValue) return '';
  const unitMap: Record<string, string> = { day: '天', month: '月', year: '年' };
  return `${sub.periodValue}${unitMap[sub.periodUnit] || sub.periodUnit}`;
}

function getReminderText(sub: Subscription): string {
  const value = sub.reminderValue ?? 7;
  const unit = sub.reminderUnit || 'day';
  return unit === 'hour' ? `${value}小时前` : `${value}天前`;
}

function openAdd() {
  editingSub.value = null;
  copyMode.value = false;
  showModal.value = true;
}

function openEdit(sub: Subscription) {
  editingSub.value = { ...sub };
  copyMode.value = false;
  showModal.value = true;
}

function handleCopy(sub: Subscription) {
  editingSub.value = { ...sub };
  copyMode.value = true;
  showModal.value = true;
}

async function handleDelete(sub: Subscription) {
  try {
    await ElMessageBox.confirm(`确定删除「${sub.name}」？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await subStore.deleteSubscription(sub.id);
    ElMessage.success('已删除');
  } catch {}
}

async function handleToggle(sub: Subscription) {
  await subStore.toggleSubscription(sub.id, !sub.isActive);
}

async function handlePin(sub: Subscription) {
  await subStore.togglePin(sub.id, !sub.isPinned);
}

async function handleTestNotify(sub: Subscription) {
  const result = await subStore.testNotify(sub.id);
  ElMessage.info(result.message);
}

function toggleLunar() {
  localStorage.setItem('showLunar', String(showLunar.value));
}

onMounted(() => {
  subStore.fetchSubscriptions();
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="dashboard-header">
      <div>
        <h2 class="dashboard-title">订阅管理</h2>
        <p class="dashboard-subtitle">管理您的所有订阅服务</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download" @click="showImportExport = true">导入/导出</el-button>
        <el-button :type="selectMode ? 'primary' : ''" :plain="!selectMode" @click="toggleSelectMode">
          {{ selectMode ? '取消' : '选择' }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加订阅</el-button>
      </div>
    </div>

    <!-- Filters -->
    <el-row :gutter="12" align="middle" class="filter-bar">
      <el-col :xs="24" :sm="8">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索名称、类型或备注..."
          :prefix-icon="Search"
          clearable
        />
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-select v-model="categoryFilter" placeholder="全部分类" clearable style="width: 100%">
          <el-option v-for="cat in allCategories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 100%">
          <el-option label="正常" value="active" />
          <el-option label="已停用" value="inactive" />
          <el-option label="已过期" value="expired" />
          <el-option label="即将到期" value="soon" />
        </el-select>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-select v-model="sortBy" style="width: 100%">
          <el-option label="按到期日" value="expiry" />
          <el-option label="按名称" value="name" />
          <el-option label="按创建时间" value="created" />
          <el-option label="按费用" value="price" />
        </el-select>
      </el-col>
      <el-col :xs="12" :sm="4">
        <div class="filter-right">
          <el-button-group>
            <el-button :type="sortOrder === 'asc' ? 'primary' : ''" size="default" plain @click="sortOrder = 'asc'">升序</el-button>
            <el-button :type="sortOrder === 'desc' ? 'primary' : ''" size="default" plain @click="sortOrder = 'desc'">降序</el-button>
          </el-button-group>
          <el-switch
            v-model="showLunar"
            active-text="农历"
            @change="toggleLunar"
          />
        </div>
      </el-col>
    </el-row>

    <!-- Loading -->
    <div v-if="subStore.loading" class="empty-state">
      <el-icon :size="24" class="is-loading"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- Empty -->
    <el-empty v-else-if="filteredSubscriptions.length === 0" description="暂无订阅">
      <el-button type="primary" @click="openAdd">添加订阅</el-button>
    </el-empty>

    <!-- Card Grid -->
    <div v-else>
      <div class="card-grid">
        <el-card
          v-for="sub in paginatedSubscriptions"
        :key="sub.id"
        shadow="hover"
        :class="{ 'inactive-card': !sub.isActive }"
      >
        <!-- Card Header -->
        <div class="card-header">
          <el-checkbox
            v-if="selectMode"
            :model-value="!!selectedMap[sub.id]"
            @change="toggleSelection(sub.id)"
            class="card-checkbox"
          />
          <div class="card-header-left">
            <h3 class="card-title">
              <el-icon v-if="sub.isPinned" class="pin-icon" @click="handlePin(sub)"><Star /></el-icon>
              {{ sub.name }}
            </h3>
            <span v-if="sub.customType" class="card-type">{{ sub.customType }}</span>
          </div>
          <el-tag :type="getStatusType(sub)" size="small" effect="light">
            {{ getStatusText(sub) }}
          </el-tag>
        </div>

        <!-- Expiry Progress -->
        <div class="card-expiry">
          <div class="expiry-row">
            <span class="expiry-date">{{ sub.expiryDate }}</span>
            <el-tag :type="getDaysLeft(sub).type" size="small" effect="plain">
              {{ getDaysLeft(sub).text }}
            </el-tag>
          </div>
          <el-progress
            :percentage="getDaysLeft(sub).percent"
            :status="getProgressStatus(sub)"
            :stroke-width="6"
            :show-text="false"
          />
          <div v-if="showLunar && getLunarText(sub.expiryDate)" class="lunar-text">
            {{ getLunarText(sub.expiryDate) }}
          </div>
        </div>

        <!-- Tags -->
        <div class="card-tags" v-if="sub.category || sub.periodValue">
          <el-tag v-if="sub.periodValue" size="small" type="info" effect="plain">
            {{ getPeriodLabel(sub) }}
            <span v-if="sub.autoRenew"> 自动续</span>
          </el-tag>
          <el-tag
            v-for="cat in normalizeCategoryTokens(sub.category || '')"
            :key="cat"
            size="small"
            effect="light"
          >
            {{ cat }}
          </el-tag>
        </div>

        <!-- Notes -->
        <p v-if="sub.notes" class="card-notes">{{ sub.notes }}</p>

        <!-- Reminder -->
        <div class="card-reminder">提前 {{ getReminderText(sub) }} 提醒</div>

        <!-- Actions -->
        <div class="card-actions">
          <el-button size="small" :type="sub.isPinned ? 'warning' : ''" plain @click="handlePin(sub)">
            <el-icon><Star /></el-icon> {{ sub.isPinned ? '取消置顶' : '置顶' }}
          </el-button>
          <el-button size="small" type="primary" plain @click="openEdit(sub)">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-button size="small" type="warning" plain @click="handleCopy(sub)">
            <el-icon><CopyDocument /></el-icon> 复制
          </el-button>
          <el-button size="small" type="info" plain @click="handleTestNotify(sub)">
            <el-icon><Bell /></el-icon> 测试
          </el-button>
          <el-button
            size="small"
            :type="sub.isActive ? 'info' : 'success'"
            plain
            @click="handleToggle(sub)"
          >
            <el-icon v-if="sub.isActive"><VideoPause /></el-icon>
            <el-icon v-else><VideoPlay /></el-icon>
            {{ sub.isActive ? '停用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" plain @click="handleDelete(sub)">
            <el-icon><Delete /></el-icon> 删除
          </el-button>
        </div>
      </el-card>
      </div>

      <!-- Batch Action Bar -->
      <transition name="el-fade-in">
        <div v-if="selectMode && selectedCount > 0" class="batch-action-bar">
          <div class="batch-info">
            <el-checkbox
              :model-value="paginatedSubscriptions.length > 0 && paginatedSubscriptions.every(s => selectedMap[s.id])"
              :indeterminate="selectedCount > 0 && !paginatedSubscriptions.every(s => selectedMap[s.id])"
              @change="toggleSelectAll"
            />
            <span>已选择 {{ selectedCount }} 项</span>
          </div>
          <div class="batch-buttons">
            <el-button size="small" type="success" plain @click="handleBatchToggle(true)">批量启用</el-button>
            <el-button size="small" type="info" plain @click="handleBatchToggle(false)">批量停用</el-button>
            <el-button size="small" type="danger" plain @click="handleBatchDelete">批量删除</el-button>
          </div>
        </div>
      </transition>

      <el-pagination
        v-if="filteredSubscriptions.length > pageSize"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredSubscriptions.length"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next"
        background
        class="pagination"
      />
    </div>
    <SubscriptionModal
      v-if="showModal"
      :subscription="editingSub"
      :copy="copyMode"
      @close="showModal = false"
      @saved="showModal = false"
    />
    <ImportExportDrawer
      v-if="showImportExport"
      @close="showImportExport = false"
    />
  </div>
</template>

<style scoped>
.dashboard-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

@media (min-width: 768px) {
  .dashboard-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.dashboard-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.filter-bar {
  margin-bottom: 24px;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.empty-state {
  text-align: center;
  padding: 64px 0;
  color: var(--el-text-color-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.card-grid :deep(.el-card) {
  border-color: #e8ddd0;
  border-radius: 12px;
}

html.dark .card-grid :deep(.el-card) {
  border-color: #3d3830;
}

.inactive-card {
  opacity: 0.7;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-header-left {
  min-width: 0;
  flex: 1;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  display: block;
}

.card-expiry {
  margin-bottom: 12px;
}

.expiry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.expiry-date {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.lunar-text {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-top: 4px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.card-notes {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-reminder {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.card-checkbox {
  margin-right: 8px;
  flex-shrink: 0;
}

.batch-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  margin-top: 16px;
}

.batch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.batch-buttons {
  display: flex;
  gap: 8px;
}

.pin-icon {
  color: var(--el-color-warning);
  cursor: pointer;
  margin-right: 4px;
  vertical-align: middle;
}
</style>
