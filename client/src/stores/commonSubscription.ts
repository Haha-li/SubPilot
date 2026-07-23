import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api';

export interface CommonSubscription {
  id: number;
  name: string;
  website: string;
  iconUrl: string;
  backgroundColor: string;
  createdAt: string;
  updatedAt: string;
}

export type CommonSubscriptionPayload = Pick<
  CommonSubscription,
  'name' | 'website' | 'iconUrl' | 'backgroundColor'
>;

export const useCommonSubscriptionStore = defineStore('commonSubscription', () => {
  const items = ref<CommonSubscription[]>([]);
  const loading = ref(false);

  function sortItems(nextItems: CommonSubscription[]) {
    return [...nextItems].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  async function fetchItems() {
    loading.value = true;
    try {
      const { data } = await api.get('/common-subscriptions');
      items.value = sortItems(data);
    } finally {
      loading.value = false;
    }
  }

  async function createItem(payload: CommonSubscriptionPayload) {
    const { data } = await api.post('/common-subscriptions', payload);
    if (data.success && data.commonSubscription) {
      items.value = sortItems([...items.value, data.commonSubscription]);
    }
    return data;
  }

  async function updateItem(id: number, payload: CommonSubscriptionPayload) {
    const { data } = await api.put(`/common-subscriptions/${id}`, payload);
    if (data.success && data.commonSubscription) {
      items.value = sortItems(items.value.map((item) =>
        item.id === id ? data.commonSubscription : item,
      ));
    }
    return data;
  }

  async function deleteItem(id: number) {
    const { data } = await api.delete(`/common-subscriptions/${id}`);
    if (data.success) items.value = items.value.filter((item) => item.id !== id);
    return data;
  }

  async function fetchWebsiteIcon(website: string): Promise<string> {
    const { data } = await api.post('/common-subscriptions/fetch-icon', { website });
    return data.iconUrl;
  }

  return {
    items,
    loading,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    fetchWebsiteIcon,
  };
});
