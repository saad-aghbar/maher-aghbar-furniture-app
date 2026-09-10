import { dispositionFor, mimeFromKey } from './download-mime';

describe('download-mime', () => {
  it('maps m4a to audio/mp4 and plays inline', () => {
    expect(mimeFromKey('2026-09-08/abc.m4a')).toBe('audio/mp4');
    expect(dispositionFor('audio/mp4')).toBe('inline');
  });

  it('keeps images inline and pdfs as attachments', () => {
    expect(mimeFromKey('photo.jpg')).toBe('image/jpeg');
    expect(dispositionFor('image/jpeg')).toBe('inline');
    expect(mimeFromKey('quote.pdf')).toBe('application/pdf');
    expect(dispositionFor('application/pdf')).toBe('attachment');
  });

  it('leaves unknown extensions as octet-stream attachments', () => {
    expect(mimeFromKey('file.bin')).toBe('application/octet-stream');
    expect(dispositionFor('application/octet-stream')).toBe('attachment');
  });
});
