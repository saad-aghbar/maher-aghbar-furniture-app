import {
  CUSTOMER_SAFE_PRODUCTION_DELAY,
  buildDealerDeliveryView,
  calendarDateForDealer,
  committedCalendarDateIsFrozen,
  customerFacingFingerprint,
  customerFacingTuplesAgree,
  datesAreCompact,
  filterByCalendarDateRange,
  isNearingCalendarDate,
  labelTreatsDateAsConfirmed,
  mapCustomerDeliveryStatus,
  selectCustomerFacingDateTuple,
  selectDealerNotifyTemplate,
  shouldNotifyCustomerFacing,
  summarizeDealerDeliveries,
  toCalendarYmd,
} from '../dealer-delivery';

import { addDaysYmd } from '../working-calendar';

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
    expect(view.delayed).toBe(true);
    expect(view.requiresDealerAttention).toBe(false);
    expect(view.actionRequired).toBeNull();
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
        committedYmd: '2026-08-19',
        suggestedYmd: '2026-08-21',
        requestedYmd: '2026-08-18',
      }),
    ).toBe('2026-08-19');
  });

  it('does not treat factory delay as dealer action required', () => {
    const view = buildDealerDeliveryView({
      committedYmd: '2026-08-19',
      projectedYmd: '2026-08-21',
      requestedYmd: '2026-08-19',
      suggestedYmd: '2026-08-19',
      actualYmd: null,
      todayYmd: '2026-08-16',
      productionOrderStatus: 'IN_PROGRESS',
      riskStatus: 'AT_RISK',
    });
    expect(view.customerStatus).toBe('MAY_BE_DELAYED');
    expect(view.calendarDate).toBe('2026-08-19');
    expect(view.requiresDealerAttention).toBe(false);
    expect(view.actionRequired).toBeNull();
  });

  it('maps classifier LATE to DELAYED and AT_RISK to MAY_BE_DELAYED', () => {
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-10',
        projectedYmd: '2026-08-21',
        requestedYmd: '2026-08-10',
        suggestedYmd: '2026-08-10',
        actualYmd: null,
        todayYmd: '2026-08-16',
        productionOrderStatus: 'IN_PROGRESS',
        riskStatus: 'LATE',
      }),
    ).toBe('DELAYED');
    expect(
      mapCustomerDeliveryStatus({
        committedYmd: '2026-08-19',
        projectedYmd: '2026-08-21',
        requestedYmd: '2026-08-19',
        suggestedYmd: '2026-08-19',
        actualYmd: null,
        todayYmd: '2026-08-16',
        productionOrderStatus: 'IN_PROGRESS',
        riskStatus: 'AT_RISK',
      }),
    ).toBe('MAY_BE_DELAYED');
  });

  it('keeps blocked factory work commercially on-track with safe copy', () => {
    const view = buildDealerDeliveryView({
      committedYmd: '2026-08-25',
      projectedYmd: '2026-08-25',
      requestedYmd: '2026-08-25',
      suggestedYmd: '2026-08-25',
      actualYmd: null,
      todayYmd: '2026-08-16',
      productionOrderStatus: 'IN_PROGRESS',
      riskStatus: 'BLOCKED',
    });
    expect(view.customerStatus).toBe('IN_PRODUCTION');
    expect(view.delayed).toBe(false);
    expect(view.requiresDealerAttention).toBe(false);
    expect(view.customerSafeReason).toBe('Schedule being updated');
  });

  it('flags NEEDS_INFORMATION as the only dealer action CTA', () => {
    const view = buildDealerDeliveryView({
      requestedYmd: '2026-08-20',
      suggestedYmd: null,
      committedYmd: null,
      projectedYmd: null,
      actualYmd: null,
      todayYmd: '2026-08-16',
      requestStatus: 'NEEDS_INFORMATION',
    });
    expect(view.actionRequired?.code).toBe('NEEDS_INFORMATION');
    expect(view.requiresDealerAttention).toBe(true);
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

  it('freezes calendarDate on committed Aug 19 when projected slips to Aug 21', () => {
    const facts = {
      requestedYmd: '2026-08-18',
      suggestedYmd: '2026-08-19',
      committedYmd: '2026-08-19',
      projectedYmd: '2026-08-21',
      actualYmd: null,
      todayYmd: '2026-08-16',
      productionOrderStatus: 'IN_PROGRESS',
      riskStatus: 'AT_RISK' as const,
    };
    const view = buildDealerDeliveryView(facts);
    const tuple = selectCustomerFacingDateTuple(facts, view);
    expect(tuple.calendarDate).toBe('2026-08-19');
    expect(tuple.projectedYmd).toBe('2026-08-21');
    expect(committedCalendarDateIsFrozen(tuple)).toBe(true);
    expect(filterByCalendarDateRange([tuple], '2026-08-19', '2026-08-19')).toHaveLength(1);
    expect(filterByCalendarDateRange([tuple], '2026-08-21', '2026-08-21')).toHaveLength(0);
    expect(isNearingCalendarDate(tuple.calendarDate, '2026-08-16', 7)).toBe(true);
    expect(isNearingCalendarDate(tuple.projectedYmd, '2026-08-16', 7)).toBe(true);
  });

  it('groups portal/mobile Upcoming from calendarDate (overdue delayed under Today, not projected)', () => {
    const today = '2026-08-16';
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
    dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
    const weekStart = dt.toISOString().slice(0, 10);
    const weekEnd = addDaysYmd(weekStart, 6);
    const rows = [
      { id: 'overdue', calendarDate: '2026-08-10', customerStatus: 'DELAYED', projectedYmd: '2026-08-21' },
      { id: 'today', calendarDate: '2026-08-16', customerStatus: 'CONFIRMED_ON_TRACK', projectedYmd: '2026-08-16' },
      { id: 'balqis', calendarDate: '2026-08-19', customerStatus: 'READY_FOR_DELIVERY', projectedYmd: '2026-08-21' },
      { id: 'later', calendarDate: '2026-09-02', customerStatus: 'IN_PRODUCTION', projectedYmd: '2026-09-02' },
      { id: 'done', calendarDate: '2026-08-12', customerStatus: 'DELIVERED', projectedYmd: '2026-08-12' },
    ];
    const groups = { today: [] as string[], thisWeek: [] as string[], later: [] as string[] };
    for (const row of rows) {
      if (row.customerStatus === 'CANCELLED' || row.customerStatus === 'DELIVERED') continue;
      const date = row.calendarDate;
      if (date <= today) groups.today.push(row.id);
      else if (date <= weekEnd) groups.thisWeek.push(row.id);
      else groups.later.push(row.id);
    }
    expect(groups.today).toEqual(['overdue', 'today']);
    expect(groups.thisWeek).toEqual(['balqis']);
    expect(groups.later).toEqual(['later']);
    expect(groups.thisWeek).not.toContain('overdue');
  });

  it('agrees across surfaces on the same dates and rejects confirmed wording on requested', () => {
    const facts = {
      requestedYmd: '2026-08-18',
      suggestedYmd: '2026-08-19',
      committedYmd: '2026-08-19',
      projectedYmd: '2026-08-21',
      actualYmd: null,
      todayYmd: '2026-08-16',
      salesOrderStatus: 'IN_PRODUCTION',
      productionOrderStatus: 'IN_PROGRESS',
      riskStatus: 'AT_RISK' as const,
    };
    const view = buildDealerDeliveryView(facts);
    const home = selectCustomerFacingDateTuple(facts, view);
    const schedule = selectCustomerFacingDateTuple(facts, view);
    const detail = selectCustomerFacingDateTuple(facts, view);
    const portal = selectCustomerFacingDateTuple(facts, view);
    const adminCustomerFacing = selectCustomerFacingDateTuple(facts, view);
    expect(customerFacingTuplesAgree(home, schedule)).toBe(true);
    expect(customerFacingTuplesAgree(schedule, detail)).toBe(true);
    expect(customerFacingTuplesAgree(detail, portal)).toBe(true);
    expect(customerFacingTuplesAgree(portal, adminCustomerFacing)).toBe(true);
    expect(labelTreatsDateAsConfirmed('Your requested date')).toBe(false);
    expect(labelTreatsDateAsConfirmed('Expected')).toBe(false);
    expect(labelTreatsDateAsConfirmed('Confirmed delivery')).toBe(true);
    expect(labelTreatsDateAsConfirmed('تاريخ التسليم المطلوب')).toBe(false);
  });

  it('sanitizes a stale historical projection and keeps DELAYED on committed', () => {
    const facts = {
      requestedYmd: '2026-07-28',
      suggestedYmd: '2026-07-27',
      committedYmd: '2026-08-10',
      projectedYmd: '2026-07-27',
      actualYmd: null,
      todayYmd: '2026-08-16',
      productionOrderStatus: 'IN_PROGRESS',
      riskStatus: 'LATE' as const,
    };
    const view = buildDealerDeliveryView(facts);
    const tuple = selectCustomerFacingDateTuple(facts, view);
    expect(view.customerStatus).toBe('DELAYED');
    expect(view.calendarDate).toBe('2026-08-10');
    expect(view.projectedYmd).toBeNull();
    expect(view.scheduleUpdating).toBe(true);
    expect(view.customerSafeReason).toBe(CUSTOMER_SAFE_PRODUCTION_DELAY);
    expect(tuple.projectedYmd).toBeNull();
    expect(committedCalendarDateIsFrozen(tuple)).toBe(true);
    expect(filterByCalendarDateRange([tuple], '2026-08-10', '2026-08-10')).toHaveLength(1);
    expect(filterByCalendarDateRange([tuple], '2026-07-27', '2026-07-27')).toHaveLength(0);
  });

  it('places the dealer calendar on planned logistics, not production completion', () => {
    const facts = {
      requestedYmd: '2026-08-19',
      suggestedYmd: '2026-08-17',
      committedYmd: null,
      projectedYmd: '2026-08-17',
      plannedYmd: '2026-08-19',
      actualYmd: null,
      todayYmd: '2026-08-16',
      salesOrderStatus: 'READY_FOR_DELIVERY',
      productionOrderStatus: 'READY_FOR_DELIVERY',
      deliveryStatus: 'PLANNED',
    };
    const view = buildDealerDeliveryView(facts);
    const tuple = selectCustomerFacingDateTuple(facts, view);
    expect(view.customerStatus).toBe('READY_FOR_DELIVERY');
    expect(view.calendarDate).toBe('2026-08-19');
    expect(view.plannedYmd).toBe('2026-08-19');
    expect(view.projectedYmd).toBe('2026-08-17');
    expect(tuple.suggestedYmd).toBe('2026-08-17');
    expect(committedCalendarDateIsFrozen(tuple)).toBe(true);
    expect(filterByCalendarDateRange([tuple], '2026-08-19', '2026-08-19')).toHaveLength(1);
    expect(filterByCalendarDateRange([tuple], '2026-08-17', '2026-08-17')).toHaveLength(0);
  });

  it('uses actual deliveryDate when delivered', () => {
    const view = buildDealerDeliveryView({
      requestedYmd: '2026-07-18',
      suggestedYmd: '2026-07-18',
      committedYmd: '2026-07-18',
      projectedYmd: '2026-07-18',
      plannedYmd: null,
      actualYmd: '2026-07-18',
      todayYmd: '2026-08-16',
      salesOrderStatus: 'DELIVERED',
      deliveryStatus: 'DELIVERED',
    });
    expect(view.customerStatus).toBe('DELIVERED');
    expect(view.calendarDate).toBe('2026-07-18');
  });

  it('does not let production completion become the calendar day when a planned delivery exists', () => {
    expect(
      calendarDateForDealer({
        customerStatus: 'READY_FOR_DELIVERY',
        actualYmd: null,
        plannedYmd: '2026-08-19',
        committedYmd: '2026-08-21',
        suggestedYmd: '2026-08-17',
        projectedYmd: '2026-08-17',
        requestedYmd: '2026-08-19',
        todayYmd: '2026-08-16',
      }),
    ).toBe('2026-08-19');
  });
});
