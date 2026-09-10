import { translate } from '@/i18n/translate';
import { looksLikeRawI18nKey, resolveFabricStageLabel, resolveFabricStatusLabel } from '../fabricCopy';
import { fabricActionSet } from '../fabricActionSet';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('fabric copy', () => {
  it('localizes UPHOLSTERY instead of leaking the enum', () => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const t = (key: string) => translate(locale, key);
      const label = resolveFabricStageLabel(t, 'UPHOLSTERY');
      expect(label).toBeTruthy();
      expect(label).not.toBe('UPHOLSTERY');
      expect(looksLikeRawI18nKey(label!)).toBe(false);
    }
  });

  it('uses the same Ready / Waiting meaning on ops surfaces', () => {
    const t = (key: string) => translate('en', key);
    const ready = resolveFabricStatusLabel(
      t,
      {
        derivedStatus: 'READY_FOR_PRODUCTION',
        overridden: false,
        readyForProduction: true,
        expectedQty: 24,
        arrivedQty: 24,
        attentionCode: null,
      },
      'ops',
    );
    const waiting = resolveFabricStatusLabel(
      t,
      {
        derivedStatus: 'WAITING',
        overridden: false,
        readyForProduction: false,
        expectedQty: 18,
        arrivedQty: 0,
        attentionCode: null,
      },
      'ops',
    );
    expect(ready).toBe('Ready');
    expect(waiting).toBe('Waiting');
  });

  it('localizes all fabric event kinds', () => {
    const kinds = [
      'REQUESTED',
      'SUPPLIER_CONFIRMED',
      'SUPPLIER_UNAVAILABLE',
      'WAIT',
      'REDIRECTED',
      'READY_FOR_PICKUP',
      'RECEIVED',
      'PARTIAL',
      'FABRIC_CHANGED',
      'OVERRIDE',
      'DISPOSITION',
    ];
    for (const locale of ['en', 'ar', 'he'] as const) {
      const t = (key: string) => translate(locale, key);
      for (const kind of kinds) {
        const label = t(`mobile.fabricEvent.${kind}`);
        expect(label).not.toBe(`mobile.fabricEvent.${kind}`);
        expect(label).not.toBe(kind);
      }
    }
  });
});

describe('one fabric action set', () => {
  const perms = {
    canPrint: true,
    canOpenOrder: true,
    canOpenPo: true,
    canManage: true,
    canReceive: true,
    canOverride: true,
    salesOrderId: 'so-1',
    overridden: false,
  };

  it('keeps print on both entry paths once a lot exists', () => {
    const withLot = fabricActionSet({
      ...perms,
      kind: 'READY',
      expectedQty: 24,
      arrivedQty: 24,
      hasLot: true,
      purchaseOrderId: 'po-1',
    });
    const needs = fabricActionSet({
      ...perms,
      kind: 'NEEDS_ORDERING',
      expectedQty: 24,
      arrivedQty: 0,
      hasLot: false,
      purchaseOrderId: null,
    });
    expect(withLot).toContain('print');
    expect(withLot).toContain('openOrder');
    expect(withLot).toContain('openPo');
    expect(needs).toContain('askSupplier');
    expect(needs).toContain('takeFromStock');
    expect(needs).toContain('confirmArrival');
    expect(needs).not.toContain('print');
  });

  it('exposes supplier reply, wait, and redirect while awaiting', () => {
    const actions = fabricActionSet({
      ...perms,
      kind: 'WAITING',
      storedState: 'AWAITING_SUPPLIER',
      expectedQty: 12,
      arrivedQty: 0,
      hasLot: false,
      purchaseOrderId: 'po-1',
    });
    expect(actions).toEqual(
      expect.arrayContaining(['supplierReplied', 'wait', 'redirect', 'confirmArrival', 'openPo']),
    );
  });

  it('keeps print and open order on both entry paths once ready', () => {
    const ready = fabricActionSet({
      ...perms,
      kind: 'READY',
      expectedQty: 24,
      arrivedQty: 24,
      hasLot: true,
      purchaseOrderId: 'po-1',
    });
    expect(ready).toContain('print');
    expect(ready).toContain('openOrder');
    expect(ready).not.toContain('askSupplier');
    expect(ready).not.toContain('confirmArrival');
    expect(ready).not.toContain('override');
  });

  it('lets a short arrival still confirm remaining meters and override', () => {
    const partial = fabricActionSet({
      ...perms,
      kind: 'PARTIAL',
      storedState: 'READY_FOR_PICKUP',
      expectedQty: 24,
      arrivedQty: 10,
      hasLot: true,
      purchaseOrderId: 'po-1',
    });
    expect(partial).toEqual(
      expect.arrayContaining(['print', 'confirmArrival', 'override', 'openPo']),
    );
  });

  it('re-asks and redirects when the supplier is unavailable', () => {
    const unavailable = fabricActionSet({
      ...perms,
      kind: 'UNAVAILABLE',
      storedState: 'UNAVAILABLE',
      expectedQty: 12,
      arrivedQty: 0,
      hasLot: false,
      purchaseOrderId: null,
    });
    expect(unavailable).toEqual(
      expect.arrayContaining(['askSupplier', 'supplierReplied', 'redirect', 'override']),
    );
  });

  it('drops arrival and override after the worker has taken the bundle', () => {
    const issued = fabricActionSet({
      ...perms,
      kind: 'ISSUED',
      expectedQty: 24,
      arrivedQty: 24,
      hasLot: true,
      purchaseOrderId: 'po-1',
    });
    expect(issued).toContain('print');
    expect(issued).not.toContain('confirmArrival');
    expect(issued).not.toContain('override');
  });
});

describe('fabric detail source has no raw i18n keys', () => {
  const detail = readFileSync(join(__dirname, '../FabricDetailScreen.tsx'), 'utf8');
  const sheet = readFileSync(join(__dirname, '../FabricActionSheet.tsx'), 'utf8');
  const worker = readFileSync(
    join(__dirname, '../../tasks/components/TaskFabricTakeInBoard.tsx'),
    'utf8',
  );
  const purchasingQuery = readFileSync(
    join(__dirname, '../../purchasing/query.ts'),
    'utf8',
  );
  const hub = readFileSync(
    join(__dirname, '../../purchasing/PurchasingHubScreen.tsx'),
    'utf8',
  );
  const purchasingRoute = readFileSync(
    join(__dirname, '../../../../app/(app)/(admin)/purchasing/fabric/[id].tsx'),
    'utf8',
  );
  const bundleRoute = readFileSync(
    join(__dirname, '../../../../app/(app)/(admin)/inventory/fabric-bundle/[code].tsx'),
    'utf8',
  );

  it('does not interpolate missing product/stage keys or raw UPHOLSTERY', () => {
    expect(detail).not.toContain("t('mobile.orderDetail.product')");
    expect(detail).not.toContain('mobile.production.stage');
    expect(detail).toContain('resolveFabricStageLabel');
    expect(detail).toContain('dir="ltr"');
    expect(detail).toContain('mobile.fabricEvent.');
  });

  it('gates actions on inventory, order, and procurement permissions', () => {
    expect(detail).toContain("can(user, 'inventory.read')");
    expect(detail).toContain("can(user, 'sales-order.read')");
    expect(detail).toContain("can(user, 'fabric.procurement.read')");
    expect(detail).toContain("can(user, 'fabric.procurement.manage')");
    expect(detail).toContain("can(user, 'inventory.receive')");
    expect(detail).toContain("can(user, 'production.fabric.override')");
    expect(detail).toContain("can(user, 'warehouse.manage')");
  });

  it('uses the shared quantity stepper on arrival and stock sheets', () => {
    expect(detail).toContain('QtyStepperField');
    expect(detail).toContain('fabricUnitCost');
    expect(detail).toContain('unitCostFromInventory');
    expect(detail).not.toContain('setArriveCost');
    expect(detail).toContain('fabricNoPriceYet');
  });

  it('picks holding locations from the inventory warehouse box', () => {
    expect(detail).toContain('HoldingLocationBox');
    expect(detail).toContain('HoldingLocationFormSheet');
    expect(detail).toContain('useDeleteWarehouseLocationMutation');
    expect(detail).toContain('CreateWarehouseSheet');
  });

  it('pins a Primary+Secondary footer on the shared sheet', () => {
    expect(sheet).toContain('PrimaryButton');
    expect(sheet).toContain('SecondaryButton');
    expect(sheet).toContain('theme.radius.full');
    expect(sheet).toContain('theme.sizes.touch.min');
    expect(sheet).toContain('fitContent');
    expect(sheet).toContain('maxHeight: scrollCap');
    expect(sheet).not.toContain('flex: 1, minHeight: 0');
  });

  it('invalidates fabric lists, holding, bundle, and production after take-in', () => {
    expect(worker).toContain('queryKeys.purchasing.fabricLists()');
    expect(worker).toContain("'fabric-holding'");
    expect(worker).toContain("'fabric-bundle'");
    expect(worker).toContain('queryKeys.production.all');
    expect(worker).not.toContain('{item.derivedStatus}');
  });

  it('invalidates fabric holding after goods receipt and receive/allocate', () => {
    expect(purchasingQuery).toContain('await invalidateFabric(qc)');
    expect(purchasingQuery).toContain('receiveFabricProcurement');
    expect(purchasingQuery).toContain('allocateFabricFromStock');
    expect(purchasingQuery).toContain('queryKeys.purchasing.fabricDetails()');
  });

  it('routes purchasing fabric rows through fabricRowHref', () => {
    expect(hub).toContain('fabricRowHref');
    expect(hub).toContain('supplierId: supplierId || undefined');
    expect(hub).toContain('hideDates={tab === \'fabric\'}');
  });

  it('serves both fabric routes from FabricDetailScreen', () => {
    expect(purchasingRoute).toContain('FabricDetailScreen');
    expect(purchasingRoute).toContain('procurementId=');
    expect(bundleRoute).toContain('FabricDetailScreen');
    expect(bundleRoute).toContain('code=');
  });

  it('mounts the PDF language sheet so print label can resolve', () => {
    expect(detail).toContain('pdfDownloadSheet');
    expect(detail).toContain('openFabricLotQrLabelPdf');
  });
});
