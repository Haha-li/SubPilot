<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDark, useToggle, useMediaQuery } from '@vueuse/core';
import { useAuthStore } from '../stores/auth';
import {
  List, Folder, Setting, Document, DataLine, PriceTag, Calendar,
  Sunny, Moon, DArrowLeft, DArrowRight, SwitchButton, Expand,
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const isMobile = useMediaQuery('(max-width: 768px)');
const drawerOpen = ref(false);
const isCollapsed = ref(localStorage.getItem('sidebarCollapsed') === 'true');

const isDark = useDark();
const toggleDark = useToggle(isDark);

function handleSelect(path: string) {
  router.push(path);
  if (isMobile.value) drawerOpen.value = false;
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem('sidebarCollapsed', String(isCollapsed.value));
}

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value;
}
</script>

<template>
  <el-container class="app-layout">
    <!-- Mobile overlay -->
    <div
      v-if="isMobile && drawerOpen"
      class="mobile-overlay"
      @click="drawerOpen = false"
    />

    <el-aside
      v-show="!isMobile || drawerOpen"
      :width="isMobile ? '220px' : (isCollapsed ? '64px' : '220px')"
      class="app-aside"
      :class="{ 'mobile-drawer': isMobile, 'drawer-open': isMobile && drawerOpen }"
    >
      <div class="logo-area">
        <el-icon :size="24" color="#f59e0b"><List /></el-icon>
        <span v-show="isMobile || !isCollapsed" class="logo-text">SubPilot</span>
      </div>

      <el-menu
        :default-active="route.path"
        :collapse="!isMobile && isCollapsed"
        :collapse-transition="false"
        router
        class="app-menu"
      >
        <el-menu-item index="/" @click="isMobile && (drawerOpen = false)">
          <el-icon><Folder /></el-icon>
          <template #title>订阅管理</template>
        </el-menu-item>
        <el-menu-item index="/stats" @click="isMobile && (drawerOpen = false)">
          <el-icon><DataLine /></el-icon>
          <template #title>费用统计</template>
        </el-menu-item>
        <el-menu-item index="/categories" @click="isMobile && (drawerOpen = false)">
          <el-icon><PriceTag /></el-icon>
          <template #title>分类管理</template>
        </el-menu-item>
        <el-menu-item index="/calendar" @click="isMobile && (drawerOpen = false)">
          <el-icon><Calendar /></el-icon>
          <template #title>订阅日历</template>
        </el-menu-item>
        <el-menu-item index="/logs" @click="isMobile && (drawerOpen = false)">
          <el-icon><Document /></el-icon>
          <template #title>通知日志</template>
        </el-menu-item>
        <el-menu-item index="/config" @click="isMobile && (drawerOpen = false)">
          <el-icon><Setting /></el-icon>
          <template #title>系统配置</template>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-bottom">
        <el-tooltip :content="isDark ? '浅色模式' : '深色模式'" placement="right" :show-after="500">
          <el-button text class="sidebar-btn" @click="toggleDark()">
            <el-icon :size="18"><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            <span v-show="isMobile || !isCollapsed" class="btn-label">{{ isDark ? '浅色模式' : '深色模式' }}</span>
          </el-button>
        </el-tooltip>
        <el-tooltip v-if="!isMobile" content="收起侧边栏" placement="right" :show-after="500">
          <el-button text class="sidebar-btn" @click="toggleCollapse">
            <el-icon :size="18"><DArrowLeft v-if="!isCollapsed" /><DArrowRight v-else /></el-icon>
            <span v-show="!isCollapsed" class="btn-label">收起侧边栏</span>
          </el-button>
        </el-tooltip>
        <el-tooltip content="退出登录" placement="right" :show-after="500">
          <el-button text class="sidebar-btn" @click="handleLogout">
            <el-icon :size="18"><SwitchButton /></el-icon>
            <span v-show="isMobile || !isCollapsed" class="btn-label">退出登录</span>
          </el-button>
        </el-tooltip>
      </div>
    </el-aside>

    <el-container>
      <!-- Mobile top bar -->
      <div v-if="isMobile" class="mobile-topbar">
        <el-button text @click="toggleDrawer">
          <el-icon :size="22"><Expand /></el-icon>
        </el-button>
        <span class="topbar-title">SubPilot</span>
        <div style="width: 40px" />
      </div>

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

.app-aside.mobile-drawer {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 2001;
  width: 220px;
}

.mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 2000;
}

.mobile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  height: 48px;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

.topbar-title {
  font-size: 16px;
  font-weight: 700;
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
