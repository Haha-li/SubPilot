import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
        },
        {
          path: 'renewals',
          name: 'RenewalCenter',
          component: () => import('../views/RenewalCenter.vue'),
        },
        {
          path: 'config',
          name: 'Config',
          component: () => import('../views/Config.vue'),
        },
        {
          path: 'logs',
          name: 'Logs',
          component: () => import('../views/Logs.vue'),
        },
        {
          path: 'stats',
          name: 'Stats',
          component: () => import('../views/Stats.vue'),
        },
        {
          path: 'categories',
          name: 'Categories',
          component: () => import('../views/Categories.vue'),
        },
        {
          path: 'common-subscriptions',
          name: 'CommonSubscriptions',
          component: () => import('../views/CommonSubscriptions.vue'),
        },
        {
          path: 'calendar',
          name: 'Calendar',
          component: () => import('../views/Calendar.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' };
  }
  if (to.name === 'Login' && authStore.isAuthenticated) {
    return { name: 'Dashboard' };
  }
});

export default router;
