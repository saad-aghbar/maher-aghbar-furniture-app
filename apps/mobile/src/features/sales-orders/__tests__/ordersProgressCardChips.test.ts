import { orderProgressChipFlags } from '../ordersReturnedLens';

describe('orderProgressChipFlags', () => {
  it('shows Modified and Returned together', () => {
    expect(
      orderProgressChipFlags({
        manufacturingKind: 'modified',
        hasReturn: true,
        kind: 'order',
      }),
    ).toEqual({
      manufacturingKind: 'modified',
      returned: true,
      originKind: null,
    });
  });

  it('does not double-label return-work rows as Returned', () => {
    expect(
      orderProgressChipFlags({
        hasReturn: true,
        originKind: 'RETURN_WORK',
        kind: 'returnWork',
      }),
    ).toEqual({
      manufacturingKind: null,
      returned: false,
      originKind: 'RETURN_WORK',
    });
  });
});
