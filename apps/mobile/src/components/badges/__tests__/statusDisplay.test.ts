import { displayStatusLabel, localizeStatusPrefixedText, looksLikeStatusEnum } from '../statusDisplay';

describe('statusDisplay', () => {
  it('localizes invoice statuses in AR and HE — never SCREAMING_SNAKE', () => {
    expect(displayStatusLabel('en', 'PARTIALLY_PAID')).toBe('Partially paid');
    expect(displayStatusLabel('ar', 'PARTIALLY_PAID')).toBe('مدفوعة جزئياً');
    expect(displayStatusLabel('he', 'PARTIALLY_PAID')).toBe('שולם חלקית');

    expect(displayStatusLabel('en', 'ISSUED')).toBe('Issued');
    expect(displayStatusLabel('ar', 'issued')).toBe('صادرة');
    expect(displayStatusLabel('he', 'PAID')).toBe('שולם');

    expect(displayStatusLabel('ar', 'PARTIALLY_PAID')).not.toMatch(/_/);
    expect(displayStatusLabel('he', 'ISSUED')).not.toMatch(/_/);
  });

  it('localizes request-source codes used on order detail', () => {
    expect(displayStatusLabel('en', 'PORTAL')).toBe('Customer portal');
    expect(displayStatusLabel('ar', 'PORTAL')).toBe('بوابة العميل');
    expect(displayStatusLabel('he', 'WHATSAPP')).toBe('וואטסאפ');
  });

  it('title-cases unknown codes instead of leaving SCREAMING_SNAKE', () => {
    expect(displayStatusLabel('en', 'SOME_NEW_STATUS')).toBe('Some New Status');
    expect(displayStatusLabel('ar', 'SOME_NEW_STATUS')).not.toContain('_');
  });

  it('detects raw enum leftovers', () => {
    expect(looksLikeStatusEnum('PARTIALLY_PAID')).toBe(true);
    expect(looksLikeStatusEnum('PAID')).toBe(true);
    expect(looksLikeStatusEnum('Partially paid')).toBe(false);
    expect(looksLikeStatusEnum('INV-2026-00011')).toBe(false);
  });

  it('localizes search-hit subtitles that prefix a status enum', () => {
    expect(localizeStatusPrefixedText('en', 'PARTIALLY_PAID · 196.272')).toBe(
      'Partially paid · 196.272',
    );
    expect(localizeStatusPrefixedText('ar', 'ISSUED • 354.96')).toBe('صادرة · 354.96');
    expect(localizeStatusPrefixedText('he', 'PAID · 12')).toBe('שולם · 12');
    expect(localizeStatusPrefixedText('ar', 'Nile Interiors')).toBe('Nile Interiors');
  });
});
