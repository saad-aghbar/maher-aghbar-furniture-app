import { emptyOrderLine } from '../newOrderLine';
import {
  NEW_ORDER_STAGE_RAIL_MAX,
  applyLineAttachmentsToBasket,
  attachmentsForLine,
  newOrderBasketColumns,
  pairBasketRows,
  replaceLineAttachments,
  resolveRequestDealerPo,
  seedLineDealerPo,
} from '../newOrderItemsLayout';
import type { PendingAttachment } from '../pendingAttachment';

function file(partial: Partial<PendingAttachment>): PendingAttachment {
  return {
    id: 'a1',
    uri: 'file://x.jpg',
    fileName: 'x.jpg',
    mimeType: 'image/jpeg',
    category: 'ORDER_IMAGE',
    kind: 'gallery',
    status: 'uploaded',
    progress: 1,
    ...partial,
  };
}

describe('newOrderItemsLayout', () => {
  it('stacks basket tickets on phone and packs two-up on desk', () => {
    expect(newOrderBasketColumns(false)).toBe(1);
    expect(newOrderBasketColumns(true)).toBe(2);
    expect(pairBasketRows(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
    expect(pairBasketRows(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('caps the stage rail so it does not stretch across iPad', () => {
    expect(NEW_ORDER_STAGE_RAIL_MAX).toBe(360);
    expect(NEW_ORDER_STAGE_RAIL_MAX).toBeLessThan(768);
  });

  it('keeps attachments on the selected basket item', () => {
    const sofa = file({ id: 's', lineId: 'line-sofa', documentId: 'doc-s' });
    const bed = file({ id: 'b', lineId: 'line-bed', documentId: 'doc-b' });
    expect(attachmentsForLine([sofa, bed], 'line-sofa')).toEqual([sofa]);
    const next = replaceLineAttachments([sofa, bed], 'line-sofa', [
      file({ id: 's2', uri: 'file://y.jpg' }),
    ]);
    expect(next.map((row) => row.lineId)).toEqual(['line-bed', 'line-sofa']);
    expect(next.find((row) => row.id === 's2')?.lineId).toBe('line-sofa');
  });

  it('uses the first filled item order number as the request PO', () => {
    const a = emptyOrderLine({ externalOrderNumber: '' });
    const b = emptyOrderLine({ externalOrderNumber: 'PO-9' });
    expect(resolveRequestDealerPo([a, b], 'FALLBACK')).toBe('PO-9');
    expect(resolveRequestDealerPo([a], 'FALLBACK')).toBe('FALLBACK');
    const seeded = seedLineDealerPo([a], 'PO-1');
    expect(seeded[0]?.externalOrderNumber).toBe('PO-1');
  });

  it('copies uploaded item files onto the basket line', () => {
    const line = emptyOrderLine({ id: 'line-sofa' });
    const next = applyLineAttachmentsToBasket(
      [line],
      [file({ lineId: 'line-sofa', documentId: 'doc-1' })],
    );
    expect(next[0]?.photoDocumentIds).toEqual(['doc-1']);
  });
});
