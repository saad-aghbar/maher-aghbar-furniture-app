import { type ReactNode } from 'react';
import type { AuthUser } from '@maher/types';
import type { Permission } from '@maher/permissions';
import { canAll, canAny } from '@maher/permissions';
import { ForbiddenView } from './ForbiddenView';

type PermissionGateProps = {
  user: AuthUser | null;
  require?: Permission | Permission[];
  mode?: 'any' | 'all';
  children: ReactNode;
};

export function PermissionGate({
  user,
  require,
  mode = 'any',
  children,
}: PermissionGateProps) {
  if (!require) return <>{children}</>;
  if (!user) return null;

  const list = Array.isArray(require) ? require : [require];
  const ok = mode === 'all' ? canAll(user, list) : canAny(user, list);
  if (!ok) return <ForbiddenView />;
  return <>{children}</>;
}
