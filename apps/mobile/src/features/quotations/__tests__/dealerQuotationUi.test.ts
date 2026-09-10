import {
  dealerCanDecideQuotation,
  dealerQuoteDesk,
  dealerQuoteRailTone,
  filterDealerQuotations,
  quotationDaysLeft,
  quotationExpiryYmd,
  quotationLinkedRef,
  selectDealerQuoteHub,
} from '../dealerQuotationUi';

describe('dealerCanDecideQuotation', () => {
  it('allows decisions on SENT and VIEWED', () => {
    expect(dealerCanDecideQuotation('SENT')).toBe(true);
    expect(dealerCanDecideQuotation('VIEWED')).toBe(true);
  });

  it('hides decisions when the quotation is commercially expired', () => {
    expect(dealerCanDecideQuotation('SENT', true)).toBe(false);
    expect(dealerCanDecideQuotation('VIEWED', true)).toBe(false);
  });

  it('hides decisions on internal and terminal statuses', () => {
    expect(dealerCanDecideQuotation('APPROVED')).toBe(false);
    expect(dealerCanDecideQuotation('DRAFT')).toBe(false);
    expect(dealerCanDecideQuotation('INTERNAL_REVIEW')).toBe(false);
    expect(dealerCanDecideQuotation('ACCEPTED')).toBe(false);
    expect(dealerCanDecideQuotation('REJECTED')).toBe(false);
    expect(dealerCanDecideQuotation('REVISION_REQUESTED')).toBe(false);
  });
});

describe('dealer quote desk', () => {
  it('buckets sent/viewed as action and expired as closed', () => {
    expect(dealerQuoteDesk('SENT')).toBe('action');
    expect(dealerQuoteDesk('VIEWED')).toBe('action');
    expect(dealerQuoteDesk('SENT', true)).toBe('closed');
    expect(dealerQuoteDesk('ACCEPTED')).toBe('accepted');
    expect(dealerQuoteDesk('REJECTED')).toBe('closed');
    expect(dealerQuoteDesk('REVISION_REQUESTED')).toBe('closed');
  });

  it('filters by desk, search, and date', () => {
    const rows = [
      { id: '1', number: 'QT-1', status: 'SENT', createdAt: '2026-07-01', total: 100 },
      { id: '2', number: 'QT-2', status: 'ACCEPTED', createdAt: '2026-08-15', total: 40 },
      { id: '3', number: 'QT-9', status: 'REJECTED', createdAt: '2026-08-20', total: 10 },
    ];
    expect(filterDealerQuotations(rows, { desk: 'action' }).map((r) => r.id)).toEqual(['1']);
    expect(filterDealerQuotations(rows, { q: 'qt-9' }).map((r) => r.id)).toEqual(['3']);
    expect(
      filterDealerQuotations(
        [
          ...rows,
          {
            id: '4',
            number: 'QT-4',
            status: 'SENT',
            request: { number: 'RFQ-88', externalOrderNumber: 'DE-12' },
          },
        ],
        { q: 'de-12' },
      ).map((r) => r.id),
    ).toEqual(['4']);
    expect(
      filterDealerQuotations(rows, { dateFrom: '2026-08-01', dateTo: '2026-08-18' }).map(
        (r) => r.id,
      ),
    ).toEqual(['2']);
  });

  it('sums awaiting value on the hub', () => {
    const hub = selectDealerQuoteHub([
      { id: '1', number: 'QT-1', status: 'SENT', total: 100 },
      { id: '2', number: 'QT-2', status: 'VIEWED', total: '50.5' },
      { id: '3', number: 'QT-3', status: 'ACCEPTED', total: 9 },
      { id: '4', number: 'QT-4', status: 'REJECTED', total: 1 },
    ]);
    expect(hub.toReview).toBe(2);
    expect(hub.accepted).toBe(1);
    expect(hub.closed).toBe(1);
    expect(hub.actionValue).toBeCloseTo(150.5);
  });

  it('tones the rail by desk', () => {
    expect(dealerQuoteRailTone('SENT')).toBe('warning');
    expect(dealerQuoteRailTone('ACCEPTED')).toBe('success');
    expect(dealerQuoteRailTone('REJECTED')).toBe('error');
    expect(dealerQuoteRailTone('SENT', true)).toBe('error');
    expect(dealerQuoteRailTone('REVISION_REQUESTED')).toBe('warning');
  });

  it('reads expiry day counts and linked refs', () => {
    expect(quotationExpiryYmd('2026-09-18T12:00:00.000Z')).toBe('2026-09-18');
    expect(quotationDaysLeft('2026-09-18', new Date('2026-09-11T15:00:00'))).toBe(7);
    expect(quotationDaysLeft('2026-09-11', new Date('2026-09-11T08:00:00'))).toBe(0);
    expect(quotationDaysLeft('2026-09-10', new Date('2026-09-11'))).toBe(-1);
    expect(quotationLinkedRef({ id: '1', number: 'QT-1', status: 'SENT' })).toBeNull();
    expect(
      quotationLinkedRef({
        id: '1',
        number: 'QT-1',
        status: 'SENT',
        request: { number: 'RFQ-1', externalOrderNumber: 'DE-9' },
      }),
    ).toBe('DE-9');
  });
});
