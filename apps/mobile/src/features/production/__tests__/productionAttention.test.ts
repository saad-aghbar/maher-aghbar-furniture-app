import {
  attentionCtaHref,
  collectProductionAttention,
  isRawAttentionToken,
  mapReadinessReasonToAttention,
} from '../productionAttention';

describe('productionAttention', () => {
  it('never treats mapped labels as raw codes', () => {
    expect(isRawAttentionToken('MISSING_ASSIGNMENT')).toBe(true);
    expect(isRawAttentionToken('WAITING_FOR_MATERIALS')).toBe(true);
    expect(isRawAttentionToken('SEMI_HANDOFF_MISMATCH')).toBe(true);
    expect(isRawAttentionToken('Velvet 302 is 12m short')).toBe(false);
  });

  it('maps readiness codes to WHAT/WHY/NEXT keys without exposing codes as copy', () => {
    const block = mapReadinessReasonToAttention({
      code: 'MATERIALS_HOLD',
      message: 'MISSING_ASSIGNMENT',
      stageName: 'Upholstery',
    });
    expect(block.whatKey).toContain('MATERIALS_HOLD');
    expect(block.whyKey).toContain('MATERIALS_HOLD');
    expect(block.nextKey).toContain('MATERIALS_HOLD');
    expect(block.ctaKind).toBe('purchasing');
    // Raw code in message is dropped
    expect(block.whyDetail).toBeNull();
  });

  it('routes Attention CTAs to the owning domain', () => {
    const materials = mapReadinessReasonToAttention({ code: 'MATERIALS_HOLD' });
    expect(String(attentionCtaHref(materials, { productionOrderId: 'po-1' }))).toContain(
      'purchasing',
    );

    const semi = mapReadinessReasonToAttention({ code: 'SEMI_HANDOFF_MISMATCH' as never });
    // normalize maps SEMI_HANDOFF_MISMATCH via code string — use collect path
    const blocks = collectProductionAttention({
      reasons: [{ code: 'OPEN_BLOCKER', message: 'Assembly expects 2 kits' }],
      blockers: [
        {
          id: 'b1',
          category: 'SEMI_HANDOFF',
          reason: 'Assembly expects 2 frame kits; only 1 arrived.',
          taskId: 't1',
        },
      ],
    });
    const semiBlock = blocks.find((b) => b.code === 'SEMI_ISSUE');
    expect(semiBlock).toBeTruthy();
    expect(String(attentionCtaHref(semiBlock!, { productionOrderId: 'po-1' }))).toContain(
      'hub=wip',
    );

    const late = collectProductionAttention({ isLate: true });
    expect(late.some((b) => b.code === 'TASK_LATE')).toBe(true);
    expect(
      String(attentionCtaHref(late[0]!, { productionOrderId: 'po-1' })),
    ).toContain('scheduling');
  });

  it('keeps human whyDetail when message is not a code', () => {
    const block = mapReadinessReasonToAttention({
      code: 'OPEN_BLOCKER',
      message: 'Inspection failed: loose stitching.',
    });
    expect(block.whyDetail).toBe('Inspection failed: loose stitching.');
  });
});
