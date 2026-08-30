import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { InteractionManager, Modal } from 'react-native';
import { CodeScannerScreen } from '@/components/scan/CodeScannerScreen';
import { beginQrSession, qrLog, qrWarn } from '@/features/inventory/qrSessionLog';

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
 *
 * Promise resolves when the camera Modal closes via InteractionManager + onDismiss
 * (idempotent). Callers must not present another RN Modal for confirmation — use inline UI.
 */
export function CodeScannerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [title, setTitle] = useState<string | undefined>();
  const [hint, setHint] = useState<string | undefined>();
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const qrSessionRef = useRef(0);
  const flushedRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current != null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const flushResolve = useCallback(
    (source: string) => {
      const resolve = resolverRef.current;
      if (!resolve || flushedRef.current) return;
      flushedRef.current = true;
      clearWatchdog();
      resolverRef.current = null;
      const value = pendingValueRef.current;
      pendingValueRef.current = null;
      const sid = qrSessionRef.current;
      setTitle(undefined);
      setHint(undefined);
      qrLog(sid, `Promise resolved ${value == null ? 'null (cancel)' : value} via ${source}`);
      resolve(value);
    },
    [clearWatchdog],
  );

  const finish = useCallback(
    (value: string | null) => {
      if (!resolverRef.current) return;
      const sid = qrSessionRef.current;
      pendingValueRef.current = value;
      qrLog(sid, value == null ? 'scanner close requested (cancel)' : `code accepted ${value}`);
      qrLog(sid, 'scanner close requested');
      setOpen(false);
      qrLog(sid, 'modal visible=false');

      // Dev watchdog: code detected but consumer never got a flush.
      if (typeof __DEV__ !== 'undefined' && __DEV__ && value != null) {
        clearWatchdog();
        watchdogRef.current = setTimeout(() => {
          if (!flushedRef.current) {
            qrWarn(
              sid,
              'WATCHDOG: code accepted but Promise not flushed within 2s — check Modal handoff',
            );
          }
        }, 2000);
      }
    },
    [clearWatchdog],
  );

  useEffect(() => {
    if (open) {
      qrLog(qrSessionRef.current, 'camera modal visible');
      return;
    }
    if (!resolverRef.current || flushedRef.current) return;

    const sid = qrSessionRef.current;
    const handle = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        qrLog(sid, 'fallback close completed');
        flushResolve('InteractionManager');
      });
    });

    return () => {
      handle.cancel();
    };
  }, [open, flushResolve]);

  const openScanner = useCallback((options?: ScanOptions) => {
    if (resolverRef.current) {
      clearWatchdog();
      pendingValueRef.current = null;
      const prev = resolverRef.current;
      resolverRef.current = null;
      flushedRef.current = true;
      prev(null);
    }
    const sid = beginQrSession(options?.title ?? 'scan');
    qrSessionRef.current = sid;
    flushedRef.current = false;
    pendingValueRef.current = null;
    setTitle(options?.title);
    setHint(options?.hint);
    setSession((n) => n + 1);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [clearWatchdog]);

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
        onDismiss={() => {
          qrLog(qrSessionRef.current, 'onDismiss fired');
          flushResolve('onDismiss');
        }}
        statusBarTranslucent
      >
        <CodeScannerScreen
          key={session}
          title={title}
          hint={hint}
          onConfirm={(code) => {
            qrLog(qrSessionRef.current, `code detected ${code}`);
            finish(code);
          }}
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
