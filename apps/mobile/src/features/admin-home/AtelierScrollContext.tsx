import { createContext, useContext, type ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

type AtelierScrollCtx = {
  scrollY: SharedValue<number>;
};

const Ctx = createContext<AtelierScrollCtx | null>(null);

export function AtelierScrollProvider({ children }: { children: ReactNode }) {
  const scrollY = useSharedValue(0);
  return <Ctx.Provider value={{ scrollY }}>{children}</Ctx.Provider>;
}

export function useAtelierScroll(): AtelierScrollCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useAtelierScroll requires AtelierScrollProvider');
  }
  return ctx;
}

/**
 * Always returns a SharedValue — never null — so worklets never read `.value` of undefined.
 * Outside the provider, returns a local zero shared value (no parallax).
 */
export function useAtelierScrollY(): SharedValue<number> {
  const ctx = useContext(Ctx);
  const fallback = useSharedValue(0);
  return ctx?.scrollY ?? fallback;
}
