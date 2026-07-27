import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api';
import { isValidTimeZone } from '../utils/dateOnly';

const DEFAULT_TIMEZONE = 'Asia/Shanghai';

export const useSystemConfigStore = defineStore('systemConfig', () => {
  const timezone = ref(DEFAULT_TIMEZONE);
  const loaded = ref(false);
  const loading = ref(false);

  function setTimezone(value: unknown) {
    timezone.value = isValidTimeZone(value) ? value.trim() : DEFAULT_TIMEZONE;
    loaded.value = true;
  }

  async function fetchSystemConfig(force = false) {
    if (loading.value || (loaded.value && !force)) return;
    loading.value = true;
    try {
      const { data } = await api.get('/config');
      setTimezone(data?.timezone);
    } catch {
      if (!loaded.value) timezone.value = DEFAULT_TIMEZONE;
    } finally {
      loaded.value = true;
      loading.value = false;
    }
  }

  return { timezone, loaded, loading, setTimezone, fetchSystemConfig };
});
