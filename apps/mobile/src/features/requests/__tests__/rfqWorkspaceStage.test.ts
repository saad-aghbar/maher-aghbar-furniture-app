import {
  parseRfqWorkspaceStage,
  rfqPathTone,
  rfqReachedIndex,
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
});

describe('rfq path honest to backend', () => {
  it('does not paint Accepted / Order / Preparing as reached while Quoted', () => {
    const reached = rfqReachedIndex({ hasQuote: true, hasOrder: false });
    expect(reached).toBe(1);
    expect(rfqPathTone('request', reached)).toBe('done');
    expect(rfqPathTone('quotation', reached)).toBe('current');
    expect(rfqPathTone('order', reached)).toBe('upcoming');
    expect(rfqSegmentFilled('request', reached)).toBe(true);
    expect(rfqSegmentFilled('quotation', reached)).toBe(true);
    expect(rfqSegmentFilled('order', reached)).toBe(false);
  });

  it('does not fill later segments from visiting a tab', () => {
    const reached = rfqReachedIndex({ hasQuote: false, hasOrder: false });
    expect(rfqSegmentFilled('quotation', reached)).toBe(false);
    expect(rfqSegmentFilled('order', reached)).toBe(false);
  });
});
