const ICONIFY_SEARCH_URL = 'https://api.iconify.design/search';
const ICONIFY_ICON_URL = 'https://api.iconify.design';
const SIMPLE_ICONS_PREFIX = 'simple-icons:';
const ICON_SEARCH_LIMIT = '1';
const ICON_REQUEST_TIMEOUT_MS = 4_000;
const CHINESE_SUBSCRIPTION_SUFFIX = /(?:\s*(?:会员|订阅|套餐|服务|账号|账户|年付|月付|季付|高级版|家庭版|个人版))+$/u;
const ENGLISH_SUBSCRIPTION_SUFFIX = /(?:\s+(?:premium|plus|pro|membership|subscription|plan))+$/i;

interface IconifySearchResponse {
  icons?: string[];
}

const brandIconCache = new Map<string, Promise<string | null>>();

function buildSearchQueries(name: string): string[] {
  const original = name.trim();
  const simplified = original
    .replace(CHINESE_SUBSCRIPTION_SUFFIX, '')
    .replace(ENGLISH_SUBSCRIPTION_SUFFIX, '')
    .trim();

  return Array.from(new Set([original, simplified].filter(Boolean)));
}

function buildIconUrl(icon: string): string | null {
  if (!icon.startsWith(SIMPLE_ICONS_PREFIX)) return null;
  const slug = icon.slice(SIMPLE_ICONS_PREFIX.length);
  if (!slug) return null;

  const url = new URL(`${ICONIFY_ICON_URL}/simple-icons/${encodeURIComponent(slug)}.svg`);
  url.searchParams.set('color', '#ffffff');
  return url.toString();
}

async function searchBrandIcon(query: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ICON_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(ICONIFY_SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('prefixes', 'simple-icons');
    url.searchParams.set('limit', ICON_SEARCH_LIMIT);
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return null;
    const data = await response.json() as IconifySearchResponse;
    return buildIconUrl(data.icons?.[0] || '');
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function findBrandIcon(name: string): Promise<string | null> {
  for (const query of buildSearchQueries(name)) {
    const iconUrl = await searchBrandIcon(query);
    if (iconUrl) return iconUrl;
  }
  return null;
}

export function resolveBrandIcon(name: string): Promise<string | null> {
  const cacheKey = name.trim().toLocaleLowerCase();
  if (!cacheKey) return Promise.resolve(null);

  const cached = brandIconCache.get(cacheKey);
  if (cached) return cached;

  const request = findBrandIcon(name);
  brandIconCache.set(cacheKey, request);
  return request;
}
