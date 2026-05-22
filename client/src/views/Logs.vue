<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useNotifyLogsStore, type NotifyLog } from '../stores/notifyLogs';
import { useSubscriptionStore } from '../stores/subscription';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Search, Delete } from '@element-plus/icons-vue';

const logsStore = useNotifyLogsStore();
const subStore = useSubscriptionStore();

const subscriptionId = ref('');
const channel = ref('');
const status = ref('');
const startDate = ref('');
const endDate = ref('');
const currentPage = ref(1);
const pageSize = ref(20);

const detailVisible = ref(false);
const detailLog = ref<NotifyLog | null>(null);

const channelMap: Record<string, string> = {
  telegram: 'Telegram',
  wechat: '企业微信',
  bark: 'Bark',
  webhook: 'Webhook',
  email: '邮件',
  notifyx: 'NotifyX',
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

onMounted(() => {
  fetchLogs();
  if (subStore.subscriptions.length === 0) {
    subStore.fetchSubscriptions();
  }
});
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">通知日志</h2>
        <p class="page-subtitle">查看通知发送记录</p>
      </div>
      <el-button type="danger" plain :icon="Delete" @click="handleClear">清空日志</el-button>
    </div>

    <!-- Filters -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="12">
        <el-col :xs="24" :sm="6">
          <el-select v-model="subscriptionId" placeholder="全部订阅" clearable style="width: 100%" @change="handleFilterChange">
            <el-option v-for="sub in subStore.subscriptions" :key="sub.id" :label="sub.name" :value="String(sub.id)" />
          </el-select>
        </el-col>
        <el-col :xs="12" :sm="4">
          <el-select v-model="channel" placeholder="全部渠道" clearable style="width: 100%" @change="handleFilterChange">
            <el-option label="Telegram" value="telegram" />
            <el-option label="企业微信" value="wechat" />
            <el-option label="Bark" value="bark" />
            <el-option label="Webhook" value="webhook" />
            <el-option label="邮件" value="email" />
            <el-option label="NotifyX" value="notifyx" />
          </el-select>
        </el-col>
        <el-col :xs="12" :sm="4">
          <el-select v-model="status" placeholder="全部状态" clearable style="width: 100%" @change="handleFilterChange">
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-col>
        <el-col :xs="12" :sm="5">
          <el-date-picker
            v-model="startDate"
            type="date"
            placeholder="开始日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="handleFilterChange"
          />
        </el-col>
        <el-col :xs="12" :sm="5">
          <el-date-picker
            v-model="endDate"
            type="date"
            placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="handleFilterChange"
          />
        </el-col>
      </el-row>
    </el-card>

    <!-- Table -->
    <el-card shadow="never">
      <el-table :data="logsStore.logs" v-loading="logsStore.loading" stripe style="width: 100%">
        <el-table-column label="订阅" prop="subscriptionName" width="140" />
        <el-table-column label="渠道" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ channelMap[row.channel] || row.channel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small" effect="light">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消息" prop="message" show-overflow-tooltip />
        <el-table-column label="时间" prop="createdAt" width="180" />
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-if="logsStore.total > pageSize"
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="logsStore.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="handlePageChange"
          @size-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog v-model="detailVisible" title="通知详情" width="560px" @close="detailLog = null">
      <template v-if="detailLog">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="订阅">{{ detailLog.subscriptionName }}</el-descriptions-item>
          <el-descriptions-item label="渠道">{{ channelMap[detailLog.channel] || detailLog.channel }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detailLog.status === 'success' ? 'success' : 'danger'" size="small" effect="light">
              {{ detailLog.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="时间">{{ detailLog.createdAt }}</el-descriptions-item>
          <el-descriptions-item v-if="detailLog.message" label="结果">{{ detailLog.message }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="detailLog.content" class="detail-content">
          <div class="detail-content-label">推送内容</div>
          <pre class="detail-content-text">{{ detailLog.content }}</pre>
        </div>
        <div v-else class="detail-empty">暂无推送内容记录</div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
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

.filter-card {
  margin-bottom: 20px;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.detail-content {
  margin-top: 16px;
}

.detail-content-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.detail-content-text {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  color: var(--el-text-color-primary);
}

.detail-empty {
  margin-top: 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
