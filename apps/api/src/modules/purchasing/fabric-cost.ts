import { BadRequestException } from '@nestjs/common';
import { roundMoney } from '../../common/helpers/money.util';

function positive(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(roundMoney(n));
}

/** First positive cost in typed → lot → PO → standard order. */
export function peekFabricUnitCost(parts: {
  typed?: number | null;
  lotUnitCost?: number | null;
  poUnitPrice?: number | null;
  standardCost?: number | null;
}): number | null {
  return (
    positive(parts.typed) ??
    positive(parts.lotUnitCost) ??
    positive(parts.poUnitPrice) ??
    positive(parts.standardCost)
  );
}

/** Receive / allocate: typed → PO line → catalog standard. Throws when nothing is on file. */
export function requireFabricUnitCost(parts: {
  typed?: number | null;
  poUnitPrice?: number | null;
  standardCost?: number | null;
}): number {
  const resolved = peekFabricUnitCost(parts);
  if (resolved == null) {
    throw new BadRequestException({
      code: 'FABRIC_COST_REQUIRED',
      message: 'A unit price is required before fabric can be received.',
    });
  }
  return resolved;
}
