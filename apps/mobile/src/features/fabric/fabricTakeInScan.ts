import type { FabricTaskBoard } from '@/api/modules/purchasing';

export type FabricTakeInScanLot = {
  qrCode?: string | null;
  salesOrderId?: string | null;
  salesOrderNumber?: string | null;
  scanKind?: string | null;
  fabricProcurementId?: string | null;
  remainingQty?: number | string | null;
  status?: string | null;
  label?: string | null;
};

export type FabricTakeInVerdict =
  | {
      kind: 'match';
      item: FabricTaskBoard['items'][number];
      orderNumber: string | null;
    }
  | { kind: 'wrong_order' }
  | { kind: 'wrong_fabric' }
  | { kind: 'not_arrived' }
  | { kind: 'unknown' };

function norm(code: string): string {
  return code.trim().toUpperCase();
}

function lotMatchesCode(
  lots: FabricTaskBoard['items'][number]['lots'],
  code: string,
): boolean {
  const n = norm(code);
  return lots.some((l) => l.qrCode && norm(l.qrCode) === n);
}

/**
 * Decide what a scanned bundle means for this upholstery (or other fabric) task
 * before calling take-in. Local so the worker sees a human warning, not a code.
 */
export function verdictFabricTakeInScan(input: {
  code: string;
  items: FabricTaskBoard['items'];
  taskSalesOrderId?: string | null;
  scannedLot?: FabricTakeInScanLot | null;
}): FabricTakeInVerdict {
  const code = input.code.trim();
  if (!code) return { kind: 'unknown' };

  const matched = input.items.find((item) => lotMatchesCode(item.lots, code));
  if (matched) {
    if (!matched.readyForProduction && matched.arrivedQty <= 0) {
      return { kind: 'not_arrived' };
    }
    return {
      kind: 'match',
      item: matched,
      orderNumber: input.scannedLot?.salesOrderNumber ?? null,
    };
  }

  const lot = input.scannedLot;
  const lotOrder = lot?.salesOrderId ?? null;
  const taskOrder = input.taskSalesOrderId ?? null;
  if (lotOrder && taskOrder && lotOrder !== taskOrder) {
    return { kind: 'wrong_order' };
  }

  const noneArrived =
    input.items.length > 0 && input.items.every((item) => item.arrivedQty <= 0);
  const noBundleYet = input.items.every((item) => item.lots.every((l) => !l.qrCode));
  if (noneArrived && noBundleYet) return { kind: 'not_arrived' };

  return { kind: 'wrong_fabric' };
}

export function fabricTakeInErrorKey(
  verdict: FabricTakeInVerdict['kind'] | string | null | undefined,
): string | null {
  switch (verdict) {
    case 'wrong_order':
    case 'FABRIC_WRONG_ORDER':
      return 'mobile.tasks.fabricWrongOrder';
    case 'wrong_fabric':
    case 'FABRIC_WRONG_RECEIVED':
    case 'FABRIC_WRONG_STAGE':
      return 'mobile.tasks.fabricWrongFabric';
    case 'not_arrived':
    case 'FABRIC_NOT_READY':
      return 'mobile.tasks.fabricNotArrived';
    default:
      return null;
  }
}
