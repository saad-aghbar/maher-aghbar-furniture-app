export type SearchInput = string | URLSearchParams | Record<string, string | string[] | undefined> | null | undefined;

export function toSearchParams(input: SearchInput): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (typeof input === 'string') return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  if (input instanceof URLSearchParams) return new URLSearchParams(input.toString());
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value != null && value !== '') {
      params.set(key, value);
    }
  }
  return params;
}

/** Keep the current query, then apply overrides. Null removes a key. */
export function compatHref(path: string, current?: SearchInput, set?: Record<string, string | null | undefined>): string {
  const params = toSearchParams(current);
  if (set) {
    for (const [key, value] of Object.entries(set)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function localeCompatHref(locale: string, path: string, current?: SearchInput, set?: Record<string, string | null | undefined>): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return compatHref(`/${locale}${normalized}`, current, set);
}
