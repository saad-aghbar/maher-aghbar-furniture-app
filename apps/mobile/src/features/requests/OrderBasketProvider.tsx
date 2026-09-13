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
import {
  applyCatalogProductToBasket,
  patchBasketLine,
  removeBasketLine,
  addEmptyBasketLine,
  lineHasProduct,
  type CatalogBasketPick,
} from './newOrderBasket';
import { emptyOrderLine, type NewOrderLine } from './newOrderLine';
import {
  loadLocalDraft,
  saveLocalDraft,
  type NewOrderLocalDraft,
} from './newOrderDraft';

type BasketApi = {
  hydrated: boolean;
  lines: NewOrderLine[];
  count: number;
  setLines: (next: NewOrderLine[] | ((prev: NewOrderLine[]) => NewOrderLine[])) => void;
  addFromCatalog: (pick: CatalogBasketPick, unique?: boolean) => string;
  patchLine: (id: string, next: NewOrderLine | Partial<NewOrderLine>) => void;
  removeLine: (id: string) => void;
  addEmpty: () => string;
  clear: () => void;
};

const BasketContext = createContext<BasketApi | null>(null);

function firstLineFields(lines: NewOrderLine[]) {
  const first = lines[0] ?? emptyOrderLine();
  return {
    productId: first.productId,
    customProductName: first.customProductName,
    quantity: first.quantity,
    fabric: first.fabrics[0]?.type ?? '',
    fabricDescription: first.fabrics[0]?.notes ?? '',
    dimensionsNotes: first.dimensionsNotes,
    dimWidth: first.dimWidth,
    dimHeight: first.dimHeight,
    dimDepth: first.dimDepth,
    dimSeat: first.dimSeat,
    customMeasurements: first.customMeasurements,
  };
}

function emptyDraft(lines: NewOrderLine[]): NewOrderLocalDraft {
  return {
    version: 4,
    step: 1,
    lines,
    ...firstLineFields(lines),
    externalOrderNumber: '',
    priority: 'NORMAL',
    orderNotes: '',
    deliveryAddress: '',
    endCustomerName: '',
    endCustomerPhone: '',
    deliveryNotes: '',
    requiredDeliveryDate: '',
    updatedAt: new Date().toISOString(),
  };
}

export function OrderBasketProvider({ children }: { children: ReactNode }) {
  const [lines, setLinesState] = useState<NewOrderLine[]>(() => [emptyOrderLine()]);
  const [hydrated, setHydrated] = useState(false);
  const skipSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await loadLocalDraft();
      if (cancelled) return;
      if (local?.lines?.length) setLinesState(local.lines);
      setHydrated(true);
      skipSave.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || skipSave.current) return;
    void (async () => {
      const existing = await loadLocalDraft();
      await saveLocalDraft({
        ...(existing ?? emptyDraft(lines)),
        lines,
        ...firstLineFields(lines),
        updatedAt: new Date().toISOString(),
      });
    })();
  }, [lines, hydrated]);

  const setLines = useCallback(
    (next: NewOrderLine[] | ((prev: NewOrderLine[]) => NewOrderLine[])) => {
      setLinesState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const addFromCatalog = useCallback((pick: CatalogBasketPick, unique = false) => {
    let addedId = '';
    setLinesState((prev) => {
      if (unique && !pick.preferUpdate) {
        const match = prev.find(
          (line) =>
            line.productId === pick.productId &&
            (line.variantId || '') === (pick.variantId || ''),
        );
        if (match) {
          addedId = match.id;
          return prev;
        }
      }
      const next = applyCatalogProductToBasket(prev, pick, {
        preferUpdate: pick.preferUpdate,
      });
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

  const patchLine = useCallback((id: string, next: NewOrderLine | Partial<NewOrderLine>) => {
    setLinesState((prev) => patchBasketLine(prev, id, next));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLinesState((prev) => {
      const next = removeBasketLine(prev, id);
      return next.length ? next : [emptyOrderLine()];
    });
  }, []);

  const addEmpty = useCallback(() => {
    let id = '';
    setLinesState((prev) => {
      const next = addEmptyBasketLine(prev);
      id = next[next.length - 1]?.id ?? '';
      return next;
    });
    return id;
  }, []);

  const clear = useCallback(() => {
    setLinesState([emptyOrderLine()]);
  }, []);

  const count = useMemo(() => lines.filter(lineHasProduct).length, [lines]);

  const value = useMemo<BasketApi>(
    () => ({
      hydrated,
      lines,
      count,
      setLines,
      addFromCatalog,
      patchLine,
      removeLine,
      addEmpty,
      clear,
    }),
    [hydrated, lines, count, setLines, addFromCatalog, patchLine, removeLine, addEmpty, clear],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useOrderBasket(): BasketApi {
  const ctx = useContext(BasketContext);
  if (!ctx) {
    throw new Error('useOrderBasket must be used inside OrderBasketProvider');
  }
  return ctx;
}

export function useOrderBasketCount(): number {
  const ctx = useContext(BasketContext);
  return ctx?.count ?? 0;
}

export function useOptionalOrderBasket(): BasketApi | null {
  return useContext(BasketContext);
}
