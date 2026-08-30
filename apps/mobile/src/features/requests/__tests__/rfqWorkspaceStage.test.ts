import {
  isRfqWaitingForReview,
  parseRfqWorkspaceStage,
  rfqIncompleteGaps,
  rfqPathReachedIndex,
  rfqPathTone,
  rfqSegmentFilled,
  rfqStageFromData,
} from '../rfqWorkspaceStage';

describe('parseRfqWorkspaceStage', () => {
  it('accepts known stages and ignores leftovers', () => {
    expect(parseRfqWorkspaceStage('quotation')).toBe('quotation');
    expect(parseRfqWorkspaceStage(['order'])).toBe('order');
    expect(parseRfqWorkspaceStage(undefined)).toBeUndefined();
    expect(parseRfqWorkspaceStage('preparing')).toBeUndefined();
  });
});

describe('rfqStageFromData', () => {
  it('selects Quotation when the record is Quoted', () => {
    expect(
      rfqStageFromData({ hasQuote: true, hasOrder: false, status: 'QUOTED' }),
    ).toBe('quotation');
    expect(
      rfqStageFromData({ hasQuote: false, hasOrder: false, status: 'QUOTED' }),
    ).toBe('quotation');
  });

  it('selects Order only when a sales order exists', () => {
    expect(
      rfqStageFromData({ hasQuote: true, hasOrder: true, status: 'QUOTED' }),
    ).toBe('order');
  });

  it('keeps Submitted / waiting-for-review on Request — does not invent a quote', () => {
    expect(
      rfqStageFromData({
        hasQuote: false,
        hasOrder: false,
        status: 'SUBMITTED',
      }),
    ).toBe('request');
    expect(isRfqWaitingForReview('SUBMITTED')).toBe(true);
    expect(isRfqWaitingForReview('UNDER_REVIEW')).toBe(false);
  });

  it('keeps Needs information on Request — does not invent a quote', () => {
    expect(
      rfqStageFromData({
        hasQuote: false,
        hasOrder: false,
        status: 'NEEDS_INFORMATION',
      }),
    ).toBe('request');
  });
});

describe('rfq path honest to backend', () => {
  it('does not paint Accepted / Preparing as reached while Quoted', () => {
    const reached = rfqPathReachedIndex({ hasQuote: true, hasOrder: false });
    expect(reached).toBe(1);
    expect(rfqPathTone('request', reached)).toBe('done');
    expect(rfqPathTone('quotation', reached)).toBe('current');
    expect(rfqPathTone('accepted', reached)).toBe('upcoming');
    expect(rfqPathTone('preparing', reached)).toBe('upcoming');
    expect(rfqSegmentFilled('accepted', reached)).toBe(false);
    expect(rfqSegmentFilled('preparing', reached)).toBe(false);
  });

  it('does not paint later path steps as done while waiting for review', () => {
    const reached = rfqPathReachedIndex({ hasQuote: false, hasOrder: false });
    expect(rfqPathTone('accepted', reached)).toBe('upcoming');
    expect(rfqPathTone('preparing', reached)).toBe('upcoming');
    expect(rfqSegmentFilled('quotation', reached)).toBe(false);
  });
});

describe('rfqIncompleteGaps', () => {
  it('lists missing attachments and end-customer honestly', () => {
    expect(
      rfqIncompleteGaps({
        documents: [],
        deliveryAddress: '12 Main',
        endCustomerName: '  ',
      }),
    ).toEqual(['attachments', 'endCustomer']);
  });

  it('flags custom or modified lines without inventing quote rows', () => {
    expect(
      rfqIncompleteGaps({
        documents: [{ id: 'd1' }],
        deliveryAddress: 'Ramallah',
        endCustomerName: 'Omar',
        items: [{ productId: null, customMeasurements: [{ label: 'Seat', value: '42' }] }],
      }),
    ).toEqual(['customLines']);
  });
});
