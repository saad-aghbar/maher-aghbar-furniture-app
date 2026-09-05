import {
  humanizeWorkflowCode,
  isMachineWorkflowCode,
  toSentenceCaseName,
  workflowDisplayName,
} from '../workflowDisplayName';

describe('workflowDisplayName', () => {
  it('humanizes shouty machine codes', () => {
    expect(isMachineWorkflowCode('SIMPLE_OTTOMAN')).toBe(true);
    expect(humanizeWorkflowCode('SIMPLE_OTTOMAN')).toBe('Simple ottoman');
    expect(humanizeWorkflowCode('CUSTOM_SECTIONAL')).toBe('Custom sectional');
    expect(
      workflowDisplayName('en', { code: 'SIMPLE_OTTOMAN', nameEn: 'SIMPLE_OTTOMAN' }),
    ).toBe('Simple ottoman');
  });

  it('keeps a single leading capital on Latin names', () => {
    expect(toSentenceCaseName('Simple Ottoman')).toBe('Simple ottoman');
    expect(
      workflowDisplayName('en', {
        code: 'SIMPLE_OTTOMAN',
        nameEn: 'Simple ottoman',
      }),
    ).toBe('Simple ottoman');
    expect(
      workflowDisplayName('en', {
        code: 'CUSTOM_SECTIONAL',
        nameEn: 'Custom sectional (parallel foam)',
      }),
    ).toBe('Custom sectional (parallel foam)');
  });

  it('never returns the raw code when a human name exists', () => {
    const name = workflowDisplayName('en', {
      code: 'ARMCHAIR_PATH',
      nameEn: 'Armchair upholstery',
    });
    expect(name).toBe('Armchair upholstery');
    expect(name).not.toMatch(/[A-Z]{2,}/);
    expect(name).not.toContain('_');
  });

  it('leaves Arabic and Hebrew names alone', () => {
    expect(
      workflowDisplayName('ar', {
        code: 'SIMPLE_OTTOMAN',
        nameEn: 'Simple ottoman',
        nameAr: 'عثماني بسيط',
      }),
    ).toBe('عثماني بسيط');
    expect(
      workflowDisplayName('he', {
        code: 'SIMPLE_OTTOMAN',
        nameEn: 'Simple ottoman',
        nameHe: 'הדום פשוט',
      }),
    ).toBe('הדום פשוט');
  });

  it('falls back to a sentence-case English name, then a humanized code', () => {
    expect(
      workflowDisplayName('ar', {
        code: 'PAINTED_WOOD',
        nameEn: 'Painted wood furniture',
      }),
    ).toBe('Painted wood furniture');
    expect(workflowDisplayName('en', { code: 'STANDARD_FURNITURE' })).toBe(
      'Standard furniture',
    );
  });
});
