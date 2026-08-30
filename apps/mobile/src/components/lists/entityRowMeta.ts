/** Lift `STATUS • rest` into a badge + meta pair for EntityRow. */
export function splitSearchMeta(subtitle?: string | null): {
  status?: string;
  meta?: string;
} {
  if (!subtitle) return {};
  const [left, ...rest] = subtitle.split(' • ');
  const status = left?.trim();
  if (rest.length > 0 && status && /^[A-Z][A-Z0-9_]*$/.test(status)) {
    return { status, meta: rest.join(' • ') };
  }
  return { meta: subtitle };
}
