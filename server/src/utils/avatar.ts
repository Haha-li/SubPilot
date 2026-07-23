const MAX_URL_LENGTH = 2_048;
const MAX_UPLOADED_AVATAR_BYTES = 256 * 1_024;
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;
const BASE64_PATTERN = /^[A-Z\d+/]+={0,2}$/i;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

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

function decodedBase64Size(payload: string): number | null {
  if (!payload || payload.length % 4 !== 0 || !BASE64_PATTERN.test(payload)) return null;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return (payload.length / 4) * 3 - padding;
}

function normalizeUploadedAvatar(value: string): string | { error: string } {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(value);
  if (!match) return { error: '上传头像数据格式不正确' };

  const mimeType = match[1].toLocaleLowerCase();
  if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
    return { error: '上传头像仅支持 PNG、JPG、WebP、GIF、AVIF 或 ICO' };
  }
  const bytes = decodedBase64Size(match[2]);
  if (bytes === null) return { error: '上传头像数据格式不正确' };
  if (bytes > MAX_UPLOADED_AVATAR_BYTES) {
    return { error: '上传头像不能超过 256 KB' };
  }
  return `data:${mimeType};base64,${match[2]}`;
}

function normalizeIconUrl(value: unknown): string | { error: string } {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return { error: '头像地址格式不正确' };

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.toLocaleLowerCase().startsWith('data:')) {
    return normalizeUploadedAvatar(trimmed);
  }
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
