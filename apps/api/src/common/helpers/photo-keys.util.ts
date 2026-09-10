/** Pack one or many storage keys into a String column (JSON array when >1). */
export function packPhotoKeys(keys: Array<string | null | undefined>): string | null {
  const clean = keys
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter(Boolean);
  if (!clean.length) return null;
  if (clean.length === 1) return clean[0]!;
  return JSON.stringify(clean);
}

/** Unpack a legacy single key or a JSON array of keys. */
export function unpackPhotoKeys(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
          .map((s) => s.trim());
      }
    } catch {
      /* fall through — treat as literal key */
    }
  }
  return [trimmed];
}
