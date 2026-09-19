import { describe, expect, it } from 'vitest';
import {
  isHandwrittenDocument,
  latestJobNotes,
  requestAiReadingFlags,
} from './request-ai-reading';

describe('requestAiReadingFlags', () => {
  it('flags missing important fields when a job exists', () => {
    const flags = requestAiReadingFlags({
      aiJobs: [{ fields: [] }],
      items: [
        {
          provenance: [
            { key: 'productName', ai: null, dealer: null, source: 'missing' },
            { key: 'finish', ai: null, dealer: null, source: 'missing' },
          ],
        },
      ],
    });
    expect(flags.some((f) => f.key === 'productName' && f.reason === 'missing')).toBe(true);
    expect(flags.some((f) => f.key === 'finish')).toBe(false);
  });

  it('flags sheet vs dealer mismatches and low-confidence fields', () => {
    const flags = requestAiReadingFlags({
      aiJobs: [
        {
          fields: [
            { fieldName: 'fabric', fieldValue: 'velvet?', confidence: 0.4 },
            { fieldName: 'notes', fieldValue: 'qty hard to read' },
          ],
        },
      ],
      items: [
        {
          provenance: [{ key: 'quantity', ai: '3', dealer: '2', source: 'dealer' }],
        },
      ],
    });
    expect(flags.some((f) => f.key === 'quantity' && f.reason === 'mismatch')).toBe(true);
    expect(flags.some((f) => f.key === 'fabric' && f.reason === 'unclear')).toBe(true);
    expect(
      latestJobNotes({
        aiJobs: [{ fields: [{ fieldName: 'notes', fieldValue: 'qty hard to read' }] }],
      }),
    ).toBe('qty hard to read');
  });

  it('recognizes handwritten sheet documents', () => {
    expect(isHandwrittenDocument({ category: 'HANDWRITTEN_ORDER', fileName: 'scan.jpg' })).toBe(true);
    expect(isHandwrittenDocument({ category: 'ORDER_IMAGE', fileName: 'catalog.png' })).toBe(false);
    expect(isHandwrittenDocument({ category: null, fileName: 'handwritten-sheet.pdf' })).toBe(true);
  });
});
