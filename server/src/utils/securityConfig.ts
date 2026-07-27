const MIN_JWT_SECRET_LENGTH = 32;

const INSECURE_JWT_SECRETS = new Set([
  'subpilot-default-secret-change-me',
  'change-this-in-production',
  'change-this-to-a-random-secret-key',
  'replace-with-a-random-secret',
]);

const INSECURE_ADMIN_PASSWORDS = new Set([
  'password',
  'admin',
  '123456',
  'change-me',
  'change-this-password',
  'replace-with-a-strong-admin-password',
]);

export class SecurityConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityConfigError';
  }
}

function requireNonEmpty(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new SecurityConfigError(`${name} 未配置`);
  }
  return value.trim();
}

export function requireJwtSecret(value: string | undefined): string {
  const secret = requireNonEmpty(value, 'JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new SecurityConfigError(`JWT_SECRET 长度必须至少为 ${MIN_JWT_SECRET_LENGTH} 个字符`);
  }
  if (INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new SecurityConfigError('JWT_SECRET 不能使用项目默认值或示例值');
  }
  return secret;
}

export function requireAdminPassword(value: string | undefined): string {
  const password = requireNonEmpty(value, 'ADMIN_PASSWORD');
  if (INSECURE_ADMIN_PASSWORDS.has(password.toLowerCase())) {
    throw new SecurityConfigError('ADMIN_PASSWORD 不能使用默认或常见弱密码');
  }
  return password;
}

export function assertAuthConfiguration(input: {
  jwtSecret: string | undefined;
  adminPassword: string | undefined;
}): void {
  requireJwtSecret(input.jwtSecret);
  requireAdminPassword(input.adminPassword);
}
