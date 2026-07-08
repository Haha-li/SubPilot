<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Send, Bell, Globe2, Clock, FileCode2, Check, Sparkles, Save, Loader2,
} from '@lucide/vue';
import api from '../utils/api';

const config = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);

const defaultTemplate = `📋 订阅提醒
━━━━━━━━━━━━━━
名称: {{name}}
类型: {{type}}
到期: {{expiryDate}}
状态: {{status}}
剩余: {{daysLeft}} 天
费用: {{price}}
周期: {{period}}
续费: {{autoRenew}}
提醒: {{reminder}}
农历: {{lunar}}
备注: {{notes}}
时间: {{time}}
时区: {{timezone}}`;

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
    .replace(/\{\{notes\}\}/g, '这是一条示例备注')
    .replace(/\{\{price\}\}/g, '¥25.00/月')
    .replace(/\{\{period\}\}/g, '1月')
    .replace(/\{\{autoRenew\}\}/g, '自动续费')
    .replace(/\{\{reminder\}\}/g, '7天前')
    .replace(/\{\{time\}\}/g, new Date().toLocaleString('zh-CN', { timeZone: config.value.timezone || 'Asia/Shanghai' }))
    .replace(/\{\{timezone\}\}/g, config.value.timezone || 'Asia/Shanghai');
}

const previewText = computed(() => renderPreview(config.value.notify_template));

const channels = [
  { key: 'telegram', name: 'Telegram',     desc: '通过 Telegram Bot 推送',      visible: true,  tone: 'sky'    },
  { key: 'wechat',   name: '企业微信',      desc: '通过企业微信群机器人推送',     visible: false, tone: 'emerald' },
  { key: 'bark',     name: 'Bark (iOS)',   desc: '通过 Bark App 推送到 iOS',    visible: true,  tone: 'rose'   },
  { key: 'pushplus', name: 'PushPlus',      desc: '通过推送加发送跨平台通知',     visible: true,  tone: 'emerald' },
  { key: 'webhook',  name: 'Webhook',      desc: '自定义 HTTP 回调',           visible: false, tone: 'violet' },
  { key: 'email',    name: '邮件 (Resend)', desc: '通过 Resend API 发送邮件',   visible: false, tone: 'amber'  },
  { key: 'notifyx',  name: 'NotifyX',      desc: '通过 NotifyX 服务推送',      visible: false, tone: 'cyan'   },
];

const visibleChannels = computed(() => channels.filter((c) => c.visible));

const toneClasses: Record<string, { bg: string; text: string; ring: string }> = {
  sky:     { bg: 'bg-sky-100 dark:bg-sky-500/15',         text: 'text-sky-600 dark:text-sky-300',         ring: 'ring-sky-500' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-300', ring: 'ring-emerald-500' },
  rose:    { bg: 'bg-rose-100 dark:bg-rose-500/15',       text: 'text-rose-600 dark:text-rose-300',       ring: 'ring-rose-500' },
  violet:  { bg: 'bg-violet-100 dark:bg-violet-500/15',   text: 'text-violet-600 dark:text-violet-300',   ring: 'ring-violet-500' },
  amber:   { bg: 'bg-amber-100 dark:bg-amber-500/15',     text: 'text-amber-600 dark:text-amber-300',     ring: 'ring-amber-500' },
  cyan:    { bg: 'bg-cyan-100 dark:bg-cyan-500/15',       text: 'text-cyan-600 dark:text-cyan-300',       ring: 'ring-cyan-500' },
};

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

async function testTemplate() {
  const channel = activeChannels.value[0] || 'telegram';
  try {
    const { data } = await api.post('/config/test-notify', { channel, config: config.value, mode: 'template' });
    if (data.success) {
      ElMessage.success('测试通知已发送');
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
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="font-heading text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">系统配置</h2>
        <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">管理时区、通知模板与推送渠道</p>
      </div>
      <button
        class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
        :disabled="saving"
        @click="saveConfig"
      >
        <component :is="saving ? Loader2 : Save" :size="16" :class="saving && 'animate-spin'" />
        {{ saving ? '保存中...' : '保存所有配置' }}
      </button>
    </div>

    <div v-loading="loading" class="space-y-5">
      <!-- Basic Settings -->
      <section class="bento-card p-5">
        <header class="mb-5 flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Globe2 :size="18" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">基本设置</h3>
            <p class="text-xs text-ink-500 dark:text-ink-400">系统时区与定时检查时间</p>
          </div>
        </header>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">系统时区</label>
            <el-select v-model="config.timezone" class="w-full">
              <el-option label="中国标准时间 (UTC+8)" value="Asia/Shanghai" />
              <el-option label="香港时间 (UTC+8)" value="Asia/Hong_Kong" />
              <el-option label="台北时间 (UTC+8)" value="Asia/Taipei" />
              <el-option label="新加坡时间 (UTC+8)" value="Asia/Singapore" />
              <el-option label="韩国时间 (UTC+9)" value="Asia/Seoul" />
              <el-option label="日本时间 (UTC+9)" value="Asia/Tokyo" />
              <el-option label="泰国时间 (UTC+7)" value="Asia/Bangkok" />
              <el-option label="印度时间 (UTC+5:30)" value="Asia/Kolkata" />
              <el-option label="迪拜时间 (UTC+4)" value="Asia/Dubai" />
              <el-option label="澳大利亚东部 (UTC+10)" value="Australia/Sydney" />
              <el-option label="莫斯科时间 (UTC+3)" value="Europe/Moscow" />
              <el-option label="柏林时间 (UTC+1/2)" value="Europe/Berlin" />
              <el-option label="巴黎时间 (UTC+1/2)" value="Europe/Paris" />
              <el-option label="伦敦时间 (UTC+0/1)" value="Europe/London" />
              <el-option label="美国东部时间 (UTC-5/4)" value="America/New_York" />
              <el-option label="美国中部时间 (UTC-6/5)" value="America/Chicago" />
              <el-option label="美国太平洋时间 (UTC-8/7)" value="America/Los_Angeles" />
              <el-option label="圣保罗时间 (UTC-3)" value="America/Sao_Paulo" />
              <el-option label="UTC" value="UTC" />
            </el-select>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
              <span class="inline-flex items-center gap-1.5"><Clock :size="14" />检查时间（小时）</span>
            </label>
            <input
              v-model="config.notify_hours"
              type="text"
              placeholder="如：8,12,18，留空则每天一次"
              class="block w-full rounded-xl border border-ink-200 bg-white/60 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50 dark:placeholder:text-ink-500"
            />
            <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">多个时间用逗号或空格分隔</p>
          </div>
        </div>
      </section>

      <!-- Notify Template -->
      <section class="bento-card p-5">
        <header class="mb-5 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FileCode2 :size="18" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">通知模板</h3>
              <p class="text-xs text-ink-500 dark:text-ink-400">支持变量插值，左编辑右预览</p>
            </div>
          </div>
          <button
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
            @click="testTemplate"
          >
            <Sparkles :size="13" />
            测试推送
          </button>
        </header>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">编辑</p>
            <textarea
              v-model="config.notify_template"
              rows="12"
              class="block w-full resize-none rounded-xl border border-ink-200 bg-white/60 p-3 font-mono text-sm leading-relaxed text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50"
            />
          </div>
          <div>
            <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">预览</p>
            <pre class="h-[292px] overflow-auto rounded-xl border border-ink-200 bg-ink-50 p-3 text-sm leading-relaxed text-ink-800 dark:border-ink-700/60 dark:bg-ink-900/60 dark:text-ink-200">{{ previewText }}</pre>
          </div>
        </div>

        <div class="mt-4 rounded-xl bg-ink-50/70 p-3 text-xs text-ink-500 dark:bg-ink-800/40 dark:text-ink-400">
          <span v-pre>变量：<code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{name}}</code> 名称 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{type}}</code> 类型 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{expiryDate}}</code> 到期日 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{status}}</code> 状态 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{daysLeft}}</code> 剩余天数 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{price}}</code> 费用 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{period}}</code> 周期 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{autoRenew}}</code> 续费方式 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{reminder}}</code> 提前提醒 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{lunar}}</code> 农历 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{notes}}</code> 备注 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{time}}</code> 当前时间 · <code class="rounded bg-white px-1 py-0.5 font-mono dark:bg-ink-900/60">{{timezone}}</code> 时区</span>
        </div>
      </section>

      <!-- Notification Channels -->
      <section class="bento-card p-5">
        <header class="mb-5 flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <Bell :size="18" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-50">通知渠道</h3>
            <p class="text-xs text-ink-500 dark:text-ink-400">点击卡片启用对应渠道</p>
          </div>
        </header>

        <!-- Channel cards -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="ch in visibleChannels"
            :key="ch.key"
            type="button"
            class="group relative flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200"
            :class="activeChannels.includes(ch.key)
              ? `border-transparent shadow-md ring-2 ring-inset ${toneClasses[ch.tone].ring} bg-white dark:bg-ink-800/60`
              : 'border-ink-200 bg-white/60 hover:border-ink-300 hover:bg-white dark:border-ink-700/60 dark:bg-ink-900/40 dark:hover:bg-ink-800/40'"
            @click="toggleChannel(ch.key)"
          >
            <div
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-all"
              :class="activeChannels.includes(ch.key)
                ? `${toneClasses[ch.tone].bg} ${toneClasses[ch.tone].text}`
                : 'bg-ink-100 text-ink-400 dark:bg-ink-800/60 dark:text-ink-500'"
            >
              <Send :size="16" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink-900 dark:text-ink-50">{{ ch.name }}</p>
              <p class="truncate text-xs text-ink-500 dark:text-ink-400">{{ ch.desc }}</p>
            </div>
            <span
              v-if="activeChannels.includes(ch.key)"
              class="flex h-5 w-5 items-center justify-center rounded-full text-white"
              :class="toneClasses[ch.tone].bg.replace('100', '500').replace('500/15', '500')"
            >
              <Check :size="13" :stroke-width="3" />
            </span>
          </button>
        </div>

        <!-- Telegram Config -->
        <div v-if="activeChannels.includes('telegram')" class="mt-5 rounded-2xl border border-sky-200 bg-sky-50/40 p-5 dark:border-sky-500/30 dark:bg-sky-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-sky-500" />
              Telegram 配置
            </h4>
            <button
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30"
              @click="testChannel('telegram')"
            >
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">Bot Token</label>
              <el-input v-model="config.telegram_bot_token" placeholder="从 @BotFather 获取" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">Chat ID</label>
              <el-input v-model="config.telegram_chat_id" placeholder="从 @userinfobot 获取" />
            </div>
          </div>
        </div>

        <!-- WeChat Config -->
        <div v-if="activeChannels.includes('wechat')" class="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-emerald-500" />
              企业微信配置
            </h4>
            <button class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30" @click="testChannel('wechat')">
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">Webhook URL</label>
          <el-input v-model="config.wechat_webhook" placeholder="企业微信群机器人 Webhook 地址" />
        </div>

        <!-- Bark Config -->
        <div v-if="activeChannels.includes('bark')" class="mt-5 rounded-2xl border border-rose-200 bg-rose-50/40 p-5 dark:border-rose-500/30 dark:bg-rose-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-rose-500" />
              Bark 配置
            </h4>
            <button class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30" @click="testChannel('bark')">
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">服务器地址</label>
              <el-input v-model="config.bark_url" placeholder="https://api.day.app" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">设备 Key</label>
              <el-input v-model="config.bark_key" placeholder="在 Bark App 内复制" />
            </div>
          </div>
        </div>

        <!-- PushPlus Config -->
        <div v-if="activeChannels.includes('pushplus')" class="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-emerald-500" />
              PushPlus 配置
            </h4>
            <button class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30" @click="testChannel('pushplus')">
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">Token</label>
          <el-input v-model="config.pushplus_token" placeholder="从 PushPlus 推送加后台获取" />
        </div>

        <!-- Webhook Config -->
        <div v-if="activeChannels.includes('webhook')" class="mt-5 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-500/30 dark:bg-violet-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-violet-500" />
              Webhook 配置
            </h4>
            <button class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/30" @click="testChannel('webhook')">
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">推送 URL</label>
                <el-input v-model="config.webhook_url" placeholder="https://your-service.com/hooks" />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">请求方法</label>
                <el-select v-model="config.webhook_method" class="w-full">
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                </el-select>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">请求头 (JSON)</label>
              <el-input v-model="config.webhook_headers" placeholder='{"Authorization": "Bearer xxx"}' />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">消息模板</label>
              <el-input v-model="config.webhook_template" placeholder="{{formattedMessage}}" />
              <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">
                <span v-pre>可用变量: <code>{{title}}, {{content}}, {{tags}}, {{tagsLine}}, {{timestamp}}, {{formattedMessage}}</code></span>
              </p>
            </div>
          </div>
        </div>

        <!-- Email Config -->
        <div v-if="activeChannels.includes('email')" class="mt-5 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-500/30 dark:bg-amber-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-amber-500" />
              邮件配置 (Resend)
            </h4>
            <button class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30" @click="testChannel('email')">
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">API Key</label>
              <el-input v-model="config.email_api_key" placeholder="Resend API Key" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">发件人邮箱</label>
              <el-input v-model="config.email_from" placeholder="notify@yourdomain.com" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">收件人邮箱</label>
              <el-input v-model="config.email_to" placeholder="you@example.com" />
            </div>
          </div>
        </div>

        <!-- NotifyX Config -->
        <div v-if="activeChannels.includes('notifyx')" class="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-5 dark:border-cyan-500/30 dark:bg-cyan-500/5">
          <div class="mb-4 flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
              <span class="h-2 w-2 rounded-full bg-cyan-500" />
              NotifyX 配置
            </h4>
            <button class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/30" @click="testChannel('notifyx')">
              <Sparkles :size="13" /> 测试
            </button>
          </div>
          <label class="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-300">API Key</label>
          <el-input v-model="config.notifyx_api_key" placeholder="从 NotifyX 官网获取" />
        </div>
      </section>

      <!-- Bottom save -->
      <div class="flex justify-end pt-2">
        <button
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
          :disabled="saving"
          @click="saveConfig"
        >
          <component :is="saving ? Loader2 : Save" :size="16" :class="saving && 'animate-spin'" />
          {{ saving ? '保存中...' : '保存所有配置' }}
        </button>
      </div>
    </div>
  </div>
</template>
