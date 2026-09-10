import {
  BIN_QR_PREFIX,
  binScanPayload,
  defaultBinCode,
  formatBinQrCode,
  inventoryScanPayload,
  parseBinScanCode,
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

describe('bin scan payloads', () => {
  it('formats a unique shelf code from warehouse + bin', () => {
    expect(defaultBinCode('RAW')).toBe('RAW-MAIN');
    expect(formatBinQrCode('RAW', 'A1')).toBe('BIN-RAW-A1');
  });

  it('parses BIN: id fallback and BIN- printed codes', () => {
    expect(parseBinScanCode(`${BIN_QR_PREFIX}loc-1`)).toEqual({
      kind: 'bin',
      idOrCode: 'loc-1',
    });
    expect(parseBinScanCode('BIN-RAW-MAIN')).toEqual({
      kind: 'bin',
      idOrCode: 'BIN-RAW-MAIN',
    });
    expect(parseBinScanCode('RAW-A1')).toEqual({
      kind: 'unknown',
      idOrCode: 'RAW-A1',
    });
  });

  it('prefers stored qrCode on the payload', () => {
    expect(binScanPayload({ qrCode: 'BIN-RAW-MAIN', id: 'loc-1' })).toBe('BIN-RAW-MAIN');
    expect(binScanPayload({ qrCode: null, id: 'loc-1' })).toBe(`${BIN_QR_PREFIX}loc-1`);
  });
});
