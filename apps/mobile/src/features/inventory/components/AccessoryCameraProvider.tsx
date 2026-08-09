import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from 'react-native';
import { AccessoryCameraScreen } from './AccessoryCameraScreen';

export type AccessoryCameraOptions = {
  title?: string;
  hint?: string;
  /**
   * Viewfinder width ÷ height. Defaults to 4/3 (inventory).
   * Product photos use `1.2` to match the admin PDP media board.
   */
  aspectRatio?: number;
};

type AccessoryCameraContextValue = {
  /** True while the themed accessory camera is visible — sheets should hide underneath. */
  isOpen: boolean;
  openAccessoryCamera: (options?: AccessoryCameraOptions) => Promise<string | null>;
};

const AccessoryCameraContext = createContext<AccessoryCameraContextValue | null>(null);

/**
 * Hosts the full-screen themed accessory photo camera.
 * Parent bottom-sheet Modals must yield (`visible={!isOpen}`) so this layer can appear.
 */
export function AccessoryCameraProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string | undefined>();
  const [hint, setHint] = useState<string | undefined>();
  const [aspectRatio, setAspectRatio] = useState<number | undefined>();
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const finish = useCallback((value: string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    setTitle(undefined);
    setHint(undefined);
    setAspectRatio(undefined);
    resolve?.(value);
  }, []);

  const openAccessoryCamera = useCallback((options?: AccessoryCameraOptions) => {
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }
    setTitle(options?.title);
    setHint(options?.hint);
    setAspectRatio(options?.aspectRatio);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(
    () => ({ isOpen: open, openAccessoryCamera }),
    [open, openAccessoryCamera],
  );

  return (
    <AccessoryCameraContext.Provider value={value}>
      {children}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => finish(null)}
        statusBarTranslucent
      >
        <AccessoryCameraScreen
          title={title}
          hint={hint}
          aspectRatio={aspectRatio}
          onConfirm={(uri) => finish(uri)}
          onCancel={() => finish(null)}
        />
      </Modal>
    </AccessoryCameraContext.Provider>
  );
}

export function useAccessoryCamera(): AccessoryCameraContextValue {
  const ctx = useContext(AccessoryCameraContext);
  if (!ctx) {
    throw new Error('useAccessoryCamera must be used within AccessoryCameraProvider');
  }
  return ctx;
}

/** Safe for sheets that may render outside the provider during tests. */
export function useAccessoryCameraState(): { isOpen: boolean } {
  const ctx = useContext(AccessoryCameraContext);
  return { isOpen: ctx?.isOpen ?? false };
}
