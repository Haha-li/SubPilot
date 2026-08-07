import { fetchWithRetry } from './fetchWithRetry';

export async function sendNotifyX(apiKey: string, message: string): Promise<boolean> {
  if (!apiKey) return false;

  const response = await fetchWithRetry(`https://www.notifyx.cn/api/v1/send/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'SubPilot 订阅提醒',
      content: message,
    }),
  });

  // NotifyX 采用异步投递：官方前端即以 HTTP 2xx 判定发送成功，
  // 响应体 status 为 "queued"（官方文档示例），不依赖具体字段。
  return response.ok;
}
