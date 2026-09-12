import { translate } from '../translate';

const DEALER_RECEIPTS_KEYS = [
  'mobile.dealerReceipts.title',
  'mobile.dealerReceipts.deskEyebrow',
  'mobile.dealerReceipts.deskHint',
  'mobile.dealerReceipts.stampAwaiting',
  'mobile.dealerReceipts.stampReceived',
  'mobile.dealerReceipts.stubAwaiting',
  'mobile.dealerReceipts.stubReceived',
  'mobile.dealerReceipts.searchPlaceholder',
  'mobile.dealerReceipts.empty',
  'mobile.dealerReceipts.emptyHint',
  'mobile.dealerReceipts.emptyFilter',
  'mobile.dealerReceipts.emptyFilterHint',
  'mobile.dealerReceipts.errorTitle',
  'mobile.dealerReceipts.errorBody',
  'mobile.dealerReceipts.retry',
  'mobile.dealerReceipts.a11yCard',
  'mobile.dealerReceipts.receivedCaption',
  'mobile.dealerReceipts.factsTitle',
  'mobile.dealerReceipts.address',
  'mobile.dealerReceipts.promisedDay',
  'mobile.dealerReceipts.leftDay',
  'mobile.dealerReceipts.receivedDay',
  'mobile.dealerReceipts.confirmTitle',
  'mobile.dealerReceipts.confirmHint',
  'mobile.dealerReceipts.notOnDesk',
  'mobile.dealerReceipts.notOnDeskHint',
  'mobile.dealerReceipts.openOrder',
] as const;

describe('dealer receipts i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves dealer receipt desk keys in ${locale}`, () => {
      for (const key of DEALER_RECEIPTS_KEYS) {
        const value = translate(locale, key, {
          number: 'SO-1',
          product: 'Sofa',
          status: 'Awaiting',
        });
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
