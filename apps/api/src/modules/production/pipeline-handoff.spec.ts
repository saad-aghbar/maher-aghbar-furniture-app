import { collectNewlyReadyTasks } from './pipeline-handoff';

describe('collectNewlyReadyTasks (DAG handoff)', () => {
  const carpentry = {
    status: 'COMPLETED',
    prereqsMet: true,
    stageDefinition: { code: 'CARPENTRY', nameEn: 'Carpentry', executionKind: 'PRODUCTION' },
    tasks: [{ id: 't-carp', status: 'COMPLETED', assignedEmployeeId: 'worker-a' }],
  };

  it('linear: completing carpentry unlocks upholstery once', () => {
    const upholsteryPending = {
      status: 'PENDING',
      prereqsMet: true,
      stageDefinition: { code: 'UPHOLSTERY', nameEn: 'Upholstery', executionKind: 'PRODUCTION' },
      tasks: [{ id: 't-uph', status: 'NOT_STARTED', assignedEmployeeId: 'worker-b' }],
    };
    const first = collectNewlyReadyTasks([carpentry, upholsteryPending]);
    expect(first.map((t) => t.id)).toEqual(['t-uph']);
    const alreadyReady = collectNewlyReadyTasks([
      carpentry,
      {
        ...upholsteryPending,
        tasks: [{ id: 't-uph', status: 'READY', assignedEmployeeId: 'worker-b' }],
      },
    ]);
    expect(alreadyReady).toEqual([]);
  });

  it('parallel A+B → C: A finishing does not ready C; B finishing does, once', () => {
    const join = {
      status: 'PENDING' as const,
      stageDefinition: { code: 'ASSEMBLY', nameEn: 'Assembly', executionKind: 'PRODUCTION' },
      tasks: [{ id: 't-c', status: 'NOT_STARTED', assignedEmployeeId: 'worker-c' }],
    };
    const afterA = collectNewlyReadyTasks([{ ...join, prereqsMet: false }]);
    expect(afterA).toEqual([]);

    const afterB = collectNewlyReadyTasks([{ ...join, prereqsMet: true }]);
    expect(afterB).toHaveLength(1);
    expect(afterB[0]?.id).toBe('t-c');

    const duplicateUnlock = collectNewlyReadyTasks([
      {
        ...join,
        prereqsMet: true,
        tasks: [{ id: 't-c', status: 'READY', assignedEmployeeId: 'worker-c' }],
      },
    ]);
    expect(duplicateUnlock).toEqual([]);
  });

  it('cancelled / blocked predecessors leave the join pending', () => {
    expect(
      collectNewlyReadyTasks([
        {
          status: 'PENDING',
          prereqsMet: false,
          stageDefinition: { code: 'PACKAGING', nameEn: 'Packaging', executionKind: 'PRODUCTION' },
          tasks: [{ id: 't-pack', status: 'NOT_STARTED', assignedEmployeeId: 'packer' }],
        },
      ]),
    ).toEqual([]);
  });
});
