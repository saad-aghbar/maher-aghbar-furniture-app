export type PageParams = {
  page?: number;
  pageSize?: number;
};

/** Build `?page=&pageSize=` (+ extra filters). */
export function toSearchParams(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function defaultPageParams(overrides: PageParams = {}): Required<PageParams> {
  return {
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 20,
  };
}
