import { buildOrderLineSpecSnapshot } from '@maher/types';
import { pickRfqItemForLine } from './rfq-item-spec';
import { parseQuoteLineSpec } from './rfq-item-spec';

describe('golden-path RFQ → quote → SO snapshot', () => {
  it('copies wood, notes, and photos from quote lineSpec so accept is not RFQ-index fragile', () => {
    const spec = parseQuoteLineSpec({
      woodType: 'Beech',
      notes: 'Match showroom',
      photoDocumentIds: ['doc-a'],
      primaryImageDocumentId: 'doc-a',
    });
    const rfqItems = [
      { productId: 'p1', woodType: 'Oak' },
      { productId: 'p2', woodType: 'Walnut' },
    ];
    const wrongJoin = pickRfqItemForLine(rfqItems, { productId: 'p2' }, 0);
    const snap = buildOrderLineSpecSnapshot({
      productId: 'p2',
      productName: 'Chair',
      quantity: 1,
      woodType: spec.woodType ?? wrongJoin?.woodType,
      notes: spec.notes,
      primaryImageDocumentId: spec.primaryImageDocumentId,
      attachmentIds: spec.photoDocumentIds,
    });
    expect(snap.woodType).toBe('Beech');
    expect(snap.notes).toBe('Match showroom');
    expect(snap.primaryImageDocumentId).toBe('doc-a');
    expect(snap.attachmentIds).toEqual(['doc-a']);
  });

  it('does not mutate stored orderSpec when live catalog dims change later', () => {
    const live = { width: 220, height: 85, depth: 95, seatHeight: 45 };
    const snap = buildOrderLineSpecSnapshot({
      productId: 'p1',
      productName: 'Sofa',
      quantity: 1,
      catalog: live,
      width: 220,
    });
    live.width = 280;
    expect(snap.catalogDimensions?.width).toBe(220);
  });
});
