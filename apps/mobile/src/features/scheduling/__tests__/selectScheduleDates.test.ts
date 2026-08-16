import {
  calendarDayDelta,
  filterConflictRows,
  selectConflictOrderLabels,
  selectConflictRows,
  selectConflictTypeKey,
  selectOverlapDurationParts,
  selectScheduleDates,
  selectShowPriority,
  selectUniqueConflictProductionOrderIds,
  selectUnschedulableReasonKey,
} from '../selectScheduleDates';

describe('selectScheduleDates', () => {
  it('uses an expanded plan when requested, suggested, and committed differ', () => {
    const view = selectScheduleDates({
      requestedDeliveryDate: '2026-08-20',
      suggestedDeliveryDate: '2026-08-22',
      committedDeliveryDate: '2026-08-21',
      earliestAvailableDate: '2026-08-22',
      requestedDateFeasible: false,
    });
    expect(view.plan).toBe('infeasible');
    expect(view.requestedIso).toBe('2026-08-20');
    expect(view.suggestedIso).toBe('2026-08-22');
    expect(view.committedIso).toBe('2026-08-21');
    expect(view.infeasible).toBe(true);
    expect(view.identicalRequestedSuggested).toBe(false);
    expect(view.daysLater).toBe(2);
  });

  it('compacts identical requested/suggested/committed', () => {
    const view = selectScheduleDates({
      requestedDeliveryDate: '2026-08-20T00:00:00.000Z',
      suggestedDeliveryDate: '2026-08-20T00:00:00.000Z',
      committedDeliveryDate: '2026-08-20T12:00:00.000Z',
      requestedDateFeasible: true,
      scheduleStatus: 'APPROVED',
      promiseState: 'CONFIRMED',
    });
    expect(view.plan).toBe('identical');
    expect(view.identicalRequestedSuggested).toBe(true);
    expect(view.infeasible).toBe(false);
    expect(view.onTrack).toBe(true);
  });

  it('uses earliest-available when there is no requested date', () => {
    const view = selectScheduleDates({
      planningMode: 'FORWARD',
      suggestedDeliveryDate: '2026-09-04',
      committedDeliveryDate: '2026-09-04',
    });
    expect(view.plan).toBe('earliest');
    expect(view.earliestAvailable).toBe(true);
    expect(view.requestedIso).toBeNull();
  });

  it('maps unschedulable reasons without exposing raw enums', () => {
    expect(selectUnschedulableReasonKey('NO_ELIGIBLE_WORKER')).toBe(
      'mobile.adminScheduling.reasons.noEligibleWorker',
    );
    expect(selectUnschedulableReasonKey('MATERIAL_NOT_READY')).toBe(
      'mobile.adminScheduling.reasons.materialNotReady',
    );
    expect(selectUnschedulableReasonKey('WIP_NOT_READY')).toBe(
      'mobile.adminScheduling.reasons.wipNotReady',
    );
    expect(selectUnschedulableReasonKey('NO_SLOT')).toBe('mobile.adminScheduling.reasons.capacity');
    const blocked = selectScheduleDates(
      { unschedulableReason: 'NO_ELIGIBLE_WORKER' },
      'Painting',
    ).blocked;
    expect(blocked?.titleKey).toBe('mobile.adminScheduling.blocked.title');
    expect(blocked?.bodyKey).toBe('mobile.adminScheduling.blocked.noEligibleWorkers');
    expect(blocked?.name).toBe('Painting');
  });

  it('maps estimate-review and material ready vs unknown without inventing WIP names', () => {
    const review = selectScheduleDates({ requiresAdminEstimateReview: true });
    expect(review.plan).toBe('blocked');
    expect(review.blocked?.reasonKey).toBe('mobile.adminScheduling.reasons.estimateReview');

    const materialKnown = selectScheduleDates({
      materialRisk: true,
      materialReadyAt: '2026-08-18T08:00:00.000Z',
    });
    expect(materialKnown.materialReadyAtIso).toBe('2026-08-18T08:00:00.000Z');

    const wip = selectScheduleDates({ unschedulableReason: 'WIP_NOT_READY' });
    expect(wip.blocked?.bodyKey).toBe('mobile.adminScheduling.blocked.wip');
    expect(wip.blocked?.name).toBeUndefined();

    const cycle = selectScheduleDates({ unschedulableReason: 'WIP_DEPENDENCY_CYCLE' });
    expect(cycle.blocked?.bodyKey).toBe('mobile.adminScheduling.blocked.wip');
    expect(selectUnschedulableReasonKey('WIP_DEPENDENCY_CYCLE')).toBe(
      'mobile.adminScheduling.reasons.wipNotReady',
    );

    const scheduledMaterials = selectScheduleDates({
      scheduleStatus: 'PROPOSED',
      suggestedDeliveryDate: '2026-08-22T08:00:00.000Z',
      earliestAvailableDate: '2026-08-22T08:00:00.000Z',
      materialReadyAt: '2026-08-20T08:00:00.000Z',
    });
    expect(scheduledMaterials.plan).not.toBe('blocked');
    expect(scheduledMaterials.materialReadyAtIso).toBe('2026-08-20T08:00:00.000Z');
  });

  it('does not treat a proposed plan with estimate-review as blocked or late', () => {
    const dates = selectScheduleDates({
      scheduleStatus: 'PROPOSED',
      requiresAdminEstimateReview: true,
      materialRisk: true,
      suggestedDeliveryDate: '2026-08-17T08:00:00.000Z',
      earliestAvailableDate: '2026-08-17T08:00:00.000Z',
      requestedDateFeasible: false,
      requestedDeliveryDate: '2026-08-16',
    });
    expect(dates.plan).not.toBe('blocked');
    expect(dates.infeasible).toBe(true);
  });

  it('computes calendar day deltas', () => {
    expect(calendarDayDelta('2026-08-20', '2026-08-22')).toBe(2);
    expect(calendarDayDelta(null, '2026-08-22')).toBeNull();
  });
});

describe('selectConflictRows', () => {
  it('maps backend overlap pairs and never returns allocation ids as labels', () => {
    const rows = selectConflictRows([
      {
        employeeId: 'e1',
        employeeName: 'Ali Carp',
        a: {
          allocationId: 'a1',
          productionOrderId: 'po-1',
          task: 'Carpentry',
          start: '2026-08-10T08:00:00.000Z',
        },
        b: {
          allocationId: 'a2',
          productionOrderId: 'po-2',
          task: 'Assembly',
          start: '2026-08-10T10:00:00.000Z',
        },
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.employeeName).toBe('Ali Carp');
    expect(rows[0]!.productionOrderIds).toEqual(['po-1', 'po-2']);
    expect(rows[0]!.taskA).toBe('Carpentry');
    expect(rows[0]!.startYmd).toBe('2026-08-10');
    expect(rows[0]!.allocationA.orderNumber).toBe('');
    expect(rows[0]!.overlapStart).toBe('2026-08-10T08:00:00.000Z');
    const labels = selectConflictOrderLabels(rows[0]!.productionOrderIds, [
      { productionOrderId: 'po-1', number: 'PO-0001' },
      { productionOrderId: 'po-2', number: 'PO-0002' },
    ]);
    expect(labels).toEqual(['PO-0001', 'PO-0002']);
    expect(labels.join(' ')).not.toContain('a1');
    expect(labels.join(' ')).not.toContain('a2');
    expect(selectConflictOrderLabels(['unknown-uuid'], [])).toEqual([]);
  });

  it('collects unique production order ids for resolve-all', () => {
    expect(
      selectUniqueConflictProductionOrderIds([
        { productionOrderIds: ['po-1', 'po-2'] },
        { productionOrderIds: ['po-2', 'po-3'] },
      ]),
    ).toEqual(['po-1', 'po-2', 'po-3']);
  });

  it('filters overlap rows by worker, task, or PO number', () => {
    const rows = selectConflictRows([
      {
        employeeId: 'e1',
        employeeName: 'Yousef Haddad',
        a: {
          allocationId: 'a1',
          productionOrderId: 'po-1',
          task: 'Material preparation',
          start: '2026-08-26T08:00:00.000Z',
        },
        b: {
          allocationId: 'a2',
          productionOrderId: 'po-2',
          task: 'Material preparation',
          start: '2026-08-26T10:00:00.000Z',
        },
      },
      {
        employeeId: 'e2',
        employeeName: 'Ali Carp',
        a: {
          allocationId: 'a3',
          productionOrderId: 'po-3',
          task: 'Carpentry',
          start: '2026-08-27T08:00:00.000Z',
        },
        b: {
          allocationId: 'a4',
          productionOrderId: 'po-4',
          task: 'Assembly',
          start: '2026-08-27T09:00:00.000Z',
        },
      },
    ]);
    const labels = [
      { productionOrderId: 'po-1', number: 'PO-2026-00036' },
      { productionOrderId: 'po-2', number: 'PO-2026-00037' },
    ];
    expect(filterConflictRows(rows, 'yousef', labels)).toHaveLength(1);
    expect(filterConflictRows(rows, 'PO-2026-00036', labels).map((row) => row.employeeName)).toEqual([
      'Yousef Haddad',
    ]);
    expect(filterConflictRows(rows, 'carpentry', labels)).toHaveLength(1);
  });

  it('maps enriched collision payloads with overlap window and stage', () => {
    const rows = selectConflictRows([
      {
        conflictId: 'a1:a2',
        type: 'WORKER_OVERLAP',
        worker: { id: 'e1', name: 'Ahmad Khalil' },
        overlapStart: '2026-08-16T08:30:00.000Z',
        overlapEnd: '2026-08-16T10:00:00.000Z',
        overlapMinutes: 90,
        allocationA: {
          allocationId: 'a1',
          productionOrderId: 'po-1',
          orderNumber: 'PO-1042',
          productName: 'Milano Sofa',
          stageName: 'Upholstery',
          start: '2026-08-16T07:00:00.000Z',
          end: '2026-08-16T10:00:00.000Z',
          priority: 'HIGH',
        },
        allocationB: {
          allocationId: 'a2',
          productionOrderId: 'po-2',
          orderNumber: 'PO-1057',
          productName: 'Chair',
          stageName: 'Upholstery',
          start: '2026-08-16T08:30:00.000Z',
          end: '2026-08-16T11:30:00.000Z',
          priority: 'NORMAL',
        },
      },
    ]);
    expect(rows[0]!.id).toBe('a1:a2');
    expect(rows[0]!.employeeName).toBe('Ahmad Khalil');
    expect(rows[0]!.stageName).toBe('Upholstery');
    expect(rows[0]!.overlapMinutes).toBe(90);
    expect(rows[0]!.allocationA.orderNumber).toBe('PO-1042');
    expect(rows[0]!.allocationA.orderNumber).not.toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(rows[0]!.id).not.toBe(rows[0]!.allocationA.productionOrderId);
    expect(selectOverlapDurationParts(90)).toEqual({ hours: 1, minutes: 30 });
    expect(selectConflictTypeKey('WORKER_OVERLAP')).toBe(
      'mobile.adminScheduling.conflicts.typeOverlap',
    );
    expect(selectConflictTypeKey('RESOURCE_OVERLAP')).toBe(
      'mobile.adminScheduling.conflicts.typeResource',
    );
    expect(selectConflictTypeKey('INVALID_SKILL')).toBe(
      'mobile.adminScheduling.conflicts.typeSkill',
    );
    expect(selectConflictTypeKey('CLOSED_DAY_ALLOCATION')).toBe(
      'mobile.adminScheduling.conflicts.typeClosed',
    );
    expect(selectConflictTypeKey('INACTIVE_WORKER_ALLOCATION')).toBe(
      'mobile.adminScheduling.conflicts.typeInactive',
    );
    expect(selectConflictTypeKey('LOCKED_CONFLICT')).toBe(
      'mobile.adminScheduling.conflicts.typeLocked',
    );
    for (const type of [
      'WORKER_OVERLAP',
      'RESOURCE_OVERLAP',
      'INVALID_SKILL',
      'CLOSED_DAY_ALLOCATION',
      'INACTIVE_WORKER_ALLOCATION',
      'LOCKED_CONFLICT',
    ]) {
      expect(selectConflictTypeKey(type)).not.toBe(type);
    }
    expect(selectShowPriority('HIGH', 'NORMAL')).toBe(true);
    expect(selectShowPriority('NORMAL', 'NORMAL')).toBe(false);
  });
});
