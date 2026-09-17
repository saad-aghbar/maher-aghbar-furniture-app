import { createContext, useContext, type ReactNode } from 'react';
import type { AppSurface } from '@maher/permissions';

const AdaptiveSurfaceContext = createContext<AppSurface | null>(null);

/**
 * Tells the adaptive layer which surface (admin / customer / employee) the
 * authenticated shell resolved, so `useMaherLayout().navigationMode` follows
 * the surface rules without every screen passing it in.
 */
export function AdaptiveSurfaceProvider({
  surface,
  children,
}: {
  surface: AppSurface;
  children: ReactNode;
}) {
  return (
    <AdaptiveSurfaceContext.Provider value={surface}>{children}</AdaptiveSurfaceContext.Provider>
  );
}

/** Surface for adaptive decisions. Defaults to `admin` outside the shell (auth, dev). */
export function useAdaptiveSurface(): AppSurface {
  return useContext(AdaptiveSurfaceContext) ?? 'admin';
}
