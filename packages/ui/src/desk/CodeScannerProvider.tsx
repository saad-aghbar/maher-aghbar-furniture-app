'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CodeScanner } from './CodeScanner';
import type { DeskCopy } from './desk-copy';

export type OpenScannerOptions = {
  title?: string;
  hint?: string;
};

type ScannerApi = {
  openScanner: (opts?: OpenScannerOptions) => Promise<string | null>;
};

const ScannerContext = createContext<ScannerApi | null>(null);

export function CodeScannerProvider({
  children,
  copy,
}: {
  children: ReactNode;
  copy?: Partial<DeskCopy>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string | undefined>();
  const [hint, setHint] = useState<string | undefined>();
  const resolverRef = useRef<((code: string | null) => void) | null>(null);

  const finish = useCallback((code: string | null) => {
    resolverRef.current?.(code);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const openScanner = useCallback((opts?: OpenScannerOptions) => {
    setTitle(opts?.title);
    setHint(opts?.hint);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo<ScannerApi>(() => ({ openScanner }), [openScanner]);

  return (
    <ScannerContext.Provider value={value}>
      {children}
      <CodeScanner
        open={open}
        title={title}
        hint={hint}
        copy={copy}
        onClose={() => finish(null)}
        onConfirm={(code) => finish(code)}
      />
    </ScannerContext.Provider>
  );
}

export function useCodeScanner(): ScannerApi {
  const ctx = useContext(ScannerContext);
  if (!ctx) {
    throw new Error('useCodeScanner must be used inside CodeScannerProvider');
  }
  return ctx;
}

export function useOptionalCodeScanner(): ScannerApi | null {
  return useContext(ScannerContext);
}
