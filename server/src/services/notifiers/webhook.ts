export async function sendWebhook(config: Record<string, string>, message: string, subscription: { name: string; customType: string | null; notes: string | null }): Promise<boolean> {
  const webhookUrl = config.webhook_url;
  if (!webhookUrl) return false;

  const method = config.webhook_method || 'POST';
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };

  try {
    if (config.webhook_headers) {
      const customHeaders = JSON.parse(config.webhook_headers);
      headers = { ...headers, ...customHeaders };
    }
  } catch {}

  const template = config.webhook_template || '{{formattedMessage}}';
  const now = new Date().toISOString();

  const body = template
    .replace(/\{\{title\}\}/g, subscription.name)
    .replace(/\{\{content\}\}/g, message)
    .replace(/\{\{tags\}\}/g, subscription.customType || '')
    .replace(/\{\{tagsLine\}\}/g, subscription.customType || '')
    .replace(/\{\{timestamp\}\}/g, now)
    .replace(/\{\{formattedMessage\}\}/g, message);

  const response = await fetch(webhookUrl, {
    method,
    headers,
    body: method !== 'GET' ? body : undefined,
  });

  return response.ok;
}
