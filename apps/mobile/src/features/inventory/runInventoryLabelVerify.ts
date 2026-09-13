import { qrLog, qrWarn } from './qrSessionLog';
import { resolveInventoryScan } from './resolveInventoryScan';
import { selectVerifyScanKind } from './selectScanPresentation';
import {
  classifyLabelScan,
  type InventoryScanMatchKind,
  type ScannedFabricBundle,
} from './components/InventoryScanMatchResult';
import type { InventoryItem } from './api';

export type LabelVerifyOutcome = {
  kind: InventoryScanMatchKind;
  scanned: InventoryItem | null;
  /** Present when the scan was an order-linked fabric bundle. */
  fabric?: ScannedFabricBundle;
};

/**
 * Parent-owned VERIFY pipeline (Receive / Issue / Transfer / Count).
 * Call from the operation sheet that survives camera open — never from a child
 * that can unmount while awaiting openScanner().
 */
export async function runInventoryLabelVerify(args: {
  code: string | null;
  currentId: string;
  allowItem?: (item: InventoryItem) => boolean;
}): Promise<LabelVerifyOutcome | null> {
  const { code, currentId, allowItem } = args;
  qrLog(0, `VERIFY consumer resumed code=${code ?? 'null'}`);
  if (!code) {
    qrLog(0, 'VERIFY camera cancel');
    return null;
  }

  qrLog(0, `VERIFY received code ${code}`);
  qrLog(0, `VERIFY lookup start ${code}`);
  try {
    const resolved = await resolveInventoryScan(code);
    const kind = selectVerifyScanKind(resolved);
    if (kind !== 'item') {
      qrLog(0, `VERIFY lookup ${resolved.status}`);
      if (kind === 'ORDER_FABRIC' && resolved.status === 'ORDER_FABRIC') {
        return {
          kind,
          scanned: null,
          fabric: {
            code: resolved.lot.qrCode ?? code,
            label:
              resolved.lot.fabricProcurement?.label ?? resolved.lot.inventoryItem.nameEn,
            orderNumber:
              resolved.lot.salesOrder?.number ?? resolved.lot.salesOrderNumber ?? null,
          },
        };
      }
      return { kind, scanned: null };
    }
    if (resolved.status !== 'FOUND') {
      qrLog(0, `VERIFY lookup ${resolved.status} after item gate`);
      return { kind: 'UNKNOWN', scanned: null };
    }

    qrLog(0, `VERIFY lookup FOUND ${resolved.item.id} ${resolved.item.sku}`);
    const matchKind = classifyLabelScan({
      currentId,
      scanned: resolved.item,
      allowItem,
    });
    qrLog(0, `VERIFY comparison current=${currentId} scanned=${resolved.item.id}`);
    qrLog(0, `VERIFY result ${matchKind}`);
    return { kind: matchKind, scanned: resolved.item };
  } catch (err) {
    qrWarn(0, `VERIFY lookup threw ${err instanceof Error ? err.message : String(err)}`);
    return { kind: 'ERROR', scanned: null };
  }
}
