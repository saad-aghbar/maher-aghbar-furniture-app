import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type SheetOverlayYieldValue = {
  /** True while one or more overlay sheets (or camera yields) are presented — host sheets yield. */
  isOpen: boolean;
  /** Acquire (`true`) or release (`false`) one yield. Prefer `acquire` / `release` for new call sites. */
  setOpen: (open: boolean) => void;
  acquire: () => void;
  release: () => void;
};

const SheetOverlayYieldContext = createContext<SheetOverlayYieldValue | null>(null);

const FALLBACK_YIELD: SheetOverlayYieldValue = {
  isOpen: false,
  setOpen: () => undefined,
  acquire: () => undefined,
  release: () => undefined,
};

/**
 * Lets a host BottomSheet Modal yield when another BottomSheet is stacked on top
 * (avoids iOS nested-Modal races that dismiss the host permanently).
 *
 * Yield is a counter so stacked overlays and unmount-during-open cannot leak
 * a stuck `true` that hides every non-overlay sheet.
 */
export function SheetOverlayYieldProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const acquire = useCallback(() => {
    setCount((n) => n + 1);
  }, []);
  const release = useCallback(() => {
    setCount((n) => Math.max(0, n - 1));
  }, []);
  const setOpen = useCallback(
    (open: boolean) => {
      if (open) acquire();
      else release();
    },
    [acquire, release],
  );
  const value = useMemo(
    () => ({ isOpen: count > 0, setOpen, acquire, release }),
    [count, setOpen, acquire, release],
  );
  return (
    <SheetOverlayYieldContext.Provider value={value}>
      {children}
    </SheetOverlayYieldContext.Provider>
  );
}

export function useSheetOverlayYield(): SheetOverlayYieldValue {
  const ctx = useContext(SheetOverlayYieldContext);
  return ctx ?? FALLBACK_YIELD;
}
