import { translate } from '../translate';

const KEYS = [
  'mobile.inventory.fabricDeskTitle',
  'mobile.inventory.fabricDeskHint',
  'mobile.inventory.fabricDeskSummary',
  'mobile.inventory.fabricChildrenEyebrow',
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
  'mobile.purchasing.fabricLoading',
  'mobile.purchasing.fabricLoadFailed',
  'mobile.purchasing.fabricRetry',
  'mobile.purchasing.fabricOverriddenNote',
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
  ['mobile.production.fabricStageWaiting', { stage: 'Upholstery', fabric: 'Bouclé 611' }, 'Bouclé 611'],
  ['mobile.production.fabricStagePartial', { stage: 'Upholstery', fabric: 'Linen 180' }, 'Linen 180'],
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
});
