export async function sendBark(barkUrl: string, barkKey: string, message: string, title: string): Promise<boolean> {
  if (!barkKey) return false;

  const baseUrl = barkUrl || 'https://api.day.app';
  const url = `${baseUrl.replace(/\/$/, '')}/${barkKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title || 'SubPilot',
      body: message,
      group: 'SubPilot',
    }),
  });

  const result: any = await response.json();
  return result.code === 200;
}
