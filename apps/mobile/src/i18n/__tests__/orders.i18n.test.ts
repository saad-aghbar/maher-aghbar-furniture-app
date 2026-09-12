import { translate } from '../translate';

const DEALER_ORDERS_KEYS = [
  'mobile.orders.deskEyebrow',
  'mobile.orders.deskHint',
  'mobile.orders.stampActive',
  'mobile.orders.stampOnLine',
  'mobile.orders.stampReady',
  'mobile.orders.stampNeedsLook',
  'mobile.orders.stationPreparing',
  'mobile.orders.stationOnLine',
  'mobile.orders.stationReady',
  'mobile.orders.stationShipped',
  'mobile.orders.stationDone',
  'mobile.orders.stationReview',
  'mobile.orders.railAll',
  'mobile.orders.chips.drafts',
  'mobile.orders.chips.waiting',
  'mobile.orders.chips.needsInformation',
  'mobile.orders.chips.pending',
  'mobile.orders.chips.production',
  'mobile.orders.chips.ready',
  'mobile.orders.chips.shipped',
  'mobile.orders.amount',
  'mobile.orders.emptyStamp',
  'mobile.orders.emptyStampHint',
  'mobile.orders.emptyToday',
  'mobile.orders.emptyPast',
  'mobile.orders.qty',
  'mobile.orders.progress',
  'mobile.orders.title',
] as const;

const PRODUCTION_FLOW_ITEM_KEYS = [
  'mobile.productionFlow.orderItems',
  'mobile.productionFlow.orderItemWorkflow',
  'mobile.productionFlow.currentStage',
  'mobile.productionFlow.workflowUnset',
  'mobile.productionFlow.stageUnset',
  'mobile.productionFlow.quantityUnset',
  'mobile.productionFlow.emptyItemsBody',
] as const;

describe('dealer orders i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves dealer order desk keys in ${locale}`, () => {
      for (const key of DEALER_ORDERS_KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('production flow item list i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves production-item keys in ${locale}`, () => {
      for (const key of PRODUCTION_FLOW_ITEM_KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
