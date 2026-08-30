import {
  inventoryScanPayload,
  parseWipScanCode,
  printableScanCode,
  WIP_KIT_QR_PREFIX,
} from './scan-code';

describe('printableScanCode', () => {
  it('returns a plain SKU', () => {
    expect(printableScanCode('MAT-ITAL-VEL')).toBe('MAT-ITAL-VEL');
  });

  it('strips Expo and URL-shaped values', () => {
    expect(printableScanCode('exp://192.168.1.16:8082')).toBe('—');
    expect(printableScanCode('https://example.com', 'MAT-FAB-ROLL')).toBe('MAT-FAB-ROLL');
    expect(printableScanCode('file:///tmp/x')).toBe('—');
  });

  it('treats blank as fallback', () => {
    expect(printableScanCode(null)).toBe('—');
    expect(printableScanCode('  ', 'SKU')).toBe('SKU');
  });
});

describe('inventoryScanPayload', () => {
  it('uses qrCode when it is a printable code', () => {
    expect(inventoryScanPayload({ sku: 'MAT-NEW', qrCode: 'MAT-ITAL-VEL' })).toBe(
      'MAT-ITAL-VEL',
    );
  });

  it('falls back to sku when qrCode is empty', () => {
    expect(inventoryScanPayload({ sku: 'MAT-ITAL-VEL', qrCode: null })).toBe(
      'MAT-ITAL-VEL',
    );
    expect(inventoryScanPayload({ sku: 'MAT-ITAL-VEL', qrCode: '' })).toBe(
      'MAT-ITAL-VEL',
    );
  });

  it('falls back to sku when qrCode is URL-shaped', () => {
    expect(
      inventoryScanPayload({ sku: 'MAT-ITAL-VEL', qrCode: 'https://example.com/x' }),
    ).toBe('MAT-ITAL-VEL');
  });
});

describe('parseWipScanCode', () => {
  it('parses kit and piece prefixes', () => {
    expect(parseWipScanCode(`${WIP_KIT_QR_PREFIX}abc`)).toEqual({
      kind: 'kit',
      idOrCode: 'abc',
    });
    expect(parseWipScanCode('WIP-PO-1-CARPENTRY')).toEqual({
      kind: 'unknown',
      idOrCode: 'WIP-PO-1-CARPENTRY',
    });
  });
});
