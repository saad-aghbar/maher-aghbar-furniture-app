import type { PaginatedResponse } from '@maher/types';
import { apiGet } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type SearchHitType =
  | 'product'
  | 'sales_order'
  | 'request'
  | 'invoice'
  | 'customer'
  | 'inventory';

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export async function globalSearch(params: PageParams & { q: string }) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize ?? 20,
    q: params.q,
  });
  return apiGet<PaginatedResponse<SearchHit>>(`/search${qs}`);
}
