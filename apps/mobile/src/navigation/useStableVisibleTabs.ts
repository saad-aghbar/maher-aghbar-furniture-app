import { useMemo, useRef } from 'react';
import type { AppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { tabLayoutKey, visibleTabsForUser, type TabDef } from './tabConfig';

const CLEARED_STATUSES = new Set(['unauthenticated', 'session_expired', 'disabled']);

/**
 * Keep the last permission-resolved tab set while `/auth/me` is in flight.
 * Clear only on logout / session expiry so Admin → Staff cannot leak chips.
 */
export function useStableVisibleTabs(surface: AppSurface): {
  tabs: TabDef[];
  layoutKey: string;
} {
  const { user, status } = useAuth();
  const lastRef = useRef<TabDef[]>([]);

  return useMemo(() => {
    if (CLEARED_STATUSES.has(status)) {
      lastRef.current = [];
      return { tabs: [], layoutKey: `${surface}:cleared` };
    }
    if (user) {
      const tabs = visibleTabsForUser(surface, user);
      lastRef.current = tabs;
      return { tabs, layoutKey: tabLayoutKey(surface, user.permissions) };
    }
    return { tabs: lastRef.current, layoutKey: `${surface}:pending` };
  }, [surface, user, status]);
}
