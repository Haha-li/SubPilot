// 带超时、重试与指数退避的 fetch 封装。
// 并发语义：每次调用独立无共享状态，可安全并发调用。
//
// 只对"临时性"失败重试：
//   - 网络异常（fetch 抛错）
//   - 请求超时（AbortError）
//   - HTTP 408 / 429 / 5xx
// 其余状态码（如 4xx 凭证/参数错误）视为永久失败，立即返回不重试。

export interface FetchRetryOptions {
  /** 最大重试次数（初始请求外的额外尝试次数），默认 2，即最多共 3 次请求 */
  retries?: number;
  /** 单次请求超时毫秒数，默认 10000 */
  timeoutMs?: number;
  /** 退避基数毫秒，默认 1000 */
  baseDelayMs?: number;
  /** 退避上限毫秒，默认 8000 */
  maxDelayMs?: number;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const { retries = 2, timeoutMs = 10000, baseDelayMs = 1000, maxDelayMs = 8000 } = options;
  let lastError: unknown = new Error('发送失败');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (response.ok || !RETRYABLE_STATUS.has(response.status)) {
        return response;
      }
      lastError = new Error(`上游服务返回 ${response.status}`);
    } catch (error: any) {
      lastError = error?.name === 'AbortError'
        ? new Error(`请求超时（${timeoutMs}ms）`)
        : error;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      const jitter = Math.random() * 200;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs) + jitter;
      await sleep(delay);
    }
  }

  throw lastError;
}
