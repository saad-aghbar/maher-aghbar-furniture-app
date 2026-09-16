import {
  assertNoProgressLeak,
  formatWaitingOnStages,
  selectCompletedSalesOrderCards,
  selectTaskCard,
  selectTaskDetail,
  sortUrgentFirst,
  toPriorityLevel,
  workerCompletedSalesOrderHref,
} from '../selectTask';
import { completedTasksFixture, openTasksFixture, taskDetailFixture } from '../fixtures';

describe('selectTask', () => {
  it('maps list fields without progress percentages', () => {
    const card = selectTaskCard(openTasksFixture[0], 'en');
    expect(card.orderNumber).toBe('SO-DEMO-0001');
    expect(card.factoryOrderNumber).toBe('SO-DEMO-0001.A');
    expect(card.requiredWork).toBe('Cutting');
    expect(card.priority).toBe('urgent');
    expect(card.emphasize).toBe(true);
    expect(card).not.toHaveProperty('progressPercent');
    assertNoProgressLeak(card);
  });

  it('prefers Arabic stage and product names', () => {
    const card = selectTaskCard(openTasksFixture[0], 'ar');
    expect(card.requiredWork).toBe('القص');
    expect(card.productTitle).toBe('طاولة طعام');
    expect(card.orderNumber).toBe('SO-DEMO-0001');
  });

  it('shows variant labels and the factory production-order number', () => {
    const card = selectTaskCard(
      { ...openTasksFixture[0]!, variantLabel: 'Ukrainian' },
      'en',
    );
    expect(card.productTitle).toBe('Dining Table · Ukrainian');
    expect(card.variantLabel).toBe('Ukrainian');
    expect(card.orderNumber).toBe('SO-DEMO-0001');
    expect(card.factoryOrderNumber).toBe('SO-DEMO-0001.A');
  });

  it('sorts urgent before normal', () => {
    const sorted = sortUrgentFirst(
      openTasksFixture.map((item) => selectTaskCard(item, 'en')),
    );
    expect(sorted[0].id).toBe('task-urgent-1');
    expect(sorted[1].priority).toBe('medium');
  });

  it('maps detail actions and strips progress', () => {
    const vm = selectTaskDetail(taskDetailFixture, 'en');
    expect(vm.instructions).toContain('drawing');
    expect(vm.orderInstructions).toBe('Simple wrap');
    expect(vm.attachments).toHaveLength(1);
    expect(vm.canStart).toBe(false); // IN_PROGRESS
    expect(vm.canStop).toBe(true);
    expect(vm.canResume).toBe(false);
    expect(vm.canFinish).toBe(true);
    expect(vm.canUploadPhoto).toBe(true);
    expect(vm.canReportProblem).toBe(true);
    expect(vm.canCarryOver).toBe(false);
    expect(vm.isTerminal).toBe(false);
    assertNoProgressLeak(vm);
  });

  it('keeps order instructions when a variant label is present', () => {
    const vm = selectTaskDetail({ ...taskDetailFixture, variantLabel: 'Ukrainian' }, 'en');
    expect(vm.orderInstructions).toBe('Simple wrap');
    expect(vm.productTitle).toBe('Dining Table · Ukrainian');
    expect(vm.factoryOrderNumber).toBe('SO-DEMO-0001.A');
  });

  it('marks COMPLETED as terminal with dock actions off', () => {
    const vm = selectTaskDetail({ ...taskDetailFixture, status: 'COMPLETED' }, 'en');
    expect(vm.isTerminal).toBe(true);
    expect(vm.canStart).toBe(false);
    expect(vm.canStop).toBe(false);
    expect(vm.canResume).toBe(false);
    expect(vm.canFinish).toBe(false);
    expect(vm.canReportProblem).toBe(false);
    expect(vm.canUploadPhoto).toBe(false);
  });

  it('marks CANCELLED as terminal with dock actions off', () => {
    const vm = selectTaskDetail({ ...taskDetailFixture, status: 'CANCELLED' }, 'en');
    expect(vm.isTerminal).toBe(true);
    expect(vm.canFinish).toBe(false);
    expect(vm.canReportProblem).toBe(false);
    expect(vm.canUploadPhoto).toBe(false);
  });

  it('maps leftover eligibility from the task payload', () => {
    const vm = selectTaskDetail(
      {
        ...taskDetailFixture,
        canCarryOver: true,
        leftoverRemainingMinutes: 45,
        carryOverAllowsOvertime: true,
      },
      'en',
    );
    expect(vm.canCarryOver).toBe(true);
    expect(vm.leftoverRemainingMinutes).toBe(45);
    expect(vm.carryOverAllowsOvertime).toBe(true);
  });

  it('localizes detail copy for Arabic except order number', () => {
    const vm = selectTaskDetail(taskDetailFixture, 'ar');
    expect(vm.requiredWork).toBe('القص');
    expect(vm.productTitle).toBe('طاولة طعام');
    expect(vm.orderNumber).toBe('SO-DEMO-0001');
    expect(vm.instructions).toContain('طاولة طعام');
    expect(vm.orderInstructions).toBe('لف بسيط');
    expect(vm.instructions).toMatch(/اتبع|القص|المواصفات|الرسم/);
  });

  it('keeps dock actions after soft problem reports', () => {
    const vm = selectTaskDetail(
      {
        ...taskDetailFixture,
        status: 'IN_PROGRESS',
        blockers: [
          {
            id: 'b1',
            category: 'OTHER',
            reason: 'Missing hinge',
            resolvedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      'en',
    );
    expect(vm.problems).toHaveLength(1);
    expect(vm.problems[0]).toMatchObject({
      id: 'b1',
      category: 'OTHER',
      answered: false,
      reason: 'Missing hinge',
    });
    expect(vm.canStop).toBe(true);
    expect(vm.canFinish).toBe(true);
    expect(vm.canReportProblem).toBe(true);
    expect(vm.canUploadPhoto).toBe(true);
  });

  it('rejects progress leak keys', () => {
    expect(() => assertNoProgressLeak({ progressPercent: 60 })).toThrow(/Progress field/);
  });

  it('keeps worker task JSON free of progressPercent while timer percent is derived separately', () => {
    const vm = selectTaskDetail(
      {
        ...taskDetailFixture,
        status: 'IN_PROGRESS',
        timing: {
          status: 'running',
          actualMinutes: 0,
          actualSeconds: 0,
          openStartedAt: '2026-08-09T11:00:00.000Z',
          estimatedMinutes: 120,
          plannedCompletion: null,
          elapsedMinutes: 60,
        },
      },
      'en',
    );
    assertNoProgressLeak(vm);
    expect(JSON.stringify(vm)).not.toContain('progressPercent');
    expect(vm.timing.estimatedMinutes).toBe(120);
    expect(vm.timing.elapsedMinutes).toBe(60);
  });

  it('normalizes priority aliases', () => {
    expect(toPriorityLevel('NORMAL')).toBe('medium');
    expect(toPriorityLevel('URGENT')).toBe('urgent');
  });

  it('surfaces the scheduler plannedStart and today flag on cards', () => {
    const now = Date.now();
    const card = selectTaskCard(
      { ...openTasksFixture[0], plannedStart: new Date(now).toISOString() },
      'en',
    );
    expect(card.plannedStart).toBe(new Date(now).toISOString());
    expect(card.isScheduledToday).toBe(true);
  });

  it('falls back to timing.plannedStart when the flat field is absent', () => {
    const now = new Date().toISOString();
    const card = selectTaskCard(
      { ...openTasksFixture[0], plannedStart: undefined, timing: { plannedStart: now } as any },
      'en',
    );
    expect(card.plannedStart).toBe(now);
    expect(card.isScheduledToday).toBe(true);
  });

  it('is not scheduled today when plannedStart is in the past and no fallback applies', () => {
    const card = selectTaskCard(openTasksFixture[0], 'en');
    expect(card.isScheduledToday).toBe(false);
  });

  it('carries plannedStart through to the detail timing view model', () => {
    const now = new Date().toISOString();
    const vm = selectTaskDetail({ ...taskDetailFixture, plannedStart: now }, 'en');
    expect(vm.plannedStart).toBe(now);
    expect(vm.timing.plannedStart).toBe(now);
    expect(vm.isScheduledToday).toBe(true);
  });

  it('shows human stage names for waitingOn, not enum codes', () => {
    const vm = selectTaskDetail(
      {
        ...taskDetailFixture,
        status: 'NOT_STARTED',
        stageDefinition: {
          ...taskDetailFixture.stageDefinition,
          code: 'PACKAGING',
          nameEn: 'Packaging',
          dependsOnCodes: ['MATERIAL_PREP', 'CARPENTRY'],
        },
      },
      'en',
    );
    expect(vm.waitingOn).toBe('Material preparation, Carpentry');
    expect(vm.waitingOn).not.toMatch(/MATERIAL_PREP|CARPENTRY/);
    expect(vm.canStart).toBe(false);
  });

  it('localizes waitingOn stage names in Arabic and Hebrew', () => {
    const task = {
      ...taskDetailFixture,
      status: 'NOT_STARTED' as const,
      stageDefinition: {
        ...taskDetailFixture.stageDefinition,
        dependsOnCodes: ['FOAM', 'INSPECTION'],
      },
    };
    expect(selectTaskDetail(task, 'ar').waitingOn).toBe('تجهيز الإسفنج, فحص الجودة');
    expect(selectTaskDetail(task, 'he').waitingOn).toBe('הכנת ספוג, בדיקת איכות');
  });

  it('sentence-cases unknown waitingOn codes instead of leaking the enum', () => {
    expect(formatWaitingOnStages(['CUSTOM_STAGE', 'PACK'], 'en')).toBe(
      'Custom stage, Packaging',
    );
  });

  it('lists problems with open first then newest', () => {
    const vm = selectTaskDetail(
      {
        ...taskDetailFixture,
        blockers: [
          {
            id: 'old-open',
            category: 'MACHINE_PROBLEM',
            reason: 'Saw jammed',
            resolvedAt: null,
            createdAt: '2026-09-01T08:00:00.000Z',
          },
          {
            id: 'answered',
            category: 'OTHER',
            reason: 'Need glue',
            resolution: 'Use the spare tin',
            resolvedAt: '2026-09-08T10:00:00.000Z',
            createdAt: '2026-09-08T09:00:00.000Z',
            resolutionVoiceDocumentId: 'doc-ans',
          },
          {
            id: 'new-open',
            category: 'MATERIAL_MISSING',
            reason: 'No foam',
            voiceDocumentId: 'doc-v',
            resolvedAt: null,
            createdAt: '2026-09-08T11:00:00.000Z',
          },
        ],
      },
      'en',
    );
    expect(vm.problems.map((p) => p.id)).toEqual(['new-open', 'old-open', 'answered']);
    expect(vm.problems[0]).toMatchObject({
      answered: false,
      voiceDocumentId: 'doc-v',
      category: 'MATERIAL_MISSING',
    });
    expect(vm.problems[2]).toMatchObject({
      answered: true,
      resolution: 'Use the spare tin',
      resolutionVoiceDocumentId: 'doc-ans',
    });
  });

  it('groups completed tasks into sales-order boards with nested tasks', () => {
    const sibling = {
      ...completedTasksFixture[0]!,
      id: 'task-done-2',
      number: 'PT-0991',
      name: 'Packing — Sideboard',
      salesOrderId: 'so-3',
      stageDefinition: { code: 'PACK', nameEn: 'Packing' },
    };
    const other = {
      ...completedTasksFixture[0]!,
      id: 'task-done-3',
      number: 'PT-0992',
      salesOrderNumber: 'ORD-9999',
      salesOrderId: 'so-9',
      productionOrder: {
        ...completedTasksFixture[0]!.productionOrder!,
        id: 'po-999',
        number: 'PO-999',
        salesOrder: { id: 'so-9', number: 'ORD-9999' },
      },
    };
    const cards = selectCompletedSalesOrderCards(
      [{ ...completedTasksFixture[0]!, salesOrderId: 'so-3' }, sibling, other],
      'en',
    );
    expect(cards).toHaveLength(2);
    const sideboard = cards.find((card) => card.number === 'SO-DEMO-0003');
    expect(sideboard?.taskCount).toBe(2);
    expect(sideboard?.tasks.map((task) => task.id)).toEqual(['task-done-1', 'task-done-2']);
    expect(sideboard?.salesOrderId).toBe('so-3');
    expect(workerCompletedSalesOrderHref(sideboard!)).toBe(
      '/(app)/(employee)/completed-orders/so-3?number=SO-DEMO-0003',
    );
  });

  it('carries salesOrderId onto the task card model', () => {
    const card = selectTaskCard(
      { ...completedTasksFixture[0]!, salesOrderId: 'so-3' },
      'en',
    );
    expect(card.salesOrderId).toBe('so-3');
  });
});
