import {
  matchesPendingReturns,
  matchingManagementTiles,
  pendingReturnsWhere,
} from './return-counts';

describe('return dashboard counts', () => {
  it('counts a return at most once across the pendingReturns OR', () => {
    const overlapping = {
      approvalStatus: 'PENDING',
      physicalStatus: 'WAITING_RETURN',
      inventoryFate: 'PENDING',
    };
    expect(matchesPendingReturns(overlapping)).toBe(true);
    expect(pendingReturnsWhere.OR).toHaveLength(3);
  });

  it('keeps the three management tiles non-exclusive', () => {
    const overlapping = {
      approvalStatus: 'NEED_INFO',
      physicalStatus: 'WAITING_RETURN',
      inventoryFate: 'PENDING',
    };
    expect(matchingManagementTiles(overlapping)).toEqual(['approvalOpen', 'waitingReturn']);

    const inspect = {
      approvalStatus: 'APPROVED',
      physicalStatus: 'INSPECTING',
      inventoryFate: 'PENDING',
    };
    expect(matchingManagementTiles(inspect)).toEqual(['waitingInspection']);
    expect(matchesPendingReturns(inspect)).toBe(true);
  });
});
