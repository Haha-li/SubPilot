const MAX_NAME_LENGTH = 100;
const MAX_URL_LENGTH = 2_048;

export interface CommonSubscriptionInput {
  name?: unknown;
  website?: unknown;
  iconUrl?: unknown;
}

export interface NormalizedCommonSubscription {
  name: string;
  website: string;
  iconUrl: string;
}

interface CommonSubscriptionLike {
  id?: number;
  name: string;
  website: string;
}

type NormalizeResult =
  | { success: true; value: NormalizedCommonSubscription }
  | { success: false; message: string };

function normalizeHttpUrl(value: unknown, label: string): string | { error: string } {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return { error: `${label}格式不正确` };

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_URL_LENGTH) return { error: `${label}不能超过 ${MAX_URL_LENGTH} 个字符` };

  const source = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { error: `${label}仅支持 http 或 https` };
    }
    if (!url.hostname || url.username || url.password) {
      return { error: `${label}格式不正确` };
    }
    url.hash = '';
    return url.toString();
  } catch {
    return { error: `${label}格式不正确` };
  }
}

export function normalizeCommonSubscriptionInput(
  input: CommonSubscriptionInput,
  existing?: NormalizedCommonSubscription,
): NormalizeResult {
  const rawName = input.name !== undefined ? input.name : existing?.name;
  if (typeof rawName !== 'string' || !rawName.trim()) {
    return { success: false, message: '名称为必填项' };
  }

  const name = rawName.trim();
  if (name.length > MAX_NAME_LENGTH) {
    return { success: false, message: `名称不能超过 ${MAX_NAME_LENGTH} 个字符` };
  }

  const website = normalizeHttpUrl(
    input.website !== undefined ? input.website : existing?.website,
    '网站地址',
  );
  if (typeof website !== 'string') return { success: false, message: website.error };

  const iconUrl = normalizeHttpUrl(
    input.iconUrl !== undefined ? input.iconUrl : existing?.iconUrl,
    '头像地址',
  );
  if (typeof iconUrl !== 'string') return { success: false, message: iconUrl.error };

  return { success: true, value: { name, website, iconUrl } };
}

function canonicalWebsite(value: string): string {
  const normalized = normalizeHttpUrl(value, '网站地址');
  return typeof normalized === 'string' ? normalized.toLocaleLowerCase() : value.trim().toLocaleLowerCase();
}

export function findDuplicateCommonSubscription<T extends CommonSubscriptionLike>(
  entries: T[],
  candidate: CommonSubscriptionLike,
  currentId?: number,
): { field: 'name' | 'website'; item: T } | null {
  const normalizedName = candidate.name.trim().toLocaleLowerCase();
  const normalizedWebsite = candidate.website ? canonicalWebsite(candidate.website) : '';

  for (const item of entries) {
    if (currentId !== undefined && item.id === currentId) continue;
    if (item.name.trim().toLocaleLowerCase() === normalizedName) {
      return { field: 'name', item };
    }
    if (normalizedWebsite && canonicalWebsite(item.website) === normalizedWebsite) {
      return { field: 'website', item };
    }
  }
  return null;
}
