<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDark, useToggle } from '@vueuse/core';
import { useAuthStore } from '../stores/auth';
import {
  List, Folder, Setting,
  Sunny, Moon, DArrowLeft, DArrowRight, SwitchButton,
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const isCollapse = ref(localStorage.getItem('sidebarCollapsed') === 'true');

const isDark = useDark();
const toggleDark = useToggle(isDark);

function handleSelect(path: string) {
  router.push(path);
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

function toggleCollapse() {
  isCollapse.value = !isCollapse.value;
  localStorage.setItem('sidebarCollapsed', String(isCollapse.value));
}
</script>

<template>
  <el-container class="app-layout">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="app-aside">
      <div class="logo-area">
        <el-icon :size="24" color="#f59e0b"><List /></el-icon>
        <span v-show="!isCollapse" class="logo-text">SubPilot</span>
      </div>

      <el-menu
        :default-active="route.path"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
        class="app-menu"
      >
        <el-menu-item index="/">
          <el-icon><Folder /></el-icon>
          <template #title>订阅管理</template>
        </el-menu-item>
        <el-menu-item index="/config">
          <el-icon><Setting /></el-icon>
          <template #title>系统配置</template>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-bottom">
        <el-tooltip :content="isDark ? '浅色模式' : '深色模式'" placement="right" :show-after="500">
          <el-button text class="sidebar-btn" @click="toggleDark()">
            <el-icon :size="18"><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            <span v-show="!isCollapse" class="btn-label">{{ isDark ? '浅色模式' : '深色模式' }}</span>
          </el-button>
        </el-tooltip>
        <el-tooltip content="收起侧边栏" placement="right" :show-after="500">
          <el-button text class="sidebar-btn" @click="toggleCollapse">
            <el-icon :size="18"><DArrowLeft v-if="!isCollapse" /><DArrowRight v-else /></el-icon>
            <span v-show="!isCollapse" class="btn-label">收起侧边栏</span>
          </el-button>
        </el-tooltip>
        <el-tooltip content="退出登录" placement="right" :show-after="500">
          <el-button text class="sidebar-btn" @click="handleLogout">
            <el-icon :size="18"><SwitchButton /></el-icon>
            <span v-show="!isCollapse" class="btn-label">退出登录</span>
          </el-button>
        </el-tooltip>
      </div>
    </el-aside>

    <el-container>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-layout {
  height: 100vh;
}

.app-aside {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.3s;
  overflow: hidden;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.app-menu {
  flex: 1;
  border-right: none;
}

.app-menu:not(.el-menu--collapse) {
  width: 100%;
}

.sidebar-bottom {
  padding: 8px;
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-bottom :deep(.el-tooltip) {
  display: block;
}

.sidebar-btn {
  width: 100%;
  margin-left: 0 !important;
  justify-content: flex-start;
  gap: 8px;
  height: 40px;
}

.btn-label {
  font-size: 14px;
}

.app-main {
  padding: 24px;
  background-color: var(--el-bg-color-page);
}
</style>
