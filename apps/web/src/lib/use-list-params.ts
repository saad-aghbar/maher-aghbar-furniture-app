'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type ListParamValue = string | number | boolean | null | undefined;

export interface ListParamsOptions<T extends Record<string, ListParamValue>> {
  /** Defaults; keys equal to their default are dropped from the URL. */
  defaults: T;
  /** Keys that reset `page` to 1 when they change (default: every key except page/pageSize). */
  resetPageOn?: Array<keyof T>;
}

/**
 * URL-synced list state (`q`, `status`, `page`, dates, sort…). Every list page
 * uses this so filters are shareable and survive refresh. Values are coerced
 * back to the type of their default (number / boolean / string).
 */
export function useListParams<T extends Record<string, ListParamValue>>({ defaults, resetPageOn }: ListParamsOptions<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const params = useMemo(() => {
    const out = { ...defaults } as T;
    (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
      const raw = search.get(String(key));
      if (raw == null) return;
      const def = defaults[key];
      let value: ListParamValue = raw;
      if (typeof def === 'number') {
        const n = Number(raw);
        value = Number.isFinite(n) ? n : def;
      } else if (typeof def === 'boolean') {
        value = raw === '1' || raw === 'true';
      }
      (out as Record<string, ListParamValue>)[String(key)] = value;
    });
    return out;
  }, [search, defaults]);

  const set = useCallback(
    (patch: Partial<T>, opts?: { replace?: boolean }) => {
      const next = new URLSearchParams(search.toString());
      const resetKeys = resetPageOn ?? (Object.keys(defaults).filter((k) => k !== 'page' && k !== 'pageSize') as Array<keyof T>);
      let touchedFilter = false;
      (Object.keys(patch) as Array<keyof T>).forEach((key) => {
        const value = patch[key];
        const def = defaults[key];
        if (resetKeys.includes(key) && value !== params[key]) touchedFilter = true;
        if (value == null || value === '' || value === def) next.delete(String(key));
        else next.set(String(key), typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      });
      if (touchedFilter && 'page' in defaults && !('page' in patch)) next.delete('page');
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [search, pathname, router, defaults, params, resetPageOn],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  /** Count of filter keys that differ from their defaults (for the Filters stamp). */
  const activeCount = useMemo(
    () =>
      (Object.keys(defaults) as Array<keyof T>).filter((k) => k !== 'page' && k !== 'pageSize' && k !== 'q' && params[k] !== defaults[k] && params[k] !== '' && params[k] != null).length,
    [defaults, params],
  );

  return { params, set, reset, activeCount };
}

/** Build an API query string from list params, dropping empties and defaults-as-empty. */
export function toApiQuery(values: Record<string, ListParamValue>, map?: Record<string, string>): string {
  const qs = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value == null || value === '' || value === false) return;
    qs.set(map?.[key] ?? key, typeof value === 'boolean' ? 'true' : String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}
