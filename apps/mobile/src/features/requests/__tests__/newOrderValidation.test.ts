import {
  clampNotes,
  composeRequestNotes,
  formatAddressLine,
  guessCityFromAddress,
  isAddressAlreadySaved,
  isValidDeliveryAddress,
  isValidOptionalPhone,
  isValidQuantity,
  resolveModelName,
  suggestAddressLabel,
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

  it('keeps freeform street lines intact', () => {
    expect(
      formatAddressLine({
        line1: '12 Trade Street, Amman, JO',
        street: '12 Trade Street, Amman, JO',
        city: 'Amman',
        country: 'JO',
      }),
    ).toBe('12 Trade Street, Amman, JO');
  });

  it('guesses city and label from a freeform address', () => {
    expect(guessCityFromAddress('12 Trade Street, Amman, JO')).toBe('Amman');
    expect(suggestAddressLabel('Showroom lane, Amman, JO')).toBe('Showroom lane');
  });

  it('detects already-saved addresses', () => {
    const rows = [
      {
        line1: '12 Trade Street, Amman, JO',
        street: '12 Trade Street, Amman, JO',
        city: 'Amman',
        country: 'JO',
      },
    ];
    expect(isAddressAlreadySaved('12 Trade Street, Amman, JO', rows)).toBe(true);
    expect(isAddressAlreadySaved('Other place', rows)).toBe(false);
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

  it('supports product-step validation pairing (model + quantity)', () => {
    const modelOk = Boolean(resolveModelName({ customProductName: 'Sofa', catalogName: null }));
    const qtyOk = isValidQuantity('2');
    expect(modelOk && qtyOk).toBe(true);
    expect(
      Boolean(resolveModelName({ customProductName: '', catalogName: null })) &&
        isValidQuantity('1'),
    ).toBe(false);
    expect(
      Boolean(resolveModelName({ customProductName: 'Sofa', catalogName: null })) &&
        isValidQuantity('0'),
    ).toBe(false);
  });

  it('supports delivery-step validation pairing (address + optional phone)', () => {
    expect(
      isValidDeliveryAddress('12 Main') && isValidOptionalPhone('+970591234567'),
    ).toBe(true);
    expect(isValidDeliveryAddress('') && isValidOptionalPhone('')).toBe(false);
    expect(isValidDeliveryAddress('12 Main') && isValidOptionalPhone('12')).toBe(false);
  });
});
