import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../utils/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const username = ref(localStorage.getItem('user') || '');

  const isAuthenticated = computed(() => !!token.value);

  async function login(user: string, password: string) {
    const { data } = await api.post('/auth/login', { username: user, password });
    if (data.success) {
      token.value = data.token;
      username.value = data.username;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', data.username);
    }
    return data;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {}
    token.value = '';
    username.value = '';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async function checkAuth() {
    if (!token.value) return false;
    try {
      const { data } = await api.get('/auth/me');
      if (data.success) {
        username.value = data.user.username;
        return true;
      }
    } catch {
      token.value = '';
      username.value = '';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return false;
  }

  return { token, username, isAuthenticated, login, logout, checkAuth };
});
