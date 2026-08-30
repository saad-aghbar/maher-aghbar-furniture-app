import {
  intervalsOverlap,
  recommendWorkerBand,
  sortRecommendedWorkers,
} from './worker-recommend';

describe('worker-recommend', () => {
  const base = {
    id: 'w1',
    firstName: 'Ali',
    lastName: 'Carpenter',
    activeTaskCount: 0,
    skillMatch: true,
    hasOverlap: false,
  };

  it('recommends skilled idle worker', () => {
    const r = recommendWorkerBand(base);
    expect(r.band).toBe('recommended');
    expect(r.reasonCode).toBe('SKILL_AVAILABLE');
  });

  it('marks conflict when overlapping', () => {
    const r = recommendWorkerBand({ ...base, hasOverlap: true });
    expect(r.band).toBe('conflict');
  });

  it('marks busy when load high', () => {
    const r = recommendWorkerBand({ ...base, activeTaskCount: 5 });
    expect(r.band).toBe('busy');
  });

  it('sorts recommended before conflict', () => {
    const sorted = sortRecommendedWorkers([
      recommendWorkerBand({ ...base, id: 'c', hasOverlap: true }),
      recommendWorkerBand({ ...base, id: 'a', activeTaskCount: 0 }),
      recommendWorkerBand({ ...base, id: 'b', activeTaskCount: 4 }),
    ]);
    expect(sorted.map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('intervalsOverlap treats edge-touch as non-overlap', () => {
    const a0 = new Date('2026-09-01T08:00:00Z');
    const a1 = new Date('2026-09-01T12:00:00Z');
    const b0 = new Date('2026-09-01T12:00:00Z');
    const b1 = new Date('2026-09-01T16:00:00Z');
    expect(intervalsOverlap(a0, a1, b0, b1)).toBe(false);
    expect(intervalsOverlap(a0, a1, new Date('2026-09-01T11:00:00Z'), b1)).toBe(true);
  });
});
