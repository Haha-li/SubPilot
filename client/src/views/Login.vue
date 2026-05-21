<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import { Lock, List } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();

const password = ref('');
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
  <div class="login-page">
    <el-card class="login-card" shadow="hover">
      <div class="login-header">
        <el-icon :size="36" color="#f59e0b"><List /></el-icon>
        <h1>SubPilot</h1>
        <p>订阅管理与提醒系统</p>
      </div>

      <el-form label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="密码">
          <el-input
            v-model="password"
            type="password"
            placeholder="请输入管理密码"
            size="large"
            show-password
            :prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          :loading="loading"
          style="width: 100%"
          @click="handleLogin"
        >
          {{ loading ? '登录中...' : '登录' }}
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-bg-color-page);
}

.login-card {
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin-top: 12px;
}

.login-header p {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-top: 4px;
}
</style>
