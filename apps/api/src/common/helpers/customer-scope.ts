import type { AuthUser } from '@maher/types';

/** When the caller is a customer portal user, restrict queries to their customerId. */
export function customerScopeFilter(user?: AuthUser | null): { customerId?: string } {
  if (user?.customerId) return { customerId: user.customerId };
  return {};
}

export function assertCustomerOwns(
  user: AuthUser | null | undefined,
  resourceCustomerId: string | null | undefined,
): boolean {
  if (!user?.customerId) return true;
  return Boolean(resourceCustomerId && resourceCustomerId === user.customerId);
}
