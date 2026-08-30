import {
  optimizeBlockerI18nKey,
  selectOptimizeSheetPhase,
  shouldToastOptimizeCompletion,
  optimizeStatsFromResult,
} from '../optimizeScheduleUi';

describe('optimizeScheduleUi', () => {
  it('shows preview after a completed preview run with movable work', () => {
    expect(
      selectOptimizeSheetPhase({
        run: {
          status: 'COMPLETED',
          result: { mode: 'preview', outcome: 'CHANGED', wouldMove: 4 },
        },
      }),
    ).toBe('preview');
  });

  it('shows already-efficient copy when preview finds nothing to move', () => {
    expect(
      selectOptimizeSheetPhase({
        run: {
          status: 'COMPLETED',
          result: { mode: 'preview', outcome: 'UP_TO_DATE', wouldMove: 0, moved: 0 },
        },
      }),
    ).toBe('upToDate');
  });

  it('shows applying while persist run is live and changed after apply', () => {
    expect(
      selectOptimizeSheetPhase({
        run: { status: 'RUNNING', result: { mode: 'apply' } },
        awaitingApply: true,
      }),
    ).toBe('applying');
    expect(
      selectOptimizeSheetPhase({
        run: { status: 'COMPLETED', result: { mode: 'apply', outcome: 'CHANGED', moved: 3 } },
      }),
    ).toBe('changed');
  });

  it('maps empty-day and blocker kinds to copy keys', () => {
    expect(optimizeBlockerI18nKey('NOT_READY_MATERIAL')).toBe(
      'mobile.adminScheduling.optimize.blockedMaterials',
    );
    const stats = optimizeStatsFromResult({
      scannedOrders: 10,
      wouldMove: 3,
      emptyDays: [{ ymd: '2026-08-18', causeKey: 'mobile.adminScheduling.optimize.emptyDay.materialEta' }],
    });
    expect(stats.emptyDays[0]?.causeKey).toContain('emptyDay.materialEta');
  });

  it('does not toast success for an already-efficient schedule', () => {
    expect(shouldToastOptimizeCompletion('upToDate')).toBe(false);
    expect(shouldToastOptimizeCompletion('preview')).toBe(false);
    expect(shouldToastOptimizeCompletion('failed')).toBe(true);
  });
});
