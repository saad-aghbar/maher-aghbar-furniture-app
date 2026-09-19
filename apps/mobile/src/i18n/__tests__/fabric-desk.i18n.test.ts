import { translateErrorCode } from '@maher/i18n';
import { translate } from '../translate';

const ERROR_CODES = [
  'FABRIC_COST_REQUIRED',
  'ITEM_CATEGORY_FORBIDDEN',
  'FABRIC_ITEM_REQUIRED',
  'OVER_RECEIPT',
  'FABRIC_REPLACE_FORBIDDEN',
  'REASON_REQUIRED',
] as const;

const KEYS = [
  'mobile.inventory.fabricDeskTitle',
  'mobile.inventory.fabricDeskHint',
  'mobile.inventory.fabricDeskSummary',
  'mobile.inventory.fabricDeskSearchPlaceholder',
  'mobile.inventory.fabricSearchNoMatches',
  'mobile.inventory.fabricSearchClear',
  'mobile.inventory.fabricChildrenEyebrow',
  'mobile.inventory.fabricSalesOrderEyebrow',
  'mobile.inventory.fabricSubOrderEyebrow',
  'mobile.inventory.fabricSubOrdersCount',
  'mobile.inventory.fabricLaneAll',
  'mobile.inventory.fabricLaneEmpty',
  'mobile.inventory.fabricHoldingTitle',
  'mobile.inventory.fabricHoldingHint',
  'mobile.inventory.generalFabricStock',
  'mobile.inventory.generalFabricStockHint',
  'mobile.inventory.fabricPrintLabel',
  'mobile.inventory.fabricBundleEyebrow',
  'mobile.inventory.fabricBundleCommitted',
  'mobile.inventory.fabricBundleOrder',
  'mobile.inventory.fabricBundleQty',
  'mobile.inventory.fabricBundleNoLocation',
  'mobile.inventory.fabricBundleOpenProcurement',
  'mobile.inventory.fabricBundleMissingTitle',
  'mobile.inventory.fabricScanNotStockTitle',
  'mobile.inventory.fabricScanOpenBundle',
  'mobile.inventory.fabricQr',
  'mobile.inventory.fabricRequiredFor',
  'mobile.inventory.fabricOpenOrder',
  'mobile.inventory.fabricDeskEmpty',
  'mobile.inventory.fabricUseForOrder',
  'mobile.inventory.fabricUseForOrderContinue',
  'mobile.inventory.fabricPickOrderLine',
  'mobile.inventory.fabricSameAsStock',
  'mobile.inventory.fabricDifferentFromStock',
  'mobile.inventory.fabricInGeneralStock',
  'mobile.inventory.fabricReplaceReason',
  'mobile.inventory.fabricReplacePoWarning',
  'mobile.inventory.fabricNoFreeStock',
  'mobile.inventory.fabricNoOrdersForStock',
  'mobile.inventory.fabricOtherOrdersNeedDifferent',
  'mobile.purchasing.fabricLoading',
  'mobile.purchasing.fabricLoadFailed',
  'mobile.purchasing.fabricRetry',
  'mobile.purchasing.fabricOverriddenNote',
  'mobile.purchasing.fabricAskSupplier',
  'mobile.purchasing.fabricTakeFromStock',
  'mobile.purchasing.fabricSupplierReplied',
  'mobile.purchasing.fabricConfirmArrival',
  'mobile.purchasing.fabricWaitSuccess',
  'mobile.purchasing.fabricRedirectSuccess',
  'mobile.purchasing.fabricOverrideSuccess',
  'mobile.purchasing.fabricReceiveSuccess',
  'mobile.purchasing.fabricAllocateSuccess',
  'mobile.purchasing.fabricSendSuccess',
  'mobile.purchasing.fabricPoNumber',
  'mobile.purchasing.fabricInvoice',
  'mobile.purchasing.fabricArrivalQty',
  'mobile.purchasing.fabricHoldingLocation',
  'mobile.purchasing.fabricUnitCost',
  'mobile.purchasing.fabricNoPriceYet',
  'mobile.purchasing.fabricNotInSystem',
  'mobile.purchasing.fabricReceiveOnFabricScreen',
  'mobile.purchasing.openFabric',
  'mobile.purchasing.scanToFindLine',
  'mobile.purchasing.scanFindLineHint',
  'mobile.purchasing.fabricHoldingEmpty',
  'mobile.purchasing.fabricHoldingAdd',
  'mobile.purchasing.fabricHoldingEdit',
  'mobile.purchasing.fabricHoldingRemove',
  'mobile.purchasing.fabricHoldingName',
  'mobile.purchasing.fabricHoldingWarehouse',
  'mobile.purchasing.fabricHoldingCreated',
  'mobile.purchasing.fabricHoldingUpdated',
  'mobile.purchasing.fabricHoldingRemoved',
  'mobile.purchasing.fabricNeedWarehouse',
  'mobile.purchasing.fabricReply.SUPPLIER_CONFIRMED',
  'mobile.purchasing.fabricReply.PARTIALLY_AVAILABLE',
  'mobile.purchasing.fabricReply.UNAVAILABLE',
  'mobile.purchasing.fabricReply.READY_FOR_PICKUP',
  'mobile.purchasing.fabricReply.DELAYED',
  'mobile.fabricEvent.REQUESTED',
  'mobile.fabricEvent.SUPPLIER_CONFIRMED',
  'mobile.fabricEvent.SUPPLIER_UNAVAILABLE',
  'mobile.fabricEvent.WAIT',
  'mobile.fabricEvent.REDIRECTED',
  'mobile.fabricEvent.READY_FOR_PICKUP',
  'mobile.fabricEvent.RECEIVED',
  'mobile.fabricEvent.PARTIAL',
  'mobile.fabricEvent.FABRIC_CHANGED',
  'mobile.fabricEvent.OVERRIDE',
  'mobile.fabricEvent.DISPOSITION',
  'mobile.purchasing.fabricReadinessTitle',
  'mobile.purchasing.scanNoLineMatch',
  'mobile.tasks.requiredFabric',
  'mobile.tasks.fabricWrongOrder',
  'mobile.tasks.fabricWrongFabric',
  'mobile.tasks.fabricNotArrived',
  'mobile.tasks.fabricCorrect',
  'mobile.tasks.fabricTake',
  'mobile.fabricStatus.needsOrdering',
  'mobile.fabricStatus.waitingSupplier',
  'mobile.fabricStatus.readyForPickup',
  'mobile.fabricStatus.inHolding',
  'mobile.fabricStatus.ready',
  'mobile.fabricStatus.partial',
  'mobile.fabricStatus.unavailable',
  'mobile.fabricStatus.waiting',
  'mobile.fabricStatus.taken',
  'mobile.fabricStatus.overridden',
  'mobile.fabricStatus.attention',
  'mobile.production.fabricStageWaiting',
  'mobile.production.fabricStagePartial',
  'production.stageLibrary.UPHOLSTERY',
] as const;

const INTERPOLATED = [
  ['mobile.inventory.fabricBundle', { code: 'FB-SOFB1042-001' }, 'FB-SOFB1042-001'],
  ['mobile.inventory.fabricBundleMissingBody', { code: 'FB-X' }, 'FB-X'],
  ['mobile.inventory.fabricScanNotStockBody', { order: 'SO-FB1042' }, 'SO-FB1042'],
  ['mobile.purchasing.fabricReadyCount', { ready: 1, required: 3 }, '1'],
  ['mobile.purchasing.fabricHoldingRemoveBody', { name: 'Aisle 3' }, 'Aisle 3'],
  ['mobile.production.fabricStageWaiting', { stage: 'Upholstery', fabric: 'Bouclé 611' }, 'Bouclé 611'],
  ['mobile.production.fabricStagePartial', { stage: 'Upholstery', fabric: 'Linen 180' }, 'Linen 180'],
  ['mobile.inventory.fabricCoversAll', { need: 8, unit: 'm' }, '8'],
  ['mobile.inventory.fabricCoversPartial', { free: 4, need: 10, unit: 'm' }, '4'],
  ['mobile.inventory.fabricReplacing', { fabric: 'Velvet 302' }, 'Velvet 302'],
  ['mobile.inventory.fabricSubOrdersCount', { n: 2 }, '2'],
] as const;

/** Fabric lane labels come from the shared statuses namespace, not mobile.json. */
const LANE_STATUS_KEYS = [
  'statuses.NEEDS_ORDERING',
  'statuses.AWAITING_SUPPLIER',
  'statuses.UNAVAILABLE',
  'statuses.WAITING',
  'statuses.READY_FOR_PICKUP',
  'statuses.ARRIVED',
  'statuses.READY_FOR_PRODUCTION',
  'statuses.ISSUED',
] as const;

describe('fabric desk i18n', () => {
  it.each(KEYS)('resolves %s in EN, AR, and HE', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(LANE_STATUS_KEYS)('resolves fabric lane label %s in every locale', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(INTERPOLATED)('interpolates %s', (key, params, expected) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key, params as Record<string, string | number>);
      expect(value).not.toBe(key);
      expect(value).toContain(String(expected));
    }
  });

  it.each(ERROR_CODES)('resolves %s in EN, AR, and HE', (code) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translateErrorCode(locale, code);
      expect(value).not.toBe(code);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
