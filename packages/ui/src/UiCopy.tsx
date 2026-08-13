'use client';

import { createContext, useContext, type ReactNode } from 'react';

type UiCopy = {
  retry: string;
  loading: string;
};

const DEFAULT_COPY: UiCopy = {
  retry: 'Retry',
  loading: 'Loading…',
};

const UiCopyContext = createContext<UiCopy>(DEFAULT_COPY);

export function UiCopyProvider({
  retry,
  loading,
  children,
}: {
  retry: string;
  loading: string;
  children: ReactNode;
}) {
  return (
    <UiCopyContext.Provider value={{ retry, loading }}>{children}</UiCopyContext.Provider>
  );
}

export function useUiCopy(): UiCopy {
  return useContext(UiCopyContext);
}
