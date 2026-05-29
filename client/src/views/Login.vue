<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import { Lock, Compass, LogIn, Eye, EyeOff } from '@lucide/vue';

const router = useRouter();
const authStore = useAuthStore();

const password = ref('');
const showPwd = ref(false);
const loading = ref(false);

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
  <div class="login-page relative flex min-h-screen items-center justify-center overflow-hidden px-4">
    <!-- Decorative blurred orbs -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-400/40 blur-3xl dark:bg-brand-500/20" />
      <div class="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-warning/30 blur-3xl dark:bg-warning/10" />
      <div class="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-success/20 blur-3xl dark:bg-success/10" />
    </div>

    <div class="glass-panel relative w-full max-w-md rounded-3xl px-8 py-10 sm:px-10">
      <!-- Brand mark -->
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
          <Compass :size="28" :stroke-width="2.25" />
        </div>
        <h1 class="font-heading text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          欢迎回到 SubPilot
        </h1>
        <p class="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
          订阅管理与到期提醒
        </p>
      </div>

      <!-- Form -->
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
          class="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-brand-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  </div>
</template>
