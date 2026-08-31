import {
  classifyPersistIssue,
  computeDayLoadLayers,
  loadPercentPersistClass,
  MANUAL_CONTROL_INVARIANT,
  summarizeDayImpact,
} from '../manual-control';

describe('manual control invariant helpers', () => {
  it('treats 110% and 120% load as warnings, not hard blocks', () => {
    expect(loadPercentPersistClass(110)).toBe('warning');
    expect(loadPercentPersistClass(120)).toBe('warning');
    expect(loadPercentPersistClass(100)).toBe('allowed');
    expect(classifyPersistIssue('OVER_100_PERCENT')).toBe('warning');
    expect(classifyPersistIssue('PREDECESSOR_NOT_COMPLETE')).toBe('hard_block');
    expect(classifyPersistIssue('INVALID_TIME_RANGE')).toBe('hard_block');
    expect(classifyPersistIssue('FACTORY_CLOSED_EXECUTION')).toBe('hard_block');
    expect(classifyPersistIssue('MANDATORY_SKILL')).toBe('hard_block');
  });

  it('keeps load layers separate (normal vs target vs planned)', () => {
    const layers = computeDayLoadLayers({
      date: '2026-09-23',
      isWorking: true,
      normalCapacityMinutes: 480,
      targetLoadPercent: 120,
      plannedMinutes: 576,
    });
    expect(layers.normalCapacityMinutes).toBe(480);
    expect(layers.targetLoadPercent).toBe(120);
    expect(layers.targetCapacityMinutes).toBe(576);
    expect(layers.plannedMinutes).toBe(576);
    expect(layers.factoryLoadPercent).toBe(120);
  });

  it('summarizes close-day impact without implying a move', () => {
    const impact = summarizeDayImpact([
      { allocationId: 'a1', productionOrderId: 'po-1', employeeId: 'w1', committedDeliveryDate: '2026-09-30' },
      { allocationId: 'a2', productionOrderId: 'po-1', employeeId: 'w1', committedDeliveryDate: '2026-09-30' },
      { allocationId: 'a3', productionOrderId: 'po-2', employeeId: 'w2', committedDeliveryDate: null },
    ]);
    expect(impact.taskCount).toBe(3);
    expect(impact.orderCount).toBe(2);
    expect(impact.workerCount).toBe(2);
    expect(impact.committedDeliveryCount).toBe(1);
  });

  it('exports the locked invariant sentence', () => {
    expect(MANUAL_CONTROL_INVARIANT).toContain('WITHOUT EXPLICIT AUTHORIZED HUMAN ACTION');
  });
});
