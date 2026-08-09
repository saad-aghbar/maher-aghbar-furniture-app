import {
  clampNotes,
  composeRequestNotes,
  formatAddressLine,
  isValidDeliveryAddress,
  isValidOptionalPhone,
  isValidQuantity,
  resolveModelName,
} from '../newOrderValidation';

describe('newOrderValidation', () => {
  it('requires a model name from custom or catalog', () => {
    expect(resolveModelName({ customProductName: '', catalogName: null })).toBe('');
    expect(resolveModelName({ customProductName: '  Sofa  ', catalogName: null })).toBe('Sofa');
    expect(resolveModelName({ customProductName: '', catalogName: 'Table' })).toBe('Table');
  });

  it('validates positive quantity', () => {
    expect(isValidQuantity('1')).toBe(true);
    expect(isValidQuantity('0')).toBe(false);
    expect(isValidQuantity('-2')).toBe(false);
    expect(isValidQuantity('abc')).toBe(false);
  });

  it('requires a non-empty delivery address', () => {
    expect(isValidDeliveryAddress('')).toBe(false);
    expect(isValidDeliveryAddress('   ')).toBe(false);
    expect(isValidDeliveryAddress('12 Main St')).toBe(true);
  });

  it('soft-validates optional phone', () => {
    expect(isValidOptionalPhone('')).toBe(true);
    expect(isValidOptionalPhone('12345')).toBe(false);
    expect(isValidOptionalPhone('+970 59 123 4567')).toBe(true);
  });

  it('clamps notes length', () => {
    expect(clampNotes('abc', 2)).toBe('ab');
    expect(clampNotes('ab', 2)).toBe('ab');
  });

  it('formats saved addresses', () => {
    expect(
      formatAddressLine({
        line1: '12 Main',
        line2: null,
        city: 'Ramallah',
        region: null,
        country: 'PS',
      }),
    ).toBe('12 Main, Ramallah, PS');
  });

  it('composes request notes sections', () => {
    expect(
      composeRequestNotes({
        deliveryNotes: 'Gate 2',
        dimensionsNotes: 'W 200',
        orderNotes: 'Rush',
      }),
    ).toContain('Delivery notes:');
    expect(composeRequestNotes({ deliveryNotes: '', dimensionsNotes: '', orderNotes: '' })).toBe(
      undefined,
    );
  });
});
