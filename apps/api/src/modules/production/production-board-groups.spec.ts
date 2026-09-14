import {
  assembleProductionBoards,
  countUniqueBoardKeys,
  orderedUniqueGroupKeys,
  paginateGroupKeys,
  productionBoardGroupKey,
  splitBoardGroupKeys,
} from './production-board-groups';

describe('production board groups', () => {
  it('groups SALES_ORDER POs by salesOrderId and keeps orphans as singletons', () => {
    expect(
      productionBoardGroupKey({
        id: 'po-1',
        salesOrderId: 'so-nile',
        originType: 'SALES_ORDER',
      }),
    ).toBe('so-nile');
    expect(
      productionBoardGroupKey({
        id: 'po-orphan',
        salesOrderId: null,
        originType: 'SALES_ORDER',
      }),
    ).toBe('po:po-orphan');
    expect(
      productionBoardGroupKey({
        id: 'po-rw',
        salesOrderId: 'so-nile',
        originType: 'RETURN_WORK',
      }),
    ).toBe('po:po-rw');
  });

  it('paginates unique parent keys in first-seen order', () => {
    const keys = orderedUniqueGroupKeys([
      { id: 'po-a', salesOrderId: 'so-1', originType: 'SALES_ORDER' },
      { id: 'po-b', salesOrderId: 'so-1', originType: 'SALES_ORDER' },
      { id: 'po-c', salesOrderId: 'so-2', originType: 'SALES_ORDER' },
      { id: 'po-d', salesOrderId: null, originType: 'INTERNAL' },
    ]);
    expect(keys).toEqual(['so-1', 'so-2', 'po:po-d']);
    expect(paginateGroupKeys(keys, 1, 2)).toEqual(['so-1', 'so-2']);
    expect(paginateGroupKeys(keys, 2, 2)).toEqual(['po:po-d']);
    expect(countUniqueBoardKeys([
      { id: 'po-a', salesOrderId: 'so-1', originType: 'SALES_ORDER' },
      { id: 'po-b', salesOrderId: 'so-1', originType: 'SALES_ORDER' },
    ])).toBe(1);
  });

  it('splits page keys into sibling SO loads vs orphan ids', () => {
    expect(splitBoardGroupKeys(['so-1', 'po:po-x', 'so-2'])).toEqual({
      salesOrderIds: ['so-1', 'so-2'],
      orphanPoIds: ['po-x'],
    });
  });

  it('assembles sibling rows onto the paginated parent keys', () => {
    const boards = assembleProductionBoards(
      ['so-1'],
      [
        { id: 'po-std', salesOrderId: 'so-1', originType: 'SALES_ORDER' },
        { id: 'po-custom', salesOrderId: 'so-1', originType: 'SALES_ORDER' },
        { id: 'po-other', salesOrderId: 'so-2', originType: 'SALES_ORDER' },
      ],
    );
    expect(boards).toHaveLength(1);
    expect(boards[0]?.items.map((i) => i.id)).toEqual(['po-std', 'po-custom']);
  });
});
