export async function sendPushPlus(token: string, message: string, title = 'SubPilot 订阅提醒', topic = ''): Promise<boolean> {
  if (!token) return false;

  const body: Record<string, string> = {
    token,
    title,
    content: message,
    template: 'txt',
  };
  if (topic.trim()) {
    body.topic = topic.trim();
  }

  const response = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  try {
    const result: any = await response.json();
    return result.code === 200;
  } catch {
    return response.ok;
  }
}
