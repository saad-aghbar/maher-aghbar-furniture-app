import { packDealerPlaceRows } from '../components/DealerPlacesDock';

describe('packDealerPlaceRows', () => {
  it('pairs consecutive tiles two-up', () => {
    expect(packDealerPlaceRows([{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }])).toEqual(
      [[{ key: 'a' }, { key: 'b' }], [{ key: 'c' }, { key: 'd' }]],
    );
  });

  it('puts a leftover tile on its own row so flex can fill the width', () => {
    expect(packDealerPlaceRows([{ key: 'a' }, { key: 'b' }, { key: 'c' }])).toEqual([
      [{ key: 'a' }, { key: 'b' }],
      [{ key: 'c' }],
    ]);
  });

  it('keeps a wide tile on its own row and does not pair the leftover after it', () => {
    expect(
      packDealerPlaceRows([
        { key: 'pay' },
        { key: 'returns' },
        { key: 'calendar', wide: true },
        { key: 'notifications' },
      ]),
    ).toEqual([
      [{ key: 'pay' }, { key: 'returns' }],
      [{ key: 'calendar', wide: true }],
      [{ key: 'notifications' }],
    ]);
  });

  it('does not pair a half tile with a following wide tile', () => {
    expect(
      packDealerPlaceRows([{ key: 'odd' }, { key: 'calendar', wide: true }]),
    ).toEqual([[{ key: 'odd' }], [{ key: 'calendar', wide: true }]]);
  });
});
