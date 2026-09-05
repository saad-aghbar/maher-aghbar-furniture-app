import { getMessages, translateErrorCode } from '@maher/i18n';

describe('fabric take-in rejection copy', () => {
  it('rejects wrong order and wrong fabric with dedicated codes', () => {
    const en = getMessages('en').errors as Record<string, string>;
    expect(en.FABRIC_WRONG_ORDER).toMatch(/another order/i);
    expect(en.FABRIC_WRONG_RECEIVED).toMatch(/not the fabric required/i);
    expect(translateErrorCode('en', 'FABRIC_WRONG_ORDER')).toBe(en.FABRIC_WRONG_ORDER);
    expect(translateErrorCode('ar', 'FABRIC_WRONG_ORDER')).not.toBe('FABRIC_WRONG_ORDER');
    expect(translateErrorCode('he', 'FABRIC_WRONG_ORDER')).not.toBe('FABRIC_WRONG_ORDER');
  });
});
