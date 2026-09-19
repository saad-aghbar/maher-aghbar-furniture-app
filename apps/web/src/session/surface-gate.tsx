'use client';

import { resolveAppSurface, type AppSurface } from '@maher/permissions';
import type { ReactNode } from 'react';
import { ForbiddenView } from './forbidden';
import { useSessionUser } from './session-provider';

const HOME: Record<AppSurface, string> = {
  admin: '/admin/dashboard',
  customer: '/dealer/dashboard',
  employee: '/worker/dashboard',
};

const EXPECTED_TO_SURFACE: Record<'admin' | 'dealer' | 'worker', AppSurface> = {
  admin: 'admin',
  dealer: 'customer',
  worker: 'employee',
};

export function SurfaceGate({
  expected,
  children,
}: {
  expected: 'admin' | 'dealer' | 'worker';
  children: ReactNode;
}) {
  const user = useSessionUser();
  if (!user) return <>{children}</>;
  const actual = resolveAppSurface(user);
  if (actual !== EXPECTED_TO_SURFACE[expected]) {
    return <ForbiddenView homeHref={HOME[actual]} />;
  }
  return <>{children}</>;
}
