<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import api from '../utils/api';

const config = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);
const showPreview = ref(false);

const defaultTemplate = `📋 订阅提醒
━━━━━━━━━━━━━━
名称: {{name}}
类型: {{type}}
到期: {{expiryDate}}
状态: {{status}}
剩余: {{daysLeft}} 天
农历: {{lunar}}
备注: {{notes}}`;

function renderPreview(template: string) {
  const today = new Date();
  const expiryDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
  const yyyy = expiryDate.getFullYear();
  const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expiryDate.getDate()).padStart(2, '0');

  return (template || defaultTemplate)
    .replace(/\{\{name\}\}/g, '示例订阅')
    .replace(/\{\{type\}\}/g, '视频会员')
    .replace(/\{\{expiryDate\}\}/g, `${yyyy}-${mm}-${dd}`)
    .replace(/\{\{status\}\}/g, '还有 10 天到期')
    .replace(/\{\{daysLeft\}\}/g, '10')
    .replace(/\{\{lunar\}\}/g, '四月十五')
    .replace(/\{\{notes\}\}/g, '这是一条示例备注');
}

const previewText = computed(() => renderPreview(config.value.notify_template));

const channels = [
  { key: 'telegram', name: 'Telegram', desc: '通过 Telegram Bot 推送', visible: true },
  { key: 'wechat', name: '企业微信', desc: '通过企业微信群机器人推送', visible: false },
  { key: 'bark', name: 'Bark (iOS)', desc: '通过 Bark App 推送到 iOS', visible: false },
  { key: 'webhook', name: 'Webhook', desc: '自定义 HTTP 回调', visible: false },
  { key: 'email', name: '邮件 (Resend)', desc: '通过 Resend API 发送邮件', visible: false },
  { key: 'notifyx', name: 'NotifyX', desc: '通过 NotifyX 服务推送', visible: false },
];

const visibleChannels = computed(() => channels.filter(c => c.visible));

const activeChannels = ref<string[]>([]);

async function loadConfig() {
  loading.value = true;
  try {
    const { data } = await api.get('/config');
    if (!data.notify_template) {
      data.notify_template = defaultTemplate;
    }
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
    const { data } = await api.post('/config/test-notify', { channel, config: config.value });
    if (data.success) {
      ElMessage.success('测试成功，配置已保存');
      await saveConfig();
    } else {
      ElMessage.warning(data.message || '发送失败，请检查配置');
    }
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
              <el-form-item label="检查时间 (小时)">
                <el-input v-model="config.notify_hours" placeholder="留空则每天执行一次" />
                <div class="form-tip">多个时间用逗号或空格分隔，如: 8,12,18 或 8 12 18；留空则每天执行一次</div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>

      <!-- Notify Template -->
      <el-card shadow="never">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="section-title">通知模板</span>
            <el-button size="small" @click="showPreview = !showPreview">
              {{ showPreview ? '编辑' : '预览' }}
            </el-button>
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item>
            <el-input
              v-if="!showPreview"
              v-model="config.notify_template"
              type="textarea"
              :rows="8"
            />
            <pre v-else class="template-preview">{{ previewText }}</pre>
            <div class="form-tip">
              <span v-pre>变量: <code>{{name}}</code> <code>{{type}}</code> <code>{{expiryDate}}</code> <code>{{status}}</code> <code>{{daysLeft}}</code> <code>{{lunar}}</code> <code>{{notes}}</code></span>
            </div>
          </el-form-item>
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
            v-for="ch in visibleChannels"
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

        <!-- WeChat Config -->
        <el-collapse-transition>
          <div v-if="activeChannels.includes('wechat')" class="channel-config">
            <div class="config-section-header">
              <h4>企业微信配置</h4>
              <el-button size="small" type="primary" plain @click="testChannel('wechat')">测试</el-button>
            </div>
            <el-form label-position="top">
              <el-form-item label="Webhook URL">
                <el-input v-model="config.wechat_webhook" placeholder="企业微信群机器人 Webhook 地址" />
              </el-form-item>
            </el-form>
          </div>
        </el-collapse-transition>

        <!-- Bark Config -->
        <el-collapse-transition>
          <div v-if="activeChannels.includes('bark')" class="channel-config">
            <div class="config-section-header">
              <h4>Bark 配置</h4>
              <el-button size="small" type="primary" plain @click="testChannel('bark')">测试</el-button>
            </div>
            <el-form label-position="top">
              <el-row :gutter="16">
                <el-col :xs="24" :md="12">
                  <el-form-item label="服务器地址">
                    <el-input v-model="config.bark_url" placeholder="https://api.day.app" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="12">
                  <el-form-item label="设备 Key">
                    <el-input v-model="config.bark_key" placeholder="在 Bark App 内复制" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </el-collapse-transition>

        <!-- Webhook Config -->
        <el-collapse-transition>
          <div v-if="activeChannels.includes('webhook')" class="channel-config">
            <div class="config-section-header">
              <h4>Webhook 配置</h4>
              <el-button size="small" type="primary" plain @click="testChannel('webhook')">测试</el-button>
            </div>
            <el-form label-position="top">
              <el-row :gutter="16">
                <el-col :xs="24" :md="12">
                  <el-form-item label="推送 URL">
                    <el-input v-model="config.webhook_url" placeholder="https://your-service.com/hooks" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="12">
                  <el-form-item label="请求方法">
                    <el-select v-model="config.webhook_method" style="width: 100%">
                      <el-option label="POST" value="POST" />
                      <el-option label="PUT" value="PUT" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="请求头 (JSON)">
                <el-input v-model="config.webhook_headers" placeholder='{"Authorization": "Bearer xxx"}' />
              </el-form-item>
              <el-form-item label="消息模板">
                <el-input v-model="config.webhook_template" placeholder="{{formattedMessage}}" />
                <div class="form-tip">
                  可用变量: <code v-pre>{{title}}, {{content}}, {{tags}}, {{tagsLine}}, {{timestamp}}, {{formattedMessage}}</code>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-collapse-transition>

        <!-- Email Config -->
        <el-collapse-transition>
          <div v-if="activeChannels.includes('email')" class="channel-config">
            <div class="config-section-header">
              <h4>邮件配置 (Resend)</h4>
              <el-button size="small" type="primary" plain @click="testChannel('email')">测试</el-button>
            </div>
            <el-form label-position="top">
              <el-row :gutter="16">
                <el-col :xs="24" :md="8">
                  <el-form-item label="API Key">
                    <el-input v-model="config.email_api_key" placeholder="Resend API Key" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="8">
                  <el-form-item label="发件人邮箱">
                    <el-input v-model="config.email_from" placeholder="notify@yourdomain.com" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="8">
                  <el-form-item label="收件人邮箱">
                    <el-input v-model="config.email_to" placeholder="you@example.com" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </el-collapse-transition>

        <!-- NotifyX Config -->
        <el-collapse-transition>
          <div v-if="activeChannels.includes('notifyx')" class="channel-config">
            <div class="config-section-header">
              <h4>NotifyX 配置</h4>
              <el-button size="small" type="primary" plain @click="testChannel('notifyx')">测试</el-button>
            </div>
            <el-form label-position="top">
              <el-form-item label="API Key">
                <el-input v-model="config.notifyx_api_key" placeholder="从 NotifyX 官网获取" />
              </el-form-item>
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

.template-preview {
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  min-height: 180px;
}
</style>
