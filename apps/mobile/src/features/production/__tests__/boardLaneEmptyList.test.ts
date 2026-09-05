import { boardCountForBucket, productionListItemsForBoard } from '../boardLaneList';

describe('board lane empty list contract', () => {
  const counts = {
    needsSetup: 0,
    readyToStart: 1,
    onFloor: 0,
    blocked: 0,
    inspectionPackaging: 0,
  };

  it('Quality & Pack at 0 never keeps Ready rows as placeholder', () => {
    expect(boardCountForBucket('inspection_packaging', counts)).toBe(0);
    expect(
      productionListItemsForBoard({
        isPlaceholderData: true,
        selectedLaneCount: 0,
        flattened: [{ id: 'ready-po' }],
      }),
    ).toEqual([]);
    expect(
      productionListItemsForBoard({
        isPlaceholderData: false,
        selectedLaneCount: 0,
        flattened: [{ id: 'ready-po' }],
      }),
    ).toEqual([]);
  });

  it('Ready for Factory at 1 shows its rows once data is real', () => {
    expect(boardCountForBucket('ready_to_start', counts)).toBe(1);
    expect(
      productionListItemsForBoard({
        isPlaceholderData: false,
        selectedLaneCount: 1,
        flattened: [{ id: 'ready-po' }],
      }),
    ).toEqual([{ id: 'ready-po' }]);
  });
});
