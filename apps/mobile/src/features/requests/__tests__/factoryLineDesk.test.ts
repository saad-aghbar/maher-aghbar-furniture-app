import type { QuotationLine } from '@/api/modules/quotations';
import type { RequestItem } from '../types';
import {
  mergeDraftRequestSaveItems,
  quotationDraftSaveLines,
} from '../factoryLineDesk';

const quoteLine = (overrides: Partial<QuotationLine> = {}): QuotationLine => ({
  id: 'ql-1',
  description: 'Karina',
  quantity: 1,
  unitPrice: 0,
  variantId: 'var-1',
  variantSku: 'KAR-UK',
  variantLabel: 'Ukrainian',
  photoDocumentIds: ['doc-photo'],
  primaryImageDocumentId: 'doc-photo',
  lineSpec: { woodType: 'Oak', notes: 'Match showroom' },
  fabrics: [{ type: 'Linen', color: 'Sand' }],
  customMeasurements: [{ label: 'Seat', value: '45' }],
  ...overrides,
});

describe('factoryLineDesk', () => {
  it('keeps quote line ids and identity on a price save payload', () => {
    const lines = quotationDraftSaveLines([
      { id: 'ql-1', unitPrice: '1200', line: quoteLine() },
    ]);
    expect(lines[0]?.id).toBe('ql-1');
    expect(lines[0]?.unitPrice).toBe(1200);
    expect(lines[0]?.variantId).toBe('var-1');
    expect(lines[0]?.photoDocumentIds).toEqual(['doc-photo']);
    expect(lines[0]?.lineSpec).toEqual({ woodType: 'Oak', notes: 'Match showroom' });
    expect(lines[0]?.fabrics).toEqual([{ type: 'Linen', color: 'Sand' }]);
    expect(lines[0]?.customMeasurements).toEqual([{ label: 'Seat', value: '45' }]);
  });

  it('does not wipe RFQ variant photos when draft save only changes name and qty', () => {
    const existing: RequestItem[] = [
      {
        id: 'item-1',
        productName: 'Karina',
        quantity: 1,
        variantId: 'var-1',
        variantSku: 'KAR-UK',
        photoDocumentIds: ['doc-photo'],
        primaryImageDocumentId: 'doc-photo',
        options: [{ groupCode: 'DEALER_SPEC', nameEn: 'Piping', note: 'Navy' }],
      },
    ];
    const saved = mergeDraftRequestSaveItems(existing, [
      { key: 'item-1', productName: 'Karina lounge', quantity: '2', notes: 'Rush' },
    ]);
    expect(saved[0]?.productName).toBe('Karina lounge');
    expect(saved[0]?.quantity).toBe(2);
    expect(saved[0]?.variantId).toBe('var-1');
    expect(saved[0]?.photoDocumentIds).toEqual(['doc-photo']);
    expect(saved[0]?.options).toEqual([
      { groupCode: 'DEALER_SPEC', nameEn: 'Piping', note: 'Navy' },
    ]);
  });
});
