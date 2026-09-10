import { getMessages, allLeafKeys } from '@maher/i18n';

const REQUIRED = [
  'mobile.purchasing.actionNewOrder',
  'mobile.purchasing.actionLowStock',
  'mobile.purchasing.actionSuppliers',
  'mobile.purchasing.builderTitle',
  'mobile.purchasing.lowStockTitle',
  'mobile.purchasing.receiveOrders',
  'mobile.purchasing.whatsappPreview',
  'mobile.purchasing.buyAlertTitle',
  'mobile.purchasing.runBadge',
  'mobile.purchasing.receiveAfterSend',
  'mobile.purchasing.alreadyOnOrder',
  'mobile.purchasing.back',
  'mobile.purchasing.nextStep',
  'mobile.purchasing.cancel',
  'mobile.purchasing.unitCostFromInventory',
  'mobile.purchasing.markLineReceived',
  'mobile.purchasing.lineReceived',
  'mobile.purchasing.reviewNeedsAllLines',
  'mobile.purchasing.receiveChecklistProgress',
  'mobile.purchasing.addToLowStockOrder',
  'mobile.purchasing.addedToLowStockOrder',
  'mobile.purchasing.lowStockPickHint',
  'common.back',
  'mobile.inventory.receiveOrders',
];

describe('purchasing i18n', () => {
  it('has the new keys in en, ar, and he', () => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const keys = new Set(allLeafKeys(getMessages(locale)));
      const missing = REQUIRED.filter((key) => !keys.has(key));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });
});
