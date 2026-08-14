const LOOPBACK = /^(localhost|127\.0\.0\.1)$/i;
const PRIVATE_IPV4 =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

export function isAllowedCorsOrigin(
  origin: string | undefined,
  opts: { allowlist: string[]; allowPrivateLan: boolean },
): boolean {
  if (!origin) return true;
  if (opts.allowlist.includes(origin)) return true;
  if (!opts.allowPrivateLan) return false;
  if (origin.startsWith('exp://') || origin.startsWith('exps://')) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    if (LOOPBACK.test(host) || host.endsWith('.local')) return true;
    return PRIVATE_IPV4.test(host);
  } catch {
    return false;
  }
}

export function corsAllowlistFromEnv(raw?: string): string[] {
  return (raw ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
