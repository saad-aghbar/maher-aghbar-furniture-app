'use client';

import type { ReactNode } from 'react';
import { CodeScannerProvider } from './CodeScannerProvider';
import type { DeskCopy } from './desk-copy';

/** Root client wrapper: live QR/barcode scanner modal for all three web portals. */
export function DeskToolsProvider({
  children,
  copy,
}: {
  children: ReactNode;
  copy?: Partial<DeskCopy>;
}) {
  return <CodeScannerProvider copy={copy}>{children}</CodeScannerProvider>;
}
