<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDark, useToggle, useMediaQuery } from '@vueuse/core';
import { useAuthStore } from '../stores/auth';
import {
  LayoutGrid, BarChart3, Tag, CalendarDays, FileText, Settings,
  Sun, Moon, ChevronsLeft, ChevronsRight, LogOut, Menu, X, Compass,
} from '@lucide/vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const isMobile = useMediaQuery('(max-width: 768px)');
const drawerOpen = ref(false);
const isCollapsed = ref(localStorage.getItem('sidebarCollapsed') === 'true');

const isDark = useDark();
const toggleDark = useToggle(isDark);

const navItems = [
  { path: '/',           label: '订阅管理', icon: LayoutGrid },
  { path: '/stats',      label: '费用统计', icon: BarChart3 },
  { path: '/categories', label: '分类管理', icon: Tag },
  { path: '/calendar',   label: '订阅日历', icon: CalendarDays },
  { path: '/logs',       label: '通知日志', icon: FileText },
  { path: '/config',     label: '系统配置', icon: Settings },
];

const sidebarWidth = computed(() => (isCollapsed.value ? '76px' : '232px'));

function go(path: string) {
  router.push(path);
  if (isMobile.value) drawerOpen.value = false;
}

function isActive(path: string) {
  return route.path === path;
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem('sidebarCollapsed', String(isCollapsed.value));
}
</script>

<template>
  <div class="flex min-h-screen w-full">
    <!-- Mobile drawer overlay -->
    <transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0" leave-to-class="opacity-0"
    >
      <div
        v-if="isMobile && drawerOpen"
        class="fixed inset-0 z-[1900] bg-ink-900/40 backdrop-blur-sm"
        @click="drawerOpen = false"
      />
    </transition>

    <!-- Mobile drawer -->
    <transition
      enter-active-class="transition-transform duration-300 ease-soft"
      leave-active-class="transition-transform duration-300 ease-soft"
      enter-from-class="-translate-x-full" leave-to-class="-translate-x-full"
    >
      <aside
        v-if="isMobile && drawerOpen"
        class="glass-panel fixed left-0 top-0 bottom-0 z-[2000] w-[260px] flex flex-col"
      >
        <div class="flex items-center justify-between px-5 pt-5 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
              <Compass :size="20" :stroke-width="2.25" />
            </div>
            <span class="font-heading text-lg font-bold tracking-tight">SubPilot</span>
          </div>
          <button class="cursor-pointer rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800/40" @click="drawerOpen = false">
            <X :size="20" />
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 py-2">
          <button
            v-for="item in navItems"
            :key="item.path"
            class="group mb-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200"
            :class="isActive(item.path)
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
              : 'text-ink-600 hover:bg-ink-100/70 dark:text-ink-300 dark:hover:bg-ink-800/40'"
            @click="go(item.path)"
          >
            <component :is="item.icon" :size="18" :stroke-width="isActive(item.path) ? 2.25 : 2" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <div class="space-y-1 border-t border-ink-200/60 px-3 py-3 dark:border-ink-700/40">
          <button class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100/70 dark:text-ink-300 dark:hover:bg-ink-800/40" @click="toggleDark()">
            <component :is="isDark ? Sun : Moon" :size="18" />
            <span>{{ isDark ? '浅色模式' : '深色模式' }}</span>
          </button>
          <button class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-danger/10 hover:text-danger dark:text-ink-300" @click="handleLogout">
            <LogOut :size="18" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>
    </transition>

    <!-- Desktop sidebar -->
    <aside
      v-if="!isMobile"
      class="glass-panel sticky top-0 flex h-screen flex-shrink-0 flex-col transition-[width] duration-300 ease-soft"
      :style="{ width: sidebarWidth }"
    >
      <div class="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
          <Compass :size="20" :stroke-width="2.25" />
        </div>
        <span v-show="!isCollapsed" class="font-heading text-lg font-bold tracking-tight">SubPilot</span>
      </div>

      <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <button
          v-for="item in navItems"
          :key="item.path"
          :title="isCollapsed ? item.label : undefined"
          class="group mb-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200"
          :class="[
            isActive(item.path)
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
              : 'text-ink-600 hover:bg-ink-100/70 dark:text-ink-300 dark:hover:bg-ink-800/40',
            isCollapsed ? 'justify-center px-2' : '',
          ]"
          @click="go(item.path)"
        >
          <component :is="item.icon" :size="18" :stroke-width="isActive(item.path) ? 2.25 : 2" class="flex-shrink-0" />
          <span v-show="!isCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
          <span v-if="isActive(item.path) && !isCollapsed" class="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
        </button>
      </nav>

      <div class="space-y-1 border-t border-ink-200/60 px-3 py-3 dark:border-ink-700/40">
        <button
          :title="isDark ? '浅色模式' : '深色模式'"
          class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100/70 dark:text-ink-300 dark:hover:bg-ink-800/40"
          :class="isCollapsed ? 'justify-center px-2' : ''"
          @click="toggleDark()"
        >
          <component :is="isDark ? Sun : Moon" :size="18" class="flex-shrink-0" />
          <span v-show="!isCollapsed">{{ isDark ? '浅色模式' : '深色模式' }}</span>
        </button>
        <button
          :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
          class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100/70 dark:text-ink-300 dark:hover:bg-ink-800/40"
          :class="isCollapsed ? 'justify-center px-2' : ''"
          @click="toggleCollapse"
        >
          <component :is="isCollapsed ? ChevronsRight : ChevronsLeft" :size="18" class="flex-shrink-0" />
          <span v-show="!isCollapsed">收起侧栏</span>
        </button>
        <button
          :title="isCollapsed ? '退出登录' : undefined"
          class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-danger/10 hover:text-danger dark:text-ink-300"
          :class="isCollapsed ? 'justify-center px-2' : ''"
          @click="handleLogout"
        >
          <LogOut :size="18" class="flex-shrink-0" />
          <span v-show="!isCollapsed">退出登录</span>
        </button>
      </div>
    </aside>

    <!-- Main content column -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Mobile top bar -->
      <header
        v-if="isMobile"
        class="glass-panel sticky top-0 z-30 flex h-14 items-center justify-between px-3"
      >
        <button class="cursor-pointer rounded-lg p-2 text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800/40" @click="drawerOpen = true">
          <Menu :size="22" />
        </button>
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Compass :size="16" :stroke-width="2.25" />
          </div>
          <span class="font-heading text-base font-bold">SubPilot</span>
        </div>
        <button class="cursor-pointer rounded-lg p-2 text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800/40" @click="toggleDark()">
          <component :is="isDark ? Sun : Moon" :size="20" />
        </button>
      </header>

      <main class="app-main flex-1 px-4 py-6 md:px-8 md:py-8">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .app-main {
    padding: 16px !important;
  }
}
</style>
