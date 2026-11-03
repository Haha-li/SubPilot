import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api';

export interface SubscriptionMethod {
  id: number;
  name: string;
  channel: string;
  paymentMethod: string;
  account: string;
  balance: number | null;
  balanceCurrency: string;
  paymentReference: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionMethodPayload = Pick<
  SubscriptionMethod,
  'name' | 'channel' | 'paymentMethod' | 'account' | 'balance' | 'balanceCurrency' | 'paymentReference'
>;

export interface SubscriptionMethodLog {
  id: number;
  subscriptionMethodId: number;
  subscriptionId: number | null;
  subscriptionName: string;
  type: 'initial' | 'manual_adjustment' | 'manual_renewal' | 'automatic_renewal';
  amount: number;
  beforeBalance: number;
  afterBalance: number;
  note: string;
  createdAt: string;
}

export const useSubscriptionMethodStore = defineStore('subscriptionMethod', () => {
  const items = ref<SubscriptionMethod[]>([]);
  const loading = ref(false);

  function sortItems(nextItems: SubscriptionMethod[]) {
    return [...nextItems].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  async function fetchItems() {
    loading.value = true;
    try {
      const { data } = await api.get('/subscription-methods');
      items.value = sortItems(data);
    } finally {
      loading.value = false;
    }
  }

  async function createItem(payload: SubscriptionMethodPayload) {
    const { data } = await api.post('/subscription-methods', payload);
    if (data.success && data.subscriptionMethod) {
      items.value = sortItems([...items.value, data.subscriptionMethod]);
    }
    return data;
  }

  async function updateItem(id: number, payload: SubscriptionMethodPayload) {
    const { data } = await api.put(`/subscription-methods/${id}`, payload);
    if (data.success && data.subscriptionMethod) {
      items.value = sortItems(items.value.map((item) => (
        item.id === id ? data.subscriptionMethod : item
      )));
    }
    return data;
  }

  async function adjustBalance(id: number, amount: number, note = '') {
    const { data } = await api.post(`/subscription-methods/${id}/adjust`, { amount, note });
    if (data.success && data.subscriptionMethod) {
      items.value = sortItems(items.value.map((item) => (
        item.id === id ? data.subscriptionMethod : item
      )));
    }
    return data;
  }

  async function fetchLogs(id: number): Promise<SubscriptionMethodLog[]> {
    const { data } = await api.get(`/subscription-methods/${id}/logs`);
    return data;
  }

  async function deleteItem(id: number) {
    const { data } = await api.delete(`/subscription-methods/${id}`);
    if (data.success) items.value = items.value.filter((item) => item.id !== id);
    return data;
  }

  return {
    items, loading,
    fetchItems, createItem, updateItem, adjustBalance, fetchLogs, deleteItem,
  };
});
