'use client';

import { usePathname } from '@/i18n/navigation';
import { isAuthPath, surfaceFromPath } from '@/lib/paths';
import { OrderBasketProvider } from '@/components/order-basket-provider';
import type { ReactNode } from 'react';
import { AppShell } from './app-shell';
import { PortalShell } from './dealer/portal-shell';
import { EmployeeShell } from './worker/employee-shell';
import { OnlineRequiredBanner } from './online-required-banner';

export function ConditionalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAuthPath(pathname) || pathname === '/') {
    return <>{children}</>;
  }

  const surface = surfaceFromPath(pathname);
  if (surface === 'dealer') {
    return (
      <OrderBasketProvider>
        <PortalShell>
          <OnlineRequiredBanner />
          {children}
        </PortalShell>
      </OrderBasketProvider>
    );
  }
  if (surface === 'worker') {
    return (
      <EmployeeShell>
        <OnlineRequiredBanner />
        {children}
      </EmployeeShell>
    );
  }
  return (
    <AppShell>
      <OnlineRequiredBanner />
      {children}
    </AppShell>
  );
}
