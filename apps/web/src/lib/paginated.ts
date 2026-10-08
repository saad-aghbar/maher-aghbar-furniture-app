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

/**
 * A list, whether the cache holds a bare array or a `{ data }` envelope.
 * Shared query keys sometimes store either shape.
 */
export function asRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const rows = (payload as { data?: unknown }).data;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

/** Accepts both `{ data, meta }` envelopes and bare arrays (legacy endpoints). */
export function unwrapList<T>(payload: Paginated<T> | T[] | { data: T[] } | null | undefined): { rows: T[]; meta: PaginatedMeta | null } {
  if (!payload) return { rows: [], meta: null };
  if (Array.isArray(payload)) return { rows: payload, meta: null };
  const meta = 'meta' in payload && payload.meta ? payload.meta : null;
  return { rows: asRows<T>(payload), meta };
}
