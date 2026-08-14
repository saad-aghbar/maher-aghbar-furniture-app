export type StockQtyFields = {
  availableQty?: unknown;
  reservedQty?: unknown;
};

export type DecoratedStockQty = {
  onHandQty: number;
  reservedQty: number;
  freeQty: number;
};

/** Stored `availableQty` is physical on-hand. Free-to-use is on-hand minus reserved. */
export function decorateStockQty(row: StockQtyFields): DecoratedStockQty {
  const onHandQty = Number(row.availableQty ?? 0) || 0;
  const reservedQty = Number(row.reservedQty ?? 0) || 0;
  return {
    onHandQty,
    reservedQty,
    freeQty: onHandQty - reservedQty,
  };
}

export function withStockQty<T extends StockQtyFields>(row: T): T & DecoratedStockQty {
  return { ...row, ...decorateStockQty(row) };
}

export function aggregateStockQty(rows: StockQtyFields[]): DecoratedStockQty {
  return rows.reduce<DecoratedStockQty>(
    (acc, row) => {
      const next = decorateStockQty(row);
      return {
        onHandQty: acc.onHandQty + next.onHandQty,
        reservedQty: acc.reservedQty + next.reservedQty,
        freeQty: acc.freeQty + next.freeQty,
      };
    },
    { onHandQty: 0, reservedQty: 0, freeQty: 0 },
  );
}
