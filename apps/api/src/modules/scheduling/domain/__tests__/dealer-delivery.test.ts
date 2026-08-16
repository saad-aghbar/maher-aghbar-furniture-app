import {
  CUSTOMER_SAFE_PRODUCTION_DELAY,
  buildDealerDeliveryView,
  calendarDateForDealer,
  customerFacingFingerprint,
  datesAreCompact,
  mapCustomerDeliveryStatus,
  selectDealerNotifyTemplate,
  shouldNotifyCustomerFacing,
  summarizeDealerDeliveries,
  toCalendarYmd,
} from '../dealer-delivery';

const TZ = 'Asia/Amman';

describe('dealer-delivery mapping', () => {
  it('compact confirmed when requested = suggested = committed = projected', () => {
    const facts = {
      requestedYmd: '2026-08-25',
      suggestedYmd: '2026-08-25',
      committedYmd: '2026-08-25',
      projectedYmd: '2026-08-25',
      actualYmd: null,
      todayYmd: '2026-08-15',
      salesOrderStatus: 'CONFIRMED',
      productionOrderStatus: 'PLANNED',
    };
    const view = buildDealerDeliveryView(facts);
    expect(view.customerStatus).toBe('CONFIRMED_ON_TRACK');
    expect(view.compactDates).toBe(true);
    expect(view.calendarDate).toBe('2026-08-25');
    expect(datesAreCompact(facts)).toBe(true);
  });

  it('infeasible uncommitted is awaiting confirmation, not late or at risk', () => {
    const view = buildDealerDeliveryView({
      requestedYmd: '2026-08-20',
      suggestedYmd: '2026-08-23',
      committedYmd: null,
      projectedYmd: '2026-08-23',
      actualYmd: null,
      todayYmd: '2026-08-15',
      productionOrderStatus: 'PLANNED',
    });
    expect(view.customerStatus).toBe('AWAITING_CONFIRMATION');
    expect(view.calendarDate).toBe('2026-08-23');
    expect(view.compactDates).toBe(false);
    expect(view.customerSafeReason).toBeNull();
  });

  it('committed on track when projection matches', () => {
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: '2026-08-23',
        requestedYmd: '2026-08-23',
        suggestedYmd: '2026-08-23',
        actualYmd: null,
        todayYmd: '2026-08-20',
        productionOrderStatus: 'READY',
      }),
    ).toBe('CONFIRMED_ON_TRACK');
  });

  it('may be delayed when projection slips and today is still on/before commit', () => {
    const view = buildDealerDeliveryView({
      committedYmd: '2026-08-23',
      projectedYmd: '2026-08-25',
      requestedYmd: '2026-08-23',
      suggestedYmd: '2026-08-23',
      actualYmd: null,
      todayYmd: '2026-08-20',
      productionOrderStatus: 'IN_PROGRESS',
    });
    expect(view.customerStatus).toBe('MAY_BE_DELAYED');
    expect(view.calendarDate).toBe('2026-08-23');
    expect(view.customerSafeReason).toBe(CUSTOMER_SAFE_PRODUCTION_DELAY);
    expect(view.requiresDealerAttention).toBe(true);
  });

  it('delayed after committed day passes and not delivered', () => {
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: '2026-08-25',
        requestedYmd: '2026-08-23',
        suggestedYmd: '2026-08-23',
        actualYmd: null,
        todayYmd: '2026-08-24',
        productionOrderStatus: 'IN_PROGRESS',
      }),
    ).toBe('DELAYED');
  });

  it('recovers to on track when projection returns to commit', () => {
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: '2026-08-23',
        requestedYmd: '2026-08-23',
        suggestedYmd: '2026-08-23',
        actualYmd: null,
        todayYmd: '2026-08-20',
        productionOrderStatus: 'IN_PROGRESS',
      }),
    ).toBe('IN_PRODUCTION');
  });

  it('ready / out / delivered / cancelled use existing domain statuses', () => {
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: '2026-08-23',
        requestedYmd: null,
        suggestedYmd: null,
        actualYmd: null,
        todayYmd: '2026-08-20',
        salesOrderStatus: 'READY_FOR_DELIVERY',
      }),
    ).toBe('READY_FOR_DELIVERY');
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: '2026-08-23',
        requestedYmd: null,
        suggestedYmd: null,
        actualYmd: null,
        todayYmd: '2026-08-20',
        deliveryStatus: 'OUT_FOR_DELIVERY',
      }),
    ).toBe('OUT_FOR_DELIVERY');
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: '2026-08-23',
        requestedYmd: null,
        suggestedYmd: null,
        actualYmd: '2026-08-23',
        todayYmd: '2026-08-24',
        deliveryStatus: 'DELIVERED',
      }),
    ).toBe('DELIVERED');
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-23',
        projectedYmd: null,
        requestedYmd: null,
        suggestedYmd: null,
        actualYmd: null,
        todayYmd: '2026-08-20',
        salesOrderStatus: 'CANCELLED',
      }),
    ).toBe('CANCELLED');
  });

  it('calendar keeps committed date when projection slips', () => {
    expect(
      calendarDateForDealer({
        customerStatus: 'MAY_BE_DELAYED',
        actualYmd: null,
        committedYmd: '2026-08-23',
        suggestedYmd: '2026-08-25',
        requestedYmd: '2026-08-20',
      }),
    ).toBe('2026-08-23');
  });

  it('does not flag attention for an on-track order that can request a date change', () => {
    const view = buildDealerDeliveryView({
      committedYmd: '2026-08-25',
      projectedYmd: '2026-08-25',
      requestedYmd: '2026-08-25',
      suggestedYmd: '2026-08-25',
      actualYmd: null,
      todayYmd: '2026-08-15',
      productionOrderStatus: 'IN_PROGRESS',
      canRequestDateChange: true,
    });
    expect(view.customerStatus).toBe('IN_PRODUCTION');
    expect(view.requiresDealerAttention).toBe(false);
  });

  it('fingerprint ignores allocation-only identity and changes when projected day moves', () => {
    const base = {
      committedYmd: '2026-08-23',
      suggestedYmd: '2026-08-23',
      projectedYmd: '2026-08-23',
      customerStatus: 'IN_PRODUCTION' as const,
      actualYmd: null,
    };
    expect(customerFacingFingerprint(base)).toBe(customerFacingFingerprint({ ...base }));
    expect(customerFacingFingerprint({ ...base, projectedYmd: '2026-08-25' })).not.toBe(
      customerFacingFingerprint(base),
    );
  });

  it('toCalendarYmd uses factory timezone for Date values', () => {
    expect(toCalendarYmd(new Date('2026-08-23T21:30:00.000Z'), TZ)).toBe('2026-08-24');
    expect(toCalendarYmd('2026-08-23', TZ)).toBe('2026-08-23');
  });

  it('summary counts upcoming, this week, awaiting, delayed — not delivered/cancelled', () => {
    const summary = summarizeDealerDeliveries(
      [
        { customerStatus: 'CONFIRMED_ON_TRACK', calendarDate: '2026-08-18' },
        { customerStatus: 'AWAITING_CONFIRMATION', calendarDate: '2026-08-20' },
        { customerStatus: 'MAY_BE_DELAYED', calendarDate: '2026-08-16' },
        { customerStatus: 'DELIVERED', calendarDate: '2026-08-10' },
        { customerStatus: 'CANCELLED', calendarDate: '2026-08-19' },
      ],
      '2026-08-16',
    );
    expect(summary.upcoming).toBe(3);
    expect(summary.awaitingConfirmation).toBe(1);
    expect(summary.mayBeDelayed).toBe(1);
    expect(summary.thisWeek).toBeGreaterThan(0);
  });

  it('skips notification when fingerprint is unchanged', () => {
    expect(shouldNotifyCustomerFacing('a|b|c|IN_PRODUCTION|', 'a|b|c|IN_PRODUCTION|')).toBe(false);
    expect(shouldNotifyCustomerFacing('a|b|c|IN_PRODUCTION|', 'a|b|d|MAY_BE_DELAYED|')).toBe(true);
  });

  it('selects customer-safe templates and skips confirmed/ready duplicates', () => {
    expect(selectDealerNotifyTemplate('DELIVERED')).toBe('DELIVERY_COMPLETED');
    expect(selectDealerNotifyTemplate('MAY_BE_DELAYED')).toBe('DELIVERY_MAY_BE_DELAYED');
    expect(selectDealerNotifyTemplate('DELAYED')).toBe('DELIVERY_MAY_BE_DELAYED');
    expect(selectDealerNotifyTemplate('CONFIRMED_ON_TRACK', { alreadySentConfirmed: true })).toBeNull();
    expect(selectDealerNotifyTemplate('READY_FOR_DELIVERY')).toBeNull();
    expect(selectDealerNotifyTemplate('AWAITING_CONFIRMATION')).toBe('DELIVERY_DATE_UPDATED');
    expect(selectDealerNotifyTemplate('CANCELLED')).toBeNull();
  });
});
