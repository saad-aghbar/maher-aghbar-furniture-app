import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

export type WindowMetrics = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
};

const WindowMetricsOverrideContext = createContext<Partial<WindowMetrics> | null>(null);

/**
 * Force window metrics for a subtree. Used by the dev adaptive gallery and by
 * tests that need to render a screen at a specific width without touching
 * `Dimensions` spies used elsewhere.
 */
export function WindowMetricsOverride({
  value,
  children,
}: {
  value: Partial<WindowMetrics> | null;
  children: ReactNode;
}) {
  return (
    <WindowMetricsOverrideContext.Provider value={value}>
      {children}
    </WindowMetricsOverrideContext.Provider>
  );
}

/**
 * The single seam between React Native window dimensions and the adaptive
 * layer. Everything adaptive reads width/height through here.
 */
export function useWindowMetrics(): WindowMetrics {
  const dims = useWindowDimensions();
  const override = useContext(WindowMetricsOverrideContext);
  return useMemo(() => {
    if (!override) return dims;
    return { ...dims, ...override };
  }, [dims, override]);
}
