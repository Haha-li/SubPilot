const MAX_URL_LENGTH = 2_048;
const MAX_HTML_BYTES = 512 * 1_024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOST_SUFFIXES = [
  '.localhost', '.local', '.internal', '.lan', '.home', '.test', '.invalid', '.example', '.onion',
];
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff],
  [0x0a000000, 0x0affffff],
  [0x64400000, 0x647fffff],
  [0x7f000000, 0x7fffffff],
  [0xa9fe0000, 0xa9feffff],
  [0xac100000, 0xac1fffff],
  [0xc0000000, 0xc00000ff],
  [0xc0a80000, 0xc0a8ffff],
  [0xc6120000, 0xc613ffff],
  [0xe0000000, 0xffffffff],
];

export type WebsiteIconFetch = (input: URL, init?: RequestInit) => Promise<Response>;

export type WebsiteIconResult =
  | { success: true; value: { websiteUrl: string; iconUrl: string } }
  | { success: false; status: number; message: string };

class WebsiteIconError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function ipv4ToNumber(hostname: string): number | null {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return null;
  return octets.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!normalized || normalized === 'localhost') return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;

  const ipv4 = ipv4ToNumber(normalized);
  if (ipv4 !== null) {
    return BLOCKED_IPV4_RANGES.some(([start, end]) => ipv4 >= start && ipv4 <= end);
  }
  if (normalized.includes(':')) {
    return /^(?:::|::1|f[cd]|fe[89ab]|ff|2001:db8|::ffff:)/i.test(normalized);
  }
  return !normalized.includes('.');
}

function isPublicHttpUrl(url: URL): boolean {
  return ['http:', 'https:'].includes(url.protocol)
    && !url.username
    && !url.password
    && !isBlockedHostname(url.hostname);
}

function normalizeWebsiteUrl(value: unknown): URL {
  if (typeof value !== 'string' || !value.trim()) {
    throw new WebsiteIconError(400, '请先填写网站地址');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new WebsiteIconError(400, `网站地址不能超过 ${MAX_URL_LENGTH} 个字符`);
  }

  try {
    const source = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(source);
    url.hash = '';
    if (!isPublicHttpUrl(url)) throw new WebsiteIconError(400, '不允许访问本机或私网地址');
    return url;
  } catch (error) {
    if (error instanceof WebsiteIconError) throw error;
    throw new WebsiteIconError(400, '请填写有效的网站地址');
  }
}

function getHtmlAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp(
    "(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))",
    'i',
  );
  const match = pattern.exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

export function extractWebsiteIconUrl(html: string, documentUrl: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const rel = getHtmlAttribute(tag, 'rel');
    if (!rel?.toLocaleLowerCase().split(/\s+/).includes('icon')) continue;

    const href = getHtmlAttribute(tag, 'href')?.trim();
    if (!href) continue;
    try {
      const iconUrl = new URL(href, documentUrl);
      iconUrl.hash = '';
      if (isPublicHttpUrl(iconUrl)) return iconUrl.toString();
    } catch {
      // 忽略无效 href，继续查找下一个 rel="icon"。
    }
  }
  return null;
}

async function readHtml(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
    throw new WebsiteIconError(413, '网站页面过大，无法读取头像');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let html = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return html + decoder.decode();
    bytesRead += value.byteLength;
    if (bytesRead > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new WebsiteIconError(413, '网站页面过大，无法读取头像');
    }
    html += decoder.decode(value, { stream: true });
  }
}

async function fetchWebsiteHtml(
  startUrl: URL,
  fetcher: WebsiteIconFetch,
  signal: AbortSignal,
): Promise<{ html: string; websiteUrl: URL }> {
  let websiteUrl = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetcher(websiteUrl, {
      headers: { accept: 'text/html,application/xhtml+xml' },
      redirect: 'manual',
      signal,
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === MAX_REDIRECTS) {
        throw new WebsiteIconError(502, '网站重定向次数过多');
      }
      const redirectedUrl = new URL(location, websiteUrl);
      if (!isPublicHttpUrl(redirectedUrl)) {
        throw new WebsiteIconError(400, '网站重定向到了本机或私网地址');
      }
      websiteUrl = redirectedUrl;
      continue;
    }
    if (!response.ok) throw new WebsiteIconError(502, `网站返回状态 ${response.status}`);

    const contentType = response.headers.get('content-type')?.toLocaleLowerCase() || '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('xhtml')) {
      throw new WebsiteIconError(502, '网站返回的不是 HTML 页面');
    }
    return { html: await readHtml(response), websiteUrl };
  }
  throw new WebsiteIconError(502, '网站重定向次数过多');
}

export async function fetchWebsiteIcon(
  website: unknown,
  fetcher: WebsiteIconFetch = fetch,
): Promise<WebsiteIconResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const startUrl = normalizeWebsiteUrl(website);
    const { html, websiteUrl } = await fetchWebsiteHtml(startUrl, fetcher, controller.signal);
    const iconUrl = extractWebsiteIconUrl(html, websiteUrl.toString());
    if (!iconUrl) {
      return { success: false, status: 404, message: '网站没有声明 rel="icon" 图标' };
    }
    return { success: true, value: { websiteUrl: websiteUrl.toString(), iconUrl } };
  } catch (error) {
    if (error instanceof WebsiteIconError) {
      return { success: false, status: error.status, message: error.message };
    }
    const message = controller.signal.aborted ? '访问网站超时' : '无法访问该网站';
    return { success: false, status: controller.signal.aborted ? 504 : 502, message };
  } finally {
    clearTimeout(timeout);
  }
}
