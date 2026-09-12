import { translate } from '../translate';

const KEYS = [
  'mobile.newOrder.scanReview',
  'mobile.newOrder.scanConfirm',
  'mobile.newOrder.cropPreview',
  'mobile.newOrder.lowConfidence',
  'mobile.newOrder.unrecognizedOption',
  'mobile.newOrder.errors.scanReviewRequired',
  'mobile.adminRequest.sheetRecord',
  'mobile.adminRequest.confirmSpec',
  'mobile.adminRequest.correctSpec',
  'mobile.adminRequest.saveCorrection',
  'mobile.adminRequest.endCustomer',
  'mobile.adminRequest.deliveryAddress',
  'mobile.returns.variant',
  'catalog.promoteFromOrder',
  'catalog.promoteVariantFromOrder',
  'catalog.promotedFromOrder',
] as const;

describe('handwritten intake i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves scan review keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
