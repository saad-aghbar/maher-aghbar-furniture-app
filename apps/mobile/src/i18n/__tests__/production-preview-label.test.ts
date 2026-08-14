import { formatProductionPreviewStep } from '@maher/i18n';

describe('formatProductionPreviewStep (mobile)', () => {
  it('prefers Hebrew labels for HE locale', () => {
    expect(
      formatProductionPreviewStep('he', {
        stageNameEn: 'Upholstery',
        stageNameAr: 'تنجيد',
        stageNameHe: 'ריפוד',
        produces: { nameEn: 'Cover', nameAr: 'غطاء', nameHe: 'כיסוי' },
      }),
    ).toBe('ריפוד → כיסוי');
  });
});
