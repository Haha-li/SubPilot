<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import api from '../utils/api';

const config = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);

const channels = [
  { key: 'telegram', name: 'Telegram', desc: '通过 Telegram Bot 推送' },
];

const activeChannels = ref<string[]>([]);

async function loadConfig() {
  loading.value = true;
  try {
    const { data } = await api.get('/config');
    config.value = data;
    activeChannels.value = (data.notify_channels || '').split(',').filter(Boolean);
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    config.value.notify_channels = activeChannels.value.join(',');
    const { data } = await api.put('/config', config.value);
    if (data.success) {
      ElMessage.success('配置已保存');
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function testChannel(channel: string) {
  try {
    const { data } = await api.post('/config/test-notify', { channel });
    ElMessage.info(data.message);
  } catch (e: any) {
    ElMessage.error('测试失败: ' + (e.response?.data?.message || e.message));
  }
}

function toggleChannel(channel: string) {
  const idx = activeChannels.value.indexOf(channel);
  if (idx >= 0) {
    activeChannels.value.splice(idx, 1);
  } else {
    activeChannels.value.push(channel);
  }
}

onMounted(loadConfig);
</script>

<template>
  <div>
    <div class="config-header">
      <h2 class="config-title">系统配置</h2>
      <p class="config-subtitle">管理系统参数和通知渠道</p>
    </div>

    <div v-loading="loading" class="config-sections">
      <!-- Basic Settings -->
      <el-card shadow="never">
        <template #header>
          <span class="section-title">基本设置</span>
        </template>
        <el-form label-position="top" :model="config">
          <el-row :gutter="20">
            <el-col :xs="24" :md="12">
              <el-form-item label="系统时区">
                <el-select v-model="config.timezone" style="width: 100%">
                  <el-option label="中国标准时间 (UTC+8)" value="Asia/Shanghai" />
                  <el-option label="香港时间 (UTC+8)" value="Asia/Hong_Kong" />
                  <el-option label="日本时间 (UTC+9)" value="Asia/Tokyo" />
                  <el-option label="美国东部时间" value="America/New_York" />
                  <el-option label="美国太平洋时间" value="America/Los_Angeles" />
                  <el-option label="英国时间" value="Europe/London" />
                  <el-option label="UTC" value="UTC" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="提醒时间 (小时，逗号分隔)">
                <el-input v-model="config.notify_hours" placeholder="8" />
                <div class="form-tip">如: 8,12,18 表示在这些小时触发检查</div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>

      <!-- Notification Channels -->
      <el-card shadow="never">
        <template #header>
          <div>
            <span class="section-title">通知渠道</span>
            <span class="section-desc">选择要启用的通知渠道</span>
          </div>
        </template>

        <div class="channel-grid">
          <div
            v-for="ch in channels"
            :key="ch.key"
            :class="['channel-card', { active: activeChannels.includes(ch.key) }]"
            @click="toggleChannel(ch.key)"
          >
            <div :class="['channel-icon', { active: activeChannels.includes(ch.key) }]">
              {{ ch.key[0].toUpperCase() }}
            </div>
            <div class="channel-info">
              <div class="channel-name">{{ ch.name }}</div>
              <div class="channel-desc">{{ ch.desc }}</div>
            </div>
            <el-icon v-if="activeChannels.includes(ch.key)" class="channel-check" :size="16" color="#f59e0b">
              <Check />
            </el-icon>
          </div>
        </div>

        <!-- Telegram Config -->
        <el-collapse-transition>
          <div v-if="activeChannels.includes('telegram')" class="channel-config">
            <div class="config-section-header">
              <h4>Telegram 配置</h4>
              <el-button size="small" type="primary" plain @click="testChannel('telegram')">测试</el-button>
            </div>
            <el-form label-position="top">
              <el-row :gutter="16">
                <el-col :xs="24" :md="12">
                  <el-form-item label="Bot Token">
                    <el-input v-model="config.telegram_bot_token" placeholder="从 @BotFather 获取" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="12">
                  <el-form-item label="Chat ID">
                    <el-input v-model="config.telegram_chat_id" placeholder="从 @userinfobot 获取" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </el-collapse-transition>

      </el-card>


      <!-- Save Button -->
      <div class="save-bar">
        <el-button type="primary" size="large" :loading="saving" @click="saveConfig">
          {{ saving ? '保存中...' : '保存所有配置' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-header {
  margin-bottom: 24px;
}

.config-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.config-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.channel-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

@media (min-width: 640px) {
  .channel-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .channel-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.channel-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.channel-card:hover {
  border-color: var(--el-border-color-darker);
}

.channel-card.active {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.channel-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  background-color: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.channel-icon.active {
  background-color: var(--el-color-primary);
  color: white;
}

.channel-info {
  min-width: 0;
}

.channel-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.channel-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.channel-check {
  position: absolute;
  top: 8px;
  right: 8px;
}

.channel-config {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.config-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.config-section-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.save-bar {
  display: flex;
  justify-content: flex-end;
}
</style>
