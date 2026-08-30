import { translate } from '../translate';

describe('translate', () => {
  it('resolves nested mobile keys', () => {
    expect(translate('en', 'mobile.languageName.ar')).toBe('Arabic');
    expect(translate('ar', 'mobile.languageName.ar')).toBe('العربية');
    expect(translate('he', 'mobile.languageName.he')).toBe('עברית');
  });

  it('resolves keyboard Done labels', () => {
    expect(translate('en', 'mobile.keyboardDone')).toBe('Done');
    expect(translate('ar', 'mobile.keyboardDone')).toBe('تم');
    expect(translate('he', 'mobile.keyboardDone')).toBe('סיום');
  });

  it('resolves biometric login labels', () => {
    expect(translate('en', 'auth.loginWithFaceId')).toBe('Face ID');
    expect(translate('en', 'auth.loginWithTouchId')).toBe('Touch ID');
    expect(translate('en', 'auth.loginWithFingerprint')).toBe('Fingerprint');
    expect(translate('ar', 'auth.loginWithFingerprint')).toBe('البصمة');
    expect(translate('he', 'auth.loginWithFaceId')).toBe('Face ID');
  });

  it('resolves auth signing labels', () => {
    expect(translate('en', 'auth.login')).toBe('Sign in');
    expect(translate('en', 'auth.signingIn')).toBe('Signing in…');
    expect(translate('ar', 'auth.signingIn')).toMatch(/تسجيل/);
  });

  it('interpolates variables', () => {
    expect(translate('en', 'mobile.relativeDueIn', { n: 2, unit: 'days' })).toBe('Due in 2 days');
  });

  it('resolves reports chip labels in full', () => {
    expect(translate('en', 'accounting.reportFinancial')).toBe('Financial');
    expect(translate('ar', 'accounting.reportFinancial')).toBe('المالية');
    expect(translate('en', 'mobile.reports.thisMonth')).toBe('This month');
    expect(translate('ar', 'mobile.reports.thisMonth')).toBe('هذا الشهر');
  });

  it('resolves accounting invoice keys used by mobile', () => {
    expect(translate('en', 'accounting.outstanding')).toBe('Outstanding');
    expect(translate('en', 'accounting.createFromSalesOrder')).toMatch(/sales order/i);
    expect(translate('en', 'accounting.jofotara')).toMatch(/JoFotara/i);
    expect(translate('en', 'accounting.paymentHistory')).toMatch(/Payment/i);
    expect(translate('en', 'accounting.methodBANK_TRANSFER')).toMatch(/Bank/i);
    expect(translate('en', 'accounting.searchPlaceholder')).toBe('Search invoices');
    expect(translate('en', 'accounting.dealersTitle')).toBe('Dealers');
    expect(translate('en', 'accounting.filterApply')).toBe('Apply');
    expect(translate('en', 'accounting.confirmDealer')).toBe('Confirm');
    expect(translate('ar', 'accounting.searchPlaceholder')).toBe('بحث الفواتير');
    expect(translate('ar', 'accounting.outstanding')).toBeTruthy();
    expect(translate('ar', 'accounting.outstanding')).not.toBe('accounting.outstanding');
  });

  it('resolves purchasing catalog and mobile keys', () => {
    expect(translate('en', 'catalog.newPurchaseOrder')).toMatch(/purchase order/i);
    expect(translate('en', 'catalog.fromLowStock')).toMatch(/low stock/i);
    expect(translate('en', 'catalog.allSuppliers')).toMatch(/suppliers/i);
    expect(translate('en', 'mobile.purchasing.searchOrders')).toBe('Search orders');
    expect(translate('en', 'mobile.purchasing.actionNewOrder')).toBe('New order');
    expect(translate('en', 'mobile.purchasing.filterApply')).toBe('Apply');
    expect(translate('ar', 'mobile.purchasing.searchOrders')).toMatch(/أوامر الشراء/);
  });

  it('resolves returns and SO detail keys used by overhaul', () => {
    expect(translate('en', 'catalog.returnsDescription')).toMatch(/manufacturing/i);
    expect(translate('en', 'catalog.returnsSearchPlaceholder')).toMatch(/dealer/i);
    expect(translate('en', 'catalog.reasonPhoto')).toBe('Reason');
    expect(translate('en', 'catalog.issuePhoto')).toBe('Damage');
    expect(translate('en', 'catalog.productPhoto')).toBe('Catalog');
    expect(translate('en', 'catalog.returnReason.MANUFACTURING_DEFECT')).toMatch(
      /Manufacturing/i,
    );
    expect(translate('en', 'sales.autoCalculated')).toMatch(/Auto/i);
    expect(translate('en', 'sales.fromInventoryCosts')).toMatch(/inventory/i);
    expect(translate('en', 'mobile.orderDetail.linkedProduction')).toMatch(/Production/i);
    expect(translate('en', 'mobile.orderDetail.setupBody')).toMatch(/This order was accepted/i);
    expect(translate('en', 'mobile.orderDetail.setupBody')).not.toMatch(/^Accept /);
    expect(translate('en', 'mobile.orderDetail.setupTitle')).toMatch(/Production setup required/i);
    expect(translate('en', 'mobile.orderDetail.prepareProduction')).toBe('Prepare production');
    expect(translate('en', 'navigation.returns')).toBe('Returns');
    expect(translate('ar', 'catalog.noReturnPhoto')).toBeTruthy();
    expect(translate('ar', 'catalog.noReturnPhoto')).not.toBe('catalog.noReturnPhoto');
  });
});
