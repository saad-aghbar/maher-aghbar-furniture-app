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
import { CodeScannerScreen } from '@/components/scan/CodeScannerScreen';

export type ScanOptions = {
  title?: string;
  hint?: string;
};

type CodeScannerContextValue = {
  /** True while the themed camera UI is visible — sheets should hide underneath. */
  isScanning: boolean;
  openScanner: (options?: ScanOptions) => Promise<string | null>;
};

const CodeScannerContext = createContext<CodeScannerContextValue | null>(null);

/**
 * Hosts the full-screen themed QR/barcode camera.
 * Parent bottom-sheet Modals must yield (`visible={!isScanning}`) so this layer can appear.
 */
export function CodeScannerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string | undefined>();
  const [hint, setHint] = useState<string | undefined>();
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const finish = useCallback((value: string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    setTitle(undefined);
    setHint(undefined);
    resolve?.(value);
  }, []);

  const openScanner = useCallback((options?: ScanOptions) => {
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }
    setTitle(options?.title);
    setHint(options?.hint);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(
    () => ({ isScanning: open, openScanner }),
    [open, openScanner],
  );

  return (
    <CodeScannerContext.Provider value={value}>
      {children}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => finish(null)}
        statusBarTranslucent
      >
        <CodeScannerScreen
          title={title}
          hint={hint}
          onConfirm={(code) => finish(code)}
          onCancel={() => finish(null)}
        />
      </Modal>
    </CodeScannerContext.Provider>
  );
}

export function useCodeScanner(): CodeScannerContextValue {
  const ctx = useContext(CodeScannerContext);
  if (!ctx) {
    throw new Error('useCodeScanner must be used within CodeScannerProvider');
  }
  return ctx;
}

/** Safe for sheets that may render outside the provider during tests. */
export function useCodeScannerState(): { isScanning: boolean } {
  const ctx = useContext(CodeScannerContext);
  return { isScanning: ctx?.isScanning ?? false };
}
