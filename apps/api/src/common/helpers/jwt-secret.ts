/**
 * Resolve JWT signing secret. Production must set JWT_ACCESS_SECRET —
 * hardcoded fallback is development-only (Piece 14).
 */
export function resolveJwtAccessSecret(): string {
  const fromEnv = process.env.JWT_ACCESS_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET must be set when NODE_ENV=production');
  }
  return 'dev-access-secret-change-me-min-32-chars!!';
}
