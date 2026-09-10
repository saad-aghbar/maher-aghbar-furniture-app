import { returnWorkHref, selectReturnWorkCard } from '../selectReturnWorkCard';
import type { ReturnWorkOrderRow } from '@/api/modules/sales-orders';

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === 'mobile.returns.pieceCount.repair') return `${vars?.count ?? 0} repair`;
  if (key === 'mobile.returns.pieceCount.replace') return `${vars?.count ?? 0} replacement`;
  if (key === 'mobile.returns.pieceCount.scrap') return `${vars?.count ?? 0} scrap`;
  return key;
};

const row: ReturnWorkOrderRow = {
  id: 'ret-1',
  number: 'RET-1',
  kind: 'returnCase',
  lifecycleState: 'REWORKING',
  quantity: 3,
  progressPercent: 46,
  pieceSummary: { total: 3, repair: 1, replacement: 1, scrapRecovery: 1, progressPercent: 46 },
  customer: { id: 'c1', nameEn: 'Nile', code: 'NILE' },
  originalOrder: { id: 'so-1', number: 'SO-1042' },
};

describe('selectReturnCaseCard', () => {
  it('maps a return case onto the orders card model', () => {
    const card = selectReturnWorkCard(row, t);
    expect(card.kind).toBe('returnWork');
    expect(card.hasReturn).toBe(true);
    expect(card.title).toContain('RET-1');
    expect(card.title).toContain('SO-1042');
    expect(card.progressPercent).toBe(46);
    expect(card.returnSummary?.number).toBe('RET-1');
  });

  it('routes the row to the return case detail', () => {
    expect(returnWorkHref(row)).toBe('/(app)/(admin)/returns/ret-1');
  });
});
