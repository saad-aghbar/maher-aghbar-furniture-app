import { describe, expect, it } from 'vitest';
import { formatProductionPreviewStep } from '@maher/i18n';

describe('formatProductionPreviewStep', () => {
  const step = {
    stageNameEn: 'Carpentry',
    stageNameAr: 'نجارة',
    stageNameHe: 'נגרות',
    produces: {
      nameEn: 'Frame',
      nameAr: 'هيكل',
      nameHe: 'שלדה',
    },
  };

  it('uses Hebrew names when locale is he', () => {
    expect(formatProductionPreviewStep('he', step)).toBe('נגרות → שלדה');
  });

  it('uses Arabic names when locale is ar', () => {
    expect(formatProductionPreviewStep('ar', step)).toBe('نجارة → هيكل');
  });

  it('uses English names when locale is en', () => {
    expect(formatProductionPreviewStep('en', step)).toBe('Carpentry → Frame');
  });

  it('falls back to English when Hebrew is missing', () => {
    expect(
      formatProductionPreviewStep('he', {
        stageNameEn: 'Carpentry',
        stageNameAr: 'نجارة',
        stageNameHe: null,
        produces: { nameEn: 'Frame', nameAr: 'هيكل', nameHe: null },
      }),
    ).toBe('Carpentry → Frame');
  });
});
