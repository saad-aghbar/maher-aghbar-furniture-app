'use client';

import { usePathname } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { PortalShell } from './portal-shell';
import { OrderBasketProvider } from './order-basket-provider';

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') {
    return <>{children}</>;
  }
  return (
    <OrderBasketProvider>
      <PortalShell>{children}</PortalShell>
    </OrderBasketProvider>
  );
}
