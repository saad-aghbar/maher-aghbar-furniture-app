import type { QueryClient } from '@tanstack/react-query';

/** Drop the previous account's cached name, tasks, basket, and notifications. */
export function resetAccountClientState(queryClient: QueryClient): void {
  queryClient.clear();
}
