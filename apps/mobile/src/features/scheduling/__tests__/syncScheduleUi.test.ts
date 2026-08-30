import {
  blockerKindI18nKey,
  selectSyncSheetPhase,
  shouldToastSyncCompletion,
  syncStatsFromResult,
} from '../syncScheduleUi';

describe('syncScheduleUi', () => {
  it('maps UP_TO_DATE from outcome, not from HTTP COMPLETED alone', () => {
    expect(
      selectSyncSheetPhase({
        run: { status: 'COMPLETED', result: { outcome: 'UP_TO_DATE', generated: 0, replanned: 0 } },
      }),
    ).toBe('upToDate');
    expect(
      selectSyncSheetPhase({
        run: { status: 'COMPLETED', result: { outcome: 'CHANGED', generated: 1 } },
      }),
    ).toBe('changed');
    expect(
      selectSyncSheetPhase({
        run: { status: 'COMPLETED', result: { outcome: 'PARTIAL', blocked: 2 } },
      }),
    ).toBe('partial');
  });

  it('does not toast a generic complete for already-up-to-date', () => {
    expect(shouldToastSyncCompletion('upToDate')).toBe(false);
    expect(shouldToastSyncCompletion('changed')).toBe(false);
    expect(shouldToastSyncCompletion('partial')).toBe(false);
    expect(shouldToastSyncCompletion('failed')).toBe(true);
  });

  it('shows syncing while the run is live and in-progress copy on 409', () => {
    expect(selectSyncSheetPhase({ run: { status: 'RUNNING' } })).toBe('syncing');
    expect(selectSyncSheetPhase({ conflictInProgress: true })).toBe('inProgress');
    expect(selectSyncSheetPhase({ alreadyInProgress: true })).toBe('inProgress');
  });

  it('maps blocker kinds to copy keys, never raw engine codes', () => {
    expect(blockerKindI18nKey('MATERIAL_NOT_READY')).toBe('mobile.adminScheduling.sync.blockedMaterials');
    expect(blockerKindI18nKey('WIP_NOT_READY')).toBe('mobile.adminScheduling.sync.blockedWip');
    expect(blockerKindI18nKey('NO_ELIGIBLE_WORKER')).toBe('mobile.adminScheduling.sync.blockedWorkers');
    expect(blockerKindI18nKey('MISSING_ESTIMATE')).toBe('mobile.adminScheduling.sync.blockedEstimates');
  });

  it('reads generated/replanned/blocked from the result JSON', () => {
    const stats = syncStatsFromResult({
      scannedOrders: 12,
      alreadyValid: 9,
      generated: 1,
      replanned: 2,
      atRiskRecovered: 1,
      blockedItems: [{ productionOrderId: 'a', number: 'PO-A', blockerKind: 'MATERIAL_NOT_READY' }],
      manualAttentionItems: [{ productionOrderId: 'b', number: 'PO-B' }],
      conflictsResolved: 1,
      newConflictsIntroduced: 0,
    });
    expect(stats.scanned).toBe(12);
    expect(stats.generated).toBe(1);
    expect(stats.replanned).toBe(2);
    expect(stats.blockedItems).toHaveLength(1);
    expect(stats.newConflictsIntroduced).toBe(0);
  });
});
