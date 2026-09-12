import { buildHandwrittenSheetPdf } from './handwritten-sheet-pdf';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('handwritten sheet PDF', () => {
  it('builds an A4 PDF document of record from the original photo', async () => {
    const pdf = await buildHandwrittenSheetPdf(PIXEL);
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(200);
  });
});
