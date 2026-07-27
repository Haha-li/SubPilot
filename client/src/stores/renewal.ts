import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api';

export type RenewalSource = 'manual' | 'automatic';

export interface RenewalHistoryItem {
  id: number;
  subscriptionId: number;
  subscriptionName: string;
  subscriptionCategory: string;
  subscriptionIconUrl: string;
  subscriptionIconBackgroundColor: string;
  renewedAt: string;
  price: number;
  currency: string;
  periodValue: number;
  periodUnit: string;
  notes: string;
  source: RenewalSource;
  previousExpiryDate: string | null;
  newExpiryDate: string | null;
  periodsAdvanced: number;
}

export interface RenewalHistoryQuery {
  page?: number;
  pageSize?: number;
  source?: RenewalSource | '';
  search?: string;
  subscriptionId?: number;
}

export interface BatchRenewItem {
  id: number;
  periods: number;
}

export const useRenewalStore = defineStore('renewal', () => {
  const history = ref<RenewalHistoryItem[]>([]);
  const total = ref(0);
  const loadingHistory = ref(false);
  const mutating = ref(false);

  async function fetchHistory(query: RenewalHistoryQuery = {}) {
    loadingHistory.value = true;
    try {
      const { data } = await api.get('/renewals', { params: query });
      history.value = data.items || [];
      total.value = data.total || 0;
      return data;
    } finally {
      loadingHistory.value = false;
    }
  }

  async function renewSubscription(id: number, periods: number, notes = '') {
    mutating.value = true;
    try {
      const { data } = await api.post(`/renewals/${id}/renew`, { periods, notes });
      return data;
    } finally {
      mutating.value = false;
    }
  }

  async function batchRenew(items: BatchRenewItem[], notes = '') {
    mutating.value = true;
    try {
      const { data } = await api.post('/renewals/batch', {
        action: 'renew',
        items,
        notes,
      });
      return data;
    } finally {
      mutating.value = false;
    }
  }

  async function batchSetAutoRenew(ids: number[], enabled: boolean) {
    mutating.value = true;
    try {
      const { data } = await api.post('/renewals/batch', {
        action: 'auto-renew',
        ids,
        enabled,
      });
      return data;
    } finally {
      mutating.value = false;
    }
  }

  return {
    history,
    total,
    loadingHistory,
    mutating,
    fetchHistory,
    renewSubscription,
    batchRenew,
    batchSetAutoRenew,
  };
});
