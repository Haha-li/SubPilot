const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!HTTP_PROTOCOLS.has(url.protocol) || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseFrontendOrigins(
  raw: string | undefined,
  fallback: string[] = [],
): string[] {
  const source = raw?.trim() ? raw.split(',') : fallback;
  const origins = source
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  return [...new Set(origins)];
}

export function resolveAllowedCorsOrigin(
  requestOrigin: string,
  configuredOrigins: string | undefined,
  fallback: string[] = [],
): string | undefined {
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) return undefined;
  const allowedOrigins = parseFrontendOrigins(configuredOrigins, fallback);
  return allowedOrigins.includes(normalizedRequestOrigin)
    ? normalizedRequestOrigin
    : undefined;
}
