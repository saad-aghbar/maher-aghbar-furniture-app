import {
  assertNoProgressLeak,
  selectTaskCard,
  selectTaskDetail,
  sortUrgentFirst,
  toPriorityLevel,
} from '../selectTask';
import { openTasksFixture, taskDetailFixture } from '../fixtures';

describe('selectTask', () => {
  it('maps list fields without progress percentages', () => {
    const card = selectTaskCard(openTasksFixture[0], 'en');
    expect(card.orderNumber).toBe('ORD-1256');
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
    expect(card.orderNumber).toBe('ORD-1256');
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
    expect(vm.attachments).toHaveLength(1);
    expect(vm.canStart).toBe(false); // IN_PROGRESS
    expect(vm.canStop).toBe(true);
    expect(vm.canResume).toBe(false);
    expect(vm.canFinish).toBe(true);
    expect(vm.canUploadPhoto).toBe(true);
    expect(vm.canReportProblem).toBe(true);
    assertNoProgressLeak(vm);
  });

  it('localizes detail copy for Arabic except order number', () => {
    const vm = selectTaskDetail(taskDetailFixture, 'ar');
    expect(vm.requiredWork).toBe('القص');
    expect(vm.productTitle).toBe('طاولة طعام');
    expect(vm.orderNumber).toBe('ORD-1256');
    expect(vm.instructions).toContain('طاولة طعام');
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
    expect(vm.openBlockers).toHaveLength(1);
    expect(vm.canStop).toBe(true);
    expect(vm.canFinish).toBe(true);
    expect(vm.canReportProblem).toBe(true);
    expect(vm.canUploadPhoto).toBe(true);
  });

  it('rejects progress leak keys', () => {
    expect(() => assertNoProgressLeak({ progressPercent: 60 })).toThrow(/Progress field/);
  });

  it('normalizes priority aliases', () => {
    expect(toPriorityLevel('NORMAL')).toBe('medium');
    expect(toPriorityLevel('URGENT')).toBe('urgent');
  });
});
