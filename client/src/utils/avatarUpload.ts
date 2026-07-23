export const MAX_AVATAR_UPLOAD_BYTES = 256 * 1_024;

const ALLOWED_AVATAR_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export const AVATAR_UPLOAD_ACCEPT = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico',
].join(',');

export function validateAvatarFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type.toLocaleLowerCase())) {
    return '上传头像仅支持 PNG、JPG、WebP、GIF、AVIF 或 ICO';
  }
  if (!file.size) return '上传头像不能为空';
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) return '上传头像不能超过 256 KB';
  return null;
}

export function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('读取头像文件失败'));
    };
    reader.onerror = () => reject(new Error('读取头像文件失败'));
    reader.readAsDataURL(file);
  });
}
