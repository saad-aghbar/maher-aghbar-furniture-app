'use client';

import type { AuthUser } from '@maher/types';
import { createContext, useContext, type ReactNode } from 'react';

const SessionContext = createContext<AuthUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): AuthUser | null {
  return useContext(SessionContext);
}
