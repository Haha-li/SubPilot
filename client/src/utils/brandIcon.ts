const ICONIFY_SEARCH_URL = 'https://api.iconify.design/search';
const SIMPLE_ICONS_CDN_URL = 'https://cdn.simpleicons.org';
const GOOGLE_FAVICON_URL = 'https://www.google.com/s2/favicons';
const SIMPLE_ICONS_PREFIX = 'simple-icons:';
const ICON_SEARCH_LIMIT = '1';
const ICON_REQUEST_TIMEOUT_MS = 4_000;
const CHINESE_SUBSCRIPTION_SUFFIX = /(?:\s*(?:会员|订阅|套餐|服务|账号|账户|年付|月付|季付|高级版|家庭版|个人版))+$/u;
const ENGLISH_SUBSCRIPTION_SUFFIX = /(?:\s+(?:premium|plus|pro|membership|subscription|plan))+$/i;

interface IconifySearchResponse {
  icons?: string[];
}

const brandIconCache = new Map<string, Promise<string | null>>();

export function getWebsiteHostname(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) return null;

  const source = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    return url.hostname.toLocaleLowerCase();
  } catch {
    return null;
  }
}

export function buildWebsiteFaviconUrl(website: string): string | null {
  const hostname = getWebsiteHostname(website);
  if (!hostname) return null;

  const url = new URL(GOOGLE_FAVICON_URL);
  url.searchParams.set('domain', hostname);
  url.searchParams.set('sz', '128');
  return url.toString();
}

export function buildBrandSearchQueries(name: string, website = ''): string[] {
  const original = name.trim();
  const simplified = original
    .replace(CHINESE_SUBSCRIPTION_SUFFIX, '')
    .replace(ENGLISH_SUBSCRIPTION_SUFFIX, '')
    .trim();
  const hostname = getWebsiteHostname(website)?.replace(/^www\./, '') || '';
  const domainBrand = hostname.split('.')[0] || '';

  const queries: string[] = [];
  const seen = new Set<string>();
  for (const query of [simplified, original, domainBrand, hostname]) {
    const key = query.toLocaleLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    queries.push(query);
  }

  return queries;
}

function buildIconUrl(icon: string): string | null {
  if (!icon.startsWith(SIMPLE_ICONS_PREFIX)) return null;
  const slug = icon.slice(SIMPLE_ICONS_PREFIX.length);
  if (!slug) return null;

  return new URL(encodeURIComponent(slug), `${SIMPLE_ICONS_CDN_URL}/`).toString();
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

async function findBrandIcon(name: string, website: string): Promise<string | null> {
  const results = await Promise.all(
    buildBrandSearchQueries(name, website).map((query) => searchBrandIcon(query)),
  );
  const matchedIcon = results.find(Boolean);
  if (matchedIcon) return matchedIcon;
  return buildWebsiteFaviconUrl(website);
}

export function resolveBrandIcon(name: string, website = '', force = false): Promise<string | null> {
  const normalizedName = name.trim().toLocaleLowerCase();
  const normalizedWebsite = website.trim().toLocaleLowerCase();
  if (!normalizedName && !normalizedWebsite) return Promise.resolve(null);
  const cacheKey = `${normalizedName}|${normalizedWebsite}`;

  const cached = brandIconCache.get(cacheKey);
  if (cached && !force) return cached;

  const request = findBrandIcon(name, website);
  brandIconCache.set(cacheKey, request);
  return request;
}
