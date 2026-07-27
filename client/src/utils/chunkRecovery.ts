const CHUNK_RELOAD_KEY = 'subpilot:chunk-reload-at';
const CHUNK_PENDING_ROUTE_KEY = 'subpilot:chunk-pending-route';
const CHUNK_RELOAD_QUERY = '__subpilot_reload';
const RELOAD_GUARD_MS = 60_000;

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /unable to preload css/i,
  /chunkloaderror/i,
  /loading chunk .* failed/i,
  /couldn't resolve component .* at/i,
];

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || '');
  }
  return '';
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isChunkLoadError(reason: unknown): boolean {
  const message = getErrorMessage(reason);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function createChunkRecoveryUrl(
  currentUrl: string,
  targetPath: string | undefined,
  timestamp: number,
): string {
  const current = new URL(currentUrl);
  const target = targetPath ? new URL(targetPath, current.origin) : current;
  target.searchParams.set(CHUNK_RELOAD_QUERY, String(timestamp));
  return target.toString();
}

export function recoverFromChunkLoadError(reason: unknown, targetPath?: string): boolean {
  if (!isChunkLoadError(reason)) return false;
  return reloadWithFreshAssets(targetPath);
}

export function reloadWithFreshAssets(targetPath?: string): boolean {
  const now = Date.now();
  const storage = getSessionStorage();
  const lastReload = Number(storage?.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Number.isFinite(lastReload) && now - lastReload < RELOAD_GUARD_MS) {
    console.error('页面资源自动刷新后仍加载失败，请手动刷新页面。');
    return true;
  }

  storage?.setItem(CHUNK_RELOAD_KEY, String(now));
  const recoveryTarget = targetPath || storage?.getItem(CHUNK_PENDING_ROUTE_KEY) || undefined;
  window.location.replace(createChunkRecoveryUrl(window.location.href, recoveryTarget, now));
  return true;
}

export function rememberPendingChunkRoute(path: string): void {
  getSessionStorage()?.setItem(CHUNK_PENDING_ROUTE_KEY, path);
}

export function clearPendingChunkRoute(): void {
  getSessionStorage()?.removeItem(CHUNK_PENDING_ROUTE_KEY);
}

export function installChunkRecovery(): void {
  let preloadRecoveryScheduled = false;
  window.addEventListener('vite:preloadError', (event: Event) => {
    event.preventDefault();
    if (preloadRecoveryScheduled) return;
    preloadRecoveryScheduled = true;
    window.setTimeout(() => reloadWithFreshAssets(), 0);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (!recoverFromChunkLoadError(event.reason)) return;
    event.preventDefault();
  });
}

export function clearChunkRecoveryQuery(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHUNK_RELOAD_QUERY)) return;
  url.searchParams.delete(CHUNK_RELOAD_QUERY);
  window.history.replaceState(window.history.state, '', url.toString());
}
