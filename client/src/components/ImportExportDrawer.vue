<script setup lang="ts">
import { ref } from 'vue';
import { useSubscriptionStore } from '../stores/subscription';
import { ElMessage } from 'element-plus';
import { Download, Upload, Document } from '@element-plus/icons-vue';
import api from '../utils/api';

const emit = defineEmits<{ close: [] }>();
const subStore = useSubscriptionStore();

const drawerVisible = ref(true);
const importing = ref(false);
const exporting = ref(false);
const importFormat = ref('json');
const importResult = ref('');

async function handleExport(format: string) {
  exporting.value = true;
  try {
    const response = await api.get(`/subscriptions/export?format=${format}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出为 ${format.toUpperCase()} 文件`);
  } catch (e: any) {
    ElMessage.error('导出失败: ' + (e.message || '未知错误'));
  } finally {
    exporting.value = false;
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const data = reader.result as string;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const format = ext === 'csv' ? 'csv' : 'json';

    importing.value = true;
    importResult.value = '';
    try {
      const { data: result } = await api.post('/subscriptions/import', { format, data });
      if (result.success) {
        importResult.value = `导入成功: ${result.imported}/${result.total} 条`;
        if (result.errors?.length) {
          importResult.value += `\n跳过: ${result.errors.join('\n')}`;
        }
        await subStore.fetchSubscriptions();
        ElMessage.success(`成功导入 ${result.imported} 条订阅`);
      } else {
        importResult.value = result.message || '导入失败';
        ElMessage.error(importResult.value);
      }
    } catch (e: any) {
      importResult.value = '导入失败: ' + (e.response?.data?.message || e.message);
      ElMessage.error(importResult.value);
    } finally {
      importing.value = false;
      input.value = '';
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="导入 / 导出"
    size="400px"
    @close="emit('close')"
  >
    <!-- Export -->
    <div class="section">
      <h4 class="section-title">导出订阅数据</h4>
      <p class="section-desc">将所有订阅数据导出为文件</p>
      <div class="btn-group">
        <el-button :icon="Download" :loading="exporting" @click="handleExport('json')">
          导出 JSON
        </el-button>
        <el-button :icon="Download" :loading="exporting" @click="handleExport('csv')">
          导出 CSV
        </el-button>
      </div>
    </div>

    <el-divider />

    <!-- Import -->
    <div class="section">
      <h4 class="section-title">导入订阅数据</h4>
      <p class="section-desc">从 JSON 或 CSV 文件导入订阅</p>
      <div class="btn-group">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".json,.csv"
          :on-change="(file: any) => handleFileChange({ target: { files: [file.raw] } } as any)"
        >
          <el-button :icon="Upload" :loading="importing">
            选择文件导入
          </el-button>
        </el-upload>
      </div>
      <div v-if="importResult" class="import-result">
        <el-icon><Document /></el-icon>
        <pre>{{ importResult }}</pre>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.section {
  padding: 8px 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.section-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}

.btn-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.import-result {
  margin-top: 16px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.import-result pre {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
