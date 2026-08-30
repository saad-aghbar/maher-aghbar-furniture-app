import { selectFlowStageGlyph } from '../flowStageGlyph';

const pending = {
  status: 'PENDING',
  progressPercent: 0,
  estimateReviewRequired: false,
  estimatedMinutes: 5 as number | null,
};

describe('selectFlowStageGlyph', () => {
  it('leaves pending order-flow nodes empty instead of painting stub minutes', () => {
    expect(selectFlowStageGlyph(pending)).toBeNull();
    expect(selectFlowStageGlyph({ ...pending, estimatedMinutes: 5 })).toBeNull();
    expect(
      selectFlowStageGlyph({ ...pending, estimatedMinutes: 120 }, { showEstimatedDuration: false }),
    ).toBeNull();
  });

  it('keeps the completed check (no inner text) and time-approval bang', () => {
    expect(
      selectFlowStageGlyph({
        status: 'COMPLETED',
        progressPercent: 100,
        estimateReviewRequired: false,
        estimatedMinutes: 5,
      }),
    ).toBeNull();
    expect(
      selectFlowStageGlyph({
        status: 'PENDING',
        progressPercent: 0,
        estimateReviewRequired: true,
        estimatedMinutes: null,
      }),
    ).toBe('!');
  });

  it('shows live progress percent when work has started', () => {
    expect(
      selectFlowStageGlyph({
        status: 'IN_PROGRESS',
        progressPercent: 40,
        estimateReviewRequired: false,
        estimatedMinutes: 5,
      }),
    ).toBe('40%');
  });

  it('shows a real duration only when the times editor asks for it', () => {
    expect(
      selectFlowStageGlyph(
        { ...pending, estimatedMinutes: 5 },
        { showEstimatedDuration: true },
      ),
    ).toBe('5m');
    expect(
      selectFlowStageGlyph(
        { ...pending, estimatedMinutes: 120 },
        { showEstimatedDuration: true },
      ),
    ).toBe('2h');
  });
});
