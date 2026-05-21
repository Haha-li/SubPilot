export async function sendWechat(webhookUrl: string, message: string): Promise<boolean> {
  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'text',
      text: { content: message },
    }),
  });

  const result = await response.json();
  return result.errcode === 0;
}
