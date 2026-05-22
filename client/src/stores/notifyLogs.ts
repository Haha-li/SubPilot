import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api';

export interface NotifyLog {
  id: number;
  subscriptionId: number | null;
  subscriptionName: string;
  channel: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export const useNotifyLogsStore = defineStore('notifyLogs', () => {
  const logs = ref<NotifyLog[]>([]);
  const total = ref(0);
  const loading = ref(false);

  async function fetchLogs(params: Record<string, any> = {}) {
    loading.value = true;
    try {
      const { data } = await api.get('/notify-logs', { params });
      logs.value = data.items;
      total.value = data.total;
    } finally {
      loading.value = false;
    }
  }

  async function clearLogs() {
    const { data } = await api.delete('/notify-logs');
    if (data.success) {
      logs.value = [];
      total.value = 0;
    }
    return data;
  }

  return { logs, total, loading, fetchLogs, clearLogs };
});
