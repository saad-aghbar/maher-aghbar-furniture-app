/** Shape every paginated API list returns (`paginatedMeta` in apps/api). */
export interface PaginatedMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginatedMeta;
}

/** Accepts both `{ data, meta }` envelopes and bare arrays (legacy endpoints). */
export function unwrapList<T>(payload: Paginated<T> | T[] | { data: T[] } | null | undefined): { rows: T[]; meta: PaginatedMeta | null } {
  if (!payload) return { rows: [], meta: null };
  if (Array.isArray(payload)) return { rows: payload, meta: null };
  const meta = 'meta' in payload && payload.meta ? payload.meta : null;
  return { rows: payload.data ?? [], meta };
}
