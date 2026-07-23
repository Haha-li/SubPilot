const MAX_URL_LENGTH = 2_048;
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

export interface AvatarFieldsInput {
  iconUrl?: unknown;
  backgroundColor?: unknown;
}

export interface AvatarFields {
  iconUrl: string;
  backgroundColor: string;
}

type AvatarResult =
  | { success: true; value: AvatarFields }
  | { success: false; message: string };

function normalizeIconUrl(value: unknown): string | { error: string } {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return { error: '头像地址格式不正确' };

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_URL_LENGTH) {
    return { error: `头像地址不能超过 ${MAX_URL_LENGTH} 个字符` };
  }

  const source = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { error: '头像地址仅支持 http 或 https' };
    }
    if (!url.hostname || url.username || url.password) {
      return { error: '头像地址格式不正确' };
    }
    url.hash = '';
    return url.toString();
  } catch {
    return { error: '头像地址格式不正确' };
  }
}

function normalizeBackgroundColor(value: unknown): string | { error: string } {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return { error: '头像背景色必须是 6 位十六进制颜色' };

  const normalized = value.trim().toUpperCase();
  return HEX_COLOR_PATTERN.test(normalized)
    ? normalized
    : { error: '头像背景色必须是 6 位十六进制颜色' };
}

export function normalizeAvatarFields(
  input: AvatarFieldsInput,
  existing?: AvatarFields,
): AvatarResult {
  const iconUrl = normalizeIconUrl(
    input.iconUrl !== undefined ? input.iconUrl : existing?.iconUrl,
  );
  if (typeof iconUrl !== 'string') return { success: false, message: iconUrl.error };

  const backgroundColor = normalizeBackgroundColor(
    input.backgroundColor !== undefined ? input.backgroundColor : existing?.backgroundColor,
  );
  if (typeof backgroundColor !== 'string') {
    return { success: false, message: backgroundColor.error };
  }

  return { success: true, value: { iconUrl, backgroundColor } };
}
