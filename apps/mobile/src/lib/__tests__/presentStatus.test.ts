import { presentStatus } from '../presentStatus';

describe('presentStatus', () => {
  it('maps Piece 13 human labels without i18n', () => {
    expect(presentStatus('OUT_FOR_DELIVERY')).toBe('Shipped');
    expect(presentStatus('READY_FOR_DELIVERY')).toBe('Ready');
    expect(presentStatus('PLANNED')).toBe('Planned');
    expect(presentStatus('UNDER_REVIEW')).toBe('Under review');
    expect(presentStatus('READY_FOR_INSPECTION')).toBe('Waiting inspection');
    expect(presentStatus('FAILED_REWORK_REQUIRED')).toBe('Fail-rework');
    expect(presentStatus('ISSUED')).toBe('Open');
    expect(presentStatus('VOID')).toBe('Void');
    expect(presentStatus('PARTIALLY_PAID')).toBe('Partially paid');
  });

  it('normalizes casing and whitespace', () => {
    expect(presentStatus(' out_for_delivery ')).toBe('Shipped');
    expect(presentStatus('ready for delivery')).toBe('Ready');
  });

  it('returns empty for nullish / blank', () => {
    expect(presentStatus(null)).toBe('');
    expect(presentStatus(undefined)).toBe('');
    expect(presentStatus('')).toBe('');
    expect(presentStatus('   ')).toBe('');
  });

  it('title-cases unknown enums', () => {
    expect(presentStatus('SOME_CUSTOM_STATUS')).toBe('Some Custom Status');
  });

  it('prefers mobile.status.* when t resolves', () => {
    const t = (key: string) =>
      key === 'mobile.status.OUT_FOR_DELIVERY' ? 'Shipped (i18n)' : key;
    expect(presentStatus('OUT_FOR_DELIVERY', t)).toBe('Shipped (i18n)');
    expect(presentStatus('READY_FOR_DELIVERY', t)).toBe('Ready');
  });
});
