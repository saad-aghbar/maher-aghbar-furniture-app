'use client';

import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { useQuery } from '@tanstack/react-query';

export function useAuthMe() {
  return useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
