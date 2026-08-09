import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type LocationMapVisibilityValue = {
  /** True while the location map Modal is visible — sheets must hide underneath. */
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

const LocationMapVisibilityContext = createContext<LocationMapVisibilityValue | null>(null);

/**
 * Lets bottom-sheet Modals yield when a location map picker is presented
 * (same pattern as accessory camera / code scanner).
 */
export function LocationMapVisibilityProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpenState] = useState(false);
  const setOpen = useCallback((open: boolean) => {
    setOpenState(open);
  }, []);
  const value = useMemo(() => ({ isOpen, setOpen }), [isOpen, setOpen]);
  return (
    <LocationMapVisibilityContext.Provider value={value}>
      {children}
    </LocationMapVisibilityContext.Provider>
  );
}

/** Safe for sheets that may render outside the provider during tests. */
export function useLocationMapVisibility(): LocationMapVisibilityValue {
  const ctx = useContext(LocationMapVisibilityContext);
  return ctx ?? { isOpen: false, setOpen: () => undefined };
}
