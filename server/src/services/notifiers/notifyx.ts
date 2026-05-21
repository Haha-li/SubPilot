export async function sendNotifyX(apiKey: string, message: string): Promise<boolean> {
  if (!apiKey) return false;

  const response = await fetch(`https://www.notifyx.cn/api/v1/send/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'SubPilot 订阅提醒',
      content: message,
    }),
  });

  const result = await response.json();
  return result.status === 'success';
}
