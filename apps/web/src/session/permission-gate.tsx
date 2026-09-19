'use client';

import { can, type Permission } from '@maher/permissions';
import type { ReactNode } from 'react';
import { ForbiddenView } from './forbidden';
import { useSessionUser } from './session-provider';

export function PermissionGate({
  anyOf,
  children,
}: {
  anyOf: readonly Permission[];
  children: ReactNode;
}) {
  const user = useSessionUser();
  if (!user) return <>{children}</>;
  const allowed = anyOf.some((permission) => can(user, permission));
  if (!allowed) return <ForbiddenView />;
  return <>{children}</>;
}
