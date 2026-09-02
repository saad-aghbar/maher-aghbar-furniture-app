import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type SheetOverlayYieldValue = {
  /** True while an overlay sheet (e.g. category picker) is presented — host sheets yield. */
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

const SheetOverlayYieldContext = createContext<SheetOverlayYieldValue | null>(null);

const FALLBACK_YIELD: SheetOverlayYieldValue = {
  isOpen: false,
  setOpen: () => undefined,
};

/**
 * Lets a host BottomSheet Modal yield when another BottomSheet is stacked on top
 * (avoids iOS nested-Modal races that dismiss the host permanently).
 */
export function SheetOverlayYieldProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpenState] = useState(false);
  const setOpen = useCallback((open: boolean) => {
    setOpenState(open);
  }, []);
  const value = useMemo(() => ({ isOpen, setOpen }), [isOpen, setOpen]);
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
