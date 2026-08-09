import { qrImageSrc } from '../jofotaraQr';

describe('qrImageSrc', () => {
  it('passes through data URIs', () => {
    const src = 'data:image/png;base64,abc';
    expect(qrImageSrc(src)).toBe(src);
  });

  it('wraps long base64 payloads', () => {
    const raw = 'A'.repeat(120);
    expect(qrImageSrc(raw)).toBe(`data:image/png;base64,${raw}`);
  });

  it('returns null for short opaque strings', () => {
    expect(qrImageSrc('not-a-qr')).toBeNull();
  });
});
