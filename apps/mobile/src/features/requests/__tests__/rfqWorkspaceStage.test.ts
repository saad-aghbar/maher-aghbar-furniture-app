import {
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

  it('stays on Request before a quotation exists', () => {
    expect(
      rfqStageFromData({
        hasQuote: false,
        hasOrder: false,
        status: 'SUBMITTED',
      }),
    ).toBe('request');
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

  it('does not paint later path steps as done while Needs information', () => {
    const reached = rfqPathReachedIndex({ hasQuote: false, hasOrder: false });
    expect(reached).toBe(0);
    expect(rfqPathTone('request', reached)).toBe('current');
    expect(rfqPathTone('quotation', reached)).toBe('upcoming');
    expect(rfqPathTone('accepted', reached)).toBe('upcoming');
    expect(rfqPathTone('preparing', reached)).toBe('upcoming');
    expect(rfqSegmentFilled('quotation', reached)).toBe(false);
    expect(rfqSegmentFilled('accepted', reached)).toBe(false);
    expect(rfqSegmentFilled('preparing', reached)).toBe(false);
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
});
