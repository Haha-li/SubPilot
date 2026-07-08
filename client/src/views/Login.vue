<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDark, useToggle } from '@vueuse/core';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import {
  Lock, Compass, LogIn, Eye, EyeOff, Sun, Moon,
  LayoutGrid, CalendarDays, Bell, Coins,
} from '@lucide/vue';

const router = useRouter();
const authStore = useAuthStore();

// 主题切换 —— 跟 AppLayout 一套逻辑，别搞特殊
const isDark = useDark();
const toggleDark = useToggle(isDark);

const password = ref('');
const showPwd = ref(false);
const loading = ref(false);

// 左侧 Hero 的特性亮点，从 README 挑的四个核心卖点
const features = [
  { icon: LayoutGrid,   label: '集中管理订阅' },
  { icon: CalendarDays, label: '日历视图 + 农历' },
  { icon: Bell,         label: '到期自动提醒' },
  { icon: Coins,        label: '多币种费用统计' },
];

async function handleLogin() {
  if (!password.value) {
    ElMessage.warning('请输入密码');
    return;
  }

  loading.value = true;
  try {
    const result = await authStore.login(password.value);
    if (result.success) {
      router.push('/');
    } else {
      ElMessage.error(result.message || '登录失败');
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '登录失败，请稍后再试');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
    <!-- 装饰光球：纯静态模糊，不抢戏 -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-400/40 blur-3xl dark:bg-brand-500/20" />
      <div class="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-warning/30 blur-3xl dark:bg-warning/10" />
      <div class="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-success/20 blur-3xl dark:bg-success/10" />
    </div>

    <!-- 右上角主题切换 -->
    <button
      type="button"
      :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
      class="glass-panel absolute right-4 top-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-600 transition-colors hover:text-brand-500 dark:text-ink-300 dark:hover:text-brand-300"
      @click="toggleDark()"
    >
      <component :is="isDark ? Sun : Moon" :size="18" />
    </button>

    <!-- 双栏容器：桌面端左右分栏，移动端堆叠 -->
    <div class="relative grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <!-- 左侧 Hero 品牌区 -->
      <aside class="order-2 flex flex-col lg:order-1">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            <Compass :size="26" :stroke-width="2.25" />
          </div>
          <span class="font-heading text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">SubPilot</span>
        </div>

        <h1 class="font-heading text-3xl font-bold leading-tight tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">
          订阅管理<br class="hidden sm:block" />
          <span class="bg-gradient-to-r from-brand-500 to-brand-400 bg-clip-text text-transparent">到期自动提醒</span>
        </h1>
        <p class="mt-3 max-w-sm text-sm text-ink-500 dark:text-ink-400 sm:text-base">
          集中管理你那一堆订阅服务，到期前准时提醒续费或退订，不再被自动扣款背刺。
        </p>

        <!-- 特性亮点 -->
        <ul class="mt-8 grid max-w-sm grid-cols-2 gap-3">
          <li
            v-for="f in features"
            :key="f.label"
            class="glass-panel flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
          >
            <component :is="f.icon" :size="18" class="flex-shrink-0 text-brand-500 dark:text-brand-300" :stroke-width="2" />
            <span class="text-sm font-medium text-ink-700 dark:text-ink-200">{{ f.label }}</span>
          </li>
        </ul>
      </aside>

      <!-- 右侧表单卡片 -->
      <section class="glass-panel order-1 w-full rounded-3xl px-8 py-10 sm:px-10 lg:order-2">
        <!-- 移动端才显示的品牌头（桌面端走左侧 Hero，这里不重复） -->
        <div class="mb-8 text-center lg:hidden">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            <Compass :size="28" :stroke-width="2.25" />
          </div>
          <h2 class="font-heading text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            欢迎回到 SubPilot
          </h2>
          <p class="mt-1.5 text-sm text-ink-500 dark:text-ink-400">订阅管理与到期提醒</p>
        </div>

        <!-- 桌面端标题 -->
        <div class="mb-8 hidden lg:block">
          <h2 class="font-heading text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            欢迎回来
          </h2>
          <p class="mt-1.5 text-sm text-ink-500 dark:text-ink-400">输入管理密码继续</p>
        </div>

        <!-- 表单 -->
        <form class="space-y-5" @submit.prevent="handleLogin">
          <div>
            <label for="password" class="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">
              管理密码
            </label>
            <div class="group relative">
              <div class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-brand-500 dark:text-ink-500">
                <Lock :size="18" />
              </div>
              <input
                id="password"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                placeholder="请输入管理密码"
                autocomplete="current-password"
                class="block w-full rounded-xl border border-ink-200 bg-white/60 py-3 pl-11 pr-11 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-50 dark:placeholder:text-ink-500"
                @keyup.enter="handleLogin"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
                :aria-label="showPwd ? '隐藏密码' : '显示密码'"
                @click="showPwd = !showPwd"
              >
                <component :is="showPwd ? EyeOff : Eye" :size="18" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition-all duration-200 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/40 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              v-if="loading"
              class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            <LogIn v-else :size="18" />
            <span>{{ loading ? '登录中...' : '登 录' }}</span>
          </button>
        </form>

        <p class="mt-8 text-center text-xs text-ink-400 dark:text-ink-500">
          默认密码 <code class="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">password</code>，可在 .env 中修改
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 尊重用户的减少动画偏好 —— MASTER checklist 要求 */
@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation: none;
  }
}
</style>
