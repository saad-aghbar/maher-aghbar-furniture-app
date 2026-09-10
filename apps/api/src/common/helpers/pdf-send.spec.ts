import { sendPdf } from './pdf.util';

describe('sendPdf', () => {
  it('marks the response as a live, uncached document', () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
      send: jest.fn(),
    };
    const buffer = Buffer.from('%PDF-1.4');
    sendPdf(res, 'INV-1.pdf', buffer);
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(res.send).toHaveBeenCalledWith(buffer);
  });
});
