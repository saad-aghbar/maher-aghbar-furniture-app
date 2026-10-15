import { splitDriverHomeDeliveries } from '../driverHomeDeliveries';

describe('splitDriverHomeDeliveries', () => {
  it('keeps a ready delivery out of the planned waiting row', () => {
    const split = splitDriverHomeDeliveries([
      { number: 'DLV-SHELF-PLAN', status: 'PLANNED' },
      { number: 'DLV-2026-00010', status: 'READY' },
    ]);
    expect(split.ready.map((row) => row.number)).toEqual(['DLV-2026-00010']);
    expect(split.waiting.map((row) => row.number)).toEqual(['DLV-SHELF-PLAN']);
  });

  it('does not offer a planned delivery as ready when it is listed first', () => {
    const split = splitDriverHomeDeliveries([
      { number: 'DLV-SHELF-PLAN', status: 'PLANNED' },
    ]);
    expect(split.ready).toEqual([]);
    expect(split.waiting).toHaveLength(1);
  });
});
