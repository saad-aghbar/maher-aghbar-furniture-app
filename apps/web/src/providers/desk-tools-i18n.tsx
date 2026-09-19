'use client';

import { DEFAULT_DESK_COPY, DeskToolsProvider, type DeskCopy } from '@maher/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

function pick(t: ReturnType<typeof useTranslations>, key: string, fallback: string) {
  try {
    if (typeof t.has === 'function' && !t.has(key)) return fallback;
    const value = t(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

export function DeskToolsI18n({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const copy: Partial<DeskCopy> = {
    scanTitle: pick(t, 'scanTitle', DEFAULT_DESK_COPY.scanTitle),
    scanHint: pick(t, 'scanHint', DEFAULT_DESK_COPY.scanHint),
    scanTypedLabel: pick(t, 'scanTypedLabel', DEFAULT_DESK_COPY.scanTypedLabel),
    scanConfirm: pick(t, 'scanConfirm', DEFAULT_DESK_COPY.scanConfirm),
    scanRescan: pick(t, 'scanRescan', DEFAULT_DESK_COPY.scanRescan),
    scanPermission: pick(t, 'scanPermission', DEFAULT_DESK_COPY.scanPermission),
    scanNoCamera: pick(t, 'scanNoCamera', DEFAULT_DESK_COPY.scanNoCamera),
    scanTorchOn: pick(t, 'scanTorchOn', DEFAULT_DESK_COPY.scanTorchOn),
    scanTorchOff: pick(t, 'scanTorchOff', DEFAULT_DESK_COPY.scanTorchOff),
    cameraTitle: pick(t, 'cameraTitle', DEFAULT_DESK_COPY.cameraTitle),
    cameraSnap: pick(t, 'cameraSnap', DEFAULT_DESK_COPY.cameraSnap),
    cameraLibrary: pick(t, 'cameraLibrary', DEFAULT_DESK_COPY.cameraLibrary),
    cameraUrl: pick(t, 'attachFromUrl', DEFAULT_DESK_COPY.cameraUrl),
    printQr: pick(t, 'printQr', DEFAULT_DESK_COPY.printQr),
    filterApply: pick(t, 'filterApply', DEFAULT_DESK_COPY.filterApply),
    filterClear: pick(t, 'filterClear', DEFAULT_DESK_COPY.filterClear),
    close: pick(t, 'close', DEFAULT_DESK_COPY.close),
    cancel: pick(t, 'cancel', DEFAULT_DESK_COPY.cancel),
  };
  return <DeskToolsProvider copy={copy}>{children}</DeskToolsProvider>;
}
