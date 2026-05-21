export async function sendEmail(config: Record<string, string>, message: string, subject: string): Promise<boolean> {
  const apiKey = config.email_api_key;
  const from = config.email_from;
  const to = config.email_to;

  if (!apiKey || !from || !to) return false;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
        <h2 style="color: white; margin: 0;">📋 SubPilot 订阅提醒</h2>
      </div>
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
        <pre style="white-space: pre-wrap; font-family: inherit; color: #374151; line-height: 1.6;">${message}</pre>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        由 SubPilot 订阅管理系统发送
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subject || 'SubPilot 订阅提醒',
      html: htmlContent,
    }),
  });

  const result: any = await response.json();
  return !!result.id;
}
