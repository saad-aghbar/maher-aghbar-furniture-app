'use client';

import {
  applyCatalogProductToBasket,
  emptyBasketLine,
  lineHasProduct,
  loadBasketDraft,
  patchBasketLine,
  removeBasketLine,
  saveBasketDraft,
  type BasketLine,
  type CatalogBasketPick,
} from '@/lib/basket';
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

type BasketApi = {
  hydrated: boolean;
  lines: BasketLine[];
  count: number;
  setLines: (next: BasketLine[] | ((prev: BasketLine[]) => BasketLine[])) => void;
  addFromCatalog: (pick: CatalogBasketPick) => string;
  upsertLine: (line: BasketLine) => void;
  patchLine: (id: string, next: Partial<BasketLine>) => void;
  removeLine: (id: string) => void;
  clear: () => void;
};

const BasketContext = createContext<BasketApi | null>(null);

export function OrderBasketProvider({ children }: { children: ReactNode }) {
  const [lines, setLinesState] = useState<BasketLine[]>(() => [emptyBasketLine()]);
  const [hydrated, setHydrated] = useState(false);
  const skipSave = useRef(true);

  useEffect(() => {
    const local = loadBasketDraft();
    if (local?.length) setLinesState(local);
    setHydrated(true);
    skipSave.current = false;
  }, []);

  useEffect(() => {
    if (!hydrated || skipSave.current) return;
    saveBasketDraft(lines);
  }, [lines, hydrated]);

  const setLines = useCallback(
    (next: BasketLine[] | ((prev: BasketLine[]) => BasketLine[])) => {
      setLinesState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const addFromCatalog = useCallback((pick: CatalogBasketPick) => {
    let addedId = '';
    setLinesState((prev) => {
      const next = applyCatalogProductToBasket(prev, pick, { preferUpdate: pick.preferUpdate });
      const same = next.find(
        (line) =>
          line.productId === pick.productId &&
          (line.variantId || '') === (pick.variantId || ''),
      );
      addedId = same?.id ?? next[next.length - 1]?.id ?? '';
      return next;
    });
    return addedId;
  }, []);

  const upsertLine = useCallback((line: BasketLine) => {
    setLinesState((prev) => {
      if (prev.some((row) => row.id === line.id)) return patchBasketLine(prev, line.id, line);
      if (!prev.some(lineHasProduct)) return [line];
      return [...prev.filter(lineHasProduct), line];
    });
  }, []);

  const patchLine = useCallback((id: string, next: Partial<BasketLine>) => {
    setLinesState((prev) => patchBasketLine(prev, id, next));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLinesState((prev) => {
      const next = removeBasketLine(prev, id);
      return next.length ? next : [emptyBasketLine()];
    });
  }, []);

  const clear = useCallback(() => {
    setLinesState([emptyBasketLine()]);
  }, []);

  const count = useMemo(() => lines.filter(lineHasProduct).length, [lines]);

  const value = useMemo<BasketApi>(
    () => ({
      hydrated,
      lines,
      count,
      setLines,
      addFromCatalog,
      upsertLine,
      patchLine,
      removeLine,
      clear,
    }),
    [hydrated, lines, count, setLines, addFromCatalog, upsertLine, patchLine, removeLine, clear],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useOrderBasket(): BasketApi {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useOrderBasket must be used inside OrderBasketProvider');
  return ctx;
}

export function useOrderBasketCount(): number {
  return useContext(BasketContext)?.count ?? 0;
}

export function useOptionalOrderBasket(): BasketApi | null {
  return useContext(BasketContext);
}
