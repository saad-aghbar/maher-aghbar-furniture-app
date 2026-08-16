import { normalizeUploadMime } from '../presentAfterUiSettle';

describe('normalizeUploadMime', () => {
  it('maps jpg aliases and falls back from extension', () => {
    expect(normalizeUploadMime('image/jpg', 'x')).toBe('image/jpeg');
    expect(normalizeUploadMime(null, 'file.HEIC')).toBe('image/heic');
    expect(normalizeUploadMime(undefined, 'a', 'scan.PDF')).toBe('application/pdf');
  });
});
