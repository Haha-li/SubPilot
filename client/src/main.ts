import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'element-plus/theme-chalk/dark/css-vars.css';
import App from './App.vue';
import router from './router';
import {
  clearChunkRecoveryQuery,
  clearPendingChunkRoute,
  installChunkRecovery,
  recoverFromChunkLoadError,
  rememberPendingChunkRoute,
} from './utils/chunkRecovery';
import './style.css';

installChunkRecovery();
router.beforeEach((to) => {
  rememberPendingChunkRoute(to.fullPath);
});
router.afterEach((_to, _from, failure) => {
  if (!failure) clearPendingChunkRoute();
});
router.onError((error, to) => {
  recoverFromChunkLoadError(error, to.fullPath);
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
void router.isReady().then(clearChunkRecoveryQuery);
