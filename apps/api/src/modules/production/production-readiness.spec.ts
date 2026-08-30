import {
  assessAssignmentReadiness,
  assessDatesReadiness,
  assessProductionReadiness,
  isExecutableProductionTask,
  listExecutableTasks,
  resolveBoardBucket,
  taskHasPlannedTiming,
  STARTABLE_PO_STATUSES,
} from './production-readiness';

describe('production-readiness', () => {
  const carpentry = {
    id: 't1',
    status: 'NOT_STARTED',
    assignedEmployeeId: null as string | null,
    plannedStart: null as string | null,
    plannedCompletion: null as string | null,
    stageDefinition: {
      id: 's1',
      code: 'CARPENTRY',
      nameEn: 'Carpentry',
      executionKind: 'PRODUCTION',
    },
  };
  const assembly = {
    id: 't2',
    status: 'NOT_STARTED',
    assignedEmployeeId: 'u1',
    plannedStart: '2026-09-01T08:00:00.000Z',
    plannedCompletion: '2026-09-01T16:00:00.000Z',
    stageDefinition: {
      id: 's2',
      code: 'ASSEMBLY',
      nameEn: 'Assembly',
      executionKind: 'PRODUCTION',
    },
  };
  const delivery = {
    id: 't3',
    status: 'NOT_STARTED',
    assignedEmployeeId: null,
    plannedCompletion: null,
    stageDefinition: {
      id: 's3',
      code: 'DELIVERY',
      nameEn: 'Delivery',
      executionKind: 'LOGISTICS',
    },
  };
  const rework = {
    id: 't4',
    status: 'NOT_STARTED',
    isRework: true,
    assignedEmployeeId: null,
    stageDefinition: {
      id: 's4',
      code: 'CARPENTRY',
      nameEn: 'Carpentry rework',
      executionKind: 'PRODUCTION',
    },
  };

  const dated = (task: typeof carpentry, employeeId: string) => ({
    ...task,
    assignedEmployeeId: employeeId,
    plannedStart: '2026-09-01T08:00:00.000Z',
    plannedCompletion: '2026-09-01T16:00:00.000Z',
  });

  it('excludes LOGISTICS/DELIVERY and rework from executable set', () => {
    const tasks = [carpentry, assembly, delivery, rework];
    expect(listExecutableTasks(tasks).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(isExecutableProductionTask(delivery)).toBe(false);
    expect(isExecutableProductionTask(rework)).toBe(false);
  });

  it('reports missing assignments for ALL_EXECUTABLE_STAGES', () => {
    const result = assessAssignmentReadiness([carpentry, assembly, delivery]);
    expect(result.required).toBe(2);
    expect(result.assigned).toBe(1);
    expect(result.missing).toEqual([
      {
        taskId: 't1',
        stageId: 's1',
        stageCode: 'CARPENTRY',
        stageName: 'Carpentry',
      },
    ]);
  });

  it('reports missing dates when planned timing absent', () => {
    const result = assessDatesReadiness([
      { ...carpentry, assignedEmployeeId: 'u1' },
      assembly,
    ]);
    expect(result.required).toBe(2);
    expect(result.ready).toBe(1);
    expect(result.missing[0]?.taskId).toBe('t1');
  });

  it('taskHasPlannedTiming requires completion when start is set', () => {
    expect(
      taskHasPlannedTiming({
        ...carpentry,
        plannedStart: '2026-09-01T08:00:00.000Z',
        plannedCompletion: null,
      }),
    ).toBe(false);
    expect(
      taskHasPlannedTiming({
        ...carpentry,
        plannedStart: null,
        plannedCompletion: '2026-09-01T16:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('canStart when all executable tasks assigned+dated and status startable', () => {
    const ready = assessProductionReadiness({
      status: 'PLANNED',
      tasks: [dated(carpentry, 'u1'), dated({ ...assembly, assignedEmployeeId: null }, 'u2')],
      schedulePresent: false,
    });
    expect(ready.canStart).toBe(true);
    expect(ready.workersReady).toBe(true);
    expect(ready.datesReady).toBe(true);
    expect(ready.boardBucket).toBe('ready_to_start');
    expect(ready.materialsReady).toBe(true);
  });

  it('needs_setup when workers missing', () => {
    const r = assessProductionReadiness({
      status: 'PLANNED',
      tasks: [carpentry, assembly],
    });
    expect(r.canStart).toBe(false);
    expect(r.workersReady).toBe(false);
    expect(r.boardBucket).toBe('needs_setup');
    expect(r.reasons.some((x) => x.code === 'MISSING_ASSIGNMENT')).toBe(true);
  });

  it('needs_setup when dates missing even if workers assigned', () => {
    const r = assessProductionReadiness({
      status: 'PLANNED',
      tasks: [
        { ...carpentry, assignedEmployeeId: 'u1', plannedCompletion: null, plannedStart: null },
        { ...assembly, assignedEmployeeId: 'u2' },
      ],
    });
    expect(r.canStart).toBe(false);
    expect(r.workersReady).toBe(true);
    expect(r.datesReady).toBe(false);
    expect(r.boardBucket).toBe('needs_setup');
    expect(r.reasons.some((x) => x.code === 'MISSING_DATE')).toBe(true);
  });

  it('surfaces MATERIALS_HOLD soft without blocking hard canStart when assigned+dated', () => {
    const r = assessProductionReadiness({
      status: 'WAITING_FOR_MATERIALS',
      tasks: [dated(carpentry, 'u1'), dated({ ...assembly, assignedEmployeeId: null }, 'u2')],
    });
    expect(r.materialsReady).toBe(false);
    expect(r.reasons.some((x) => x.code === 'MATERIALS_HOLD')).toBe(true);
    expect(r.canStart).toBe(true);
    expect(r.boardBucket).toBe('blocked');
  });

  it('maps inspection/packaging and on_floor buckets', () => {
    expect(
      resolveBoardBucket({
        status: 'IN_PROGRESS',
        assignmentComplete: true,
        datesComplete: true,
        materialsReady: true,
        workflowReady: true,
        hasOpenBlockers: false,
      }),
    ).toBe('on_floor');
    expect(
      resolveBoardBucket({
        status: 'QUALITY_CHECK',
        assignmentComplete: true,
        datesComplete: true,
        materialsReady: true,
        workflowReady: true,
        hasOpenBlockers: false,
      }),
    ).toBe('inspection_packaging');
    expect(
      resolveBoardBucket({
        status: 'IN_PROGRESS',
        currentStageCode: 'PACKAGING',
        assignmentComplete: true,
        datesComplete: true,
        materialsReady: true,
        workflowReady: true,
        hasOpenBlockers: false,
      }),
    ).toBe('inspection_packaging');
  });

  it('lists startable statuses', () => {
    expect(STARTABLE_PO_STATUSES).toContain('PLANNED');
    expect(STARTABLE_PO_STATUSES).toContain('WAITING_FOR_MATERIALS');
  });
});
