import {
  toggleArrayValue,
  toggleExclusiveValue,
  toggleIdInRecord,
  toggleIdInSet,
} from '../purchasingToggle';

describe('purchasingToggle', () => {
  it('adds then removes the same record key', () => {
    const added = toggleIdInRecord({}, 'oak', () => ({ qty: 4 }));
    expect(added.oak).toEqual({ qty: 4 });
    expect(toggleIdInRecord(added, 'oak', () => ({ qty: 9 }))).toEqual({});
  });

  it('toggles a set membership', () => {
    const once = toggleIdInSet(new Set(), 'a');
    expect([...once]).toEqual(['a']);
    expect([...toggleIdInSet(once, 'a')]).toEqual([]);
  });

  it('returns idle when the same exclusive value is pressed again', () => {
    expect(toggleExclusiveValue('SENT', 'SENT', 'ALL')).toBe('ALL');
    expect(toggleExclusiveValue('ALL', 'SENT', 'ALL')).toBe('SENT');
  });

  it('toggles array values', () => {
    expect(toggleArrayValue(['oak'], 'foam')).toEqual(['oak', 'foam']);
    expect(toggleArrayValue(['oak', 'foam'], 'oak')).toEqual(['foam']);
  });
});
