import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api';

export interface Subscription {
  id: number;
  name: string;
  customType: string;
  category: string;
  startDate: string | null;
  expiryDate: string;
  periodValue: number;
  periodUnit: string;
  reminderValue: number;
  reminderUnit: string;
  isActive: number;
  autoRenew: number;
  useLunar: number;
  notes: string;
  price: number;
  priceUnit: string;
  currency: string;
  isPinned: number;
  trialValue: number | null;
  trialUnit: string | null;
  createdAt: string;
  updatedAt: string;
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscriptions = ref<Subscription[]>([]);
  const loading = ref(false);

  async function fetchSubscriptions(search?: string, category?: string) {
    loading.value = true;
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await api.get('/subscriptions', { params });
      subscriptions.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function createSubscription(sub: Partial<Subscription>) {
    const { data } = await api.post('/subscriptions', sub);
    if (data.success) {
      await fetchSubscriptions();
    }
    return data;
  }

  async function updateSubscription(id: number, sub: Partial<Subscription>) {
    const { data } = await api.put(`/subscriptions/${id}`, sub);
    if (data.success) {
      await fetchSubscriptions();
    }
    return data;
  }

  async function deleteSubscription(id: number) {
    const { data } = await api.delete(`/subscriptions/${id}`);
    if (data.success) {
      await fetchSubscriptions();
    }
    return data;
  }

  async function toggleSubscription(id: number, isActive: boolean) {
    const { data } = await api.post(`/subscriptions/${id}/toggle`, { isActive });
    if (data.success) {
      await fetchSubscriptions();
    }
    return data;
  }

  async function testNotify(id: number) {
    const { data } = await api.post(`/subscriptions/${id}/test-notify`);
    return data;
  }

  async function togglePin(id: number, isPinned: boolean) {
    const { data } = await api.put(`/subscriptions/${id}`, { isPinned });
    if (data.success) {
      await fetchSubscriptions();
    }
    return data;
  }

  return {
    subscriptions, loading,
    fetchSubscriptions, createSubscription, updateSubscription,
    deleteSubscription, toggleSubscription, testNotify, togglePin,
  };
});
