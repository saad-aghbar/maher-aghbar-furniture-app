import { translate } from '../translate';

/** Keys used by scheduling FE surfaces — must never fall back to the raw key. */
const SCHEDULING_KEYS = [
  'mobile.adminScheduling.eyebrow',
  'mobile.adminScheduling.title',
  'mobile.adminScheduling.subtitle',
  'mobile.adminScheduling.weekStripTitle',
  'mobile.adminScheduling.monthTitle',
  'mobile.adminScheduling.dayOrdersTitle',
  'mobile.adminScheduling.dayEmpty',
  'mobile.adminScheduling.dayClosed',
  'mobile.adminScheduling.dayCapacity.edit',
  'mobile.adminScheduling.dayCapacity.title',
  'mobile.adminScheduling.dayCapacity.body',
  'mobile.adminScheduling.dayCapacity.open',
  'mobile.adminScheduling.dayCapacity.close',
  'mobile.adminScheduling.dayCapacity.addOvertime',
  'mobile.adminScheduling.dayCapacity.overtimeUntil',
  'mobile.adminScheduling.dayCapacity.clear',
  'mobile.adminScheduling.dayCapacity.normalShift',
  'mobile.adminScheduling.approvalsTitle',
  'catalog.calendar.savedReplanned',
  'catalog.calendar.workingDaysHint',
  'catalog.calendar.exceptions.title',
  'catalog.calendar.exceptions.hint',
  'catalog.calendar.exceptions.empty',
  'catalog.calendar.exceptions.date',
  'catalog.calendar.exceptions.action',
  'catalog.calendar.exceptions.open',
  'catalog.calendar.exceptions.close',
  'catalog.calendar.exceptions.overtime',
  'catalog.calendar.exceptions.overtimeUntil',
  'catalog.calendar.exceptions.apply',
  'catalog.calendar.exceptions.clear',
  'catalog.calendar.exceptions.saved',
  'catalog.calendar.exceptions.savedReplanned',
  'catalog.calendar.exceptions.cleared',
  'catalog.calendar.exceptions.clearedReplanned',
  'catalog.calendar.exceptions.dateInvalid',
  'catalog.calendar.exceptions.typeOpen',
  'catalog.calendar.exceptions.typeClosed',
  'catalog.calendar.exceptions.typeOvertime',
  'mobile.adminScheduling.approvalsEmpty',
  'mobile.adminScheduling.atRiskTitle',
  'mobile.adminScheduling.atRiskEmpty',
  'mobile.adminScheduling.errorTitle',
  'mobile.adminScheduling.errorBody',
  'mobile.adminScheduling.retry',
  'mobile.adminScheduling.plannedFor',
  'mobile.adminScheduling.materialRisk',
  'mobile.adminScheduling.conflict',
  'mobile.adminScheduling.stats.today',
  'mobile.adminScheduling.stats.week',
  'mobile.adminScheduling.stats.awaitingApproval',
  'mobile.adminScheduling.stats.atRisk',
  'mobile.adminScheduling.stats.conflicts',
  'mobile.adminScheduling.sheets.approveTitle',
  'mobile.adminScheduling.sheets.approveBody',
  'mobile.adminScheduling.sheets.approveConfirm',
  'mobile.adminScheduling.sheets.changeDateTitle',
  'mobile.adminScheduling.sheets.reasonLabel',
  'mobile.adminScheduling.sheets.reasonPlaceholder',
  'mobile.adminScheduling.sheets.saveDate',
  'mobile.adminScheduling.sheets.recalculateTitle',
  'mobile.adminScheduling.sheets.recalculateBody',
  'mobile.adminScheduling.sheets.recalculateConfirm',
  'mobile.adminScheduling.sheets.genericError',
  'mobile.calendar.prevMonth',
  'mobile.calendar.nextMonth',
  'mobile.calendar.weekdays.mo',
  'mobile.calendar.weekdays.tu',
  'mobile.calendar.weekdays.we',
  'mobile.calendar.weekdays.th',
  'mobile.calendar.weekdays.fr',
  'mobile.calendar.weekdays.sa',
  'mobile.calendar.weekdays.su',
  'mobile.calendar.legend.empty',
  'mobile.calendar.legend.light',
  'mobile.calendar.legend.half',
  'mobile.calendar.legend.busy',
  'mobile.calendar.legend.closed',
  'mobile.calendar.legend.dealer.light',
  'mobile.calendar.legend.dealer.half',
  'mobile.calendar.legend.dealer.empty',
  'mobile.calendar.legend.dealer.busy',
  'mobile.calendar.legend.dealer.closed',
  'mobile.newOrder.delivery.title',
  'mobile.newOrder.delivery.checking',
  'mobile.newOrder.delivery.checkFailed',
  'mobile.newOrder.delivery.unavailable',
  'mobile.newOrder.delivery.earliest',
  'mobile.newOrder.delivery.earliestChip',
  'mobile.newOrder.delivery.infeasible',
  'mobile.newOrder.delivery.infeasibleWithSuggestion',
  'mobile.newOrder.delivery.customDateLabel',
  'mobile.newOrder.delivery.customDateHint',
  'mobile.newOrder.delivery.selectedDate',
  'mobile.newOrder.delivery.preliminaryNote',
  'mobile.newOrder.errors.dateInvalid',
  'mobile.newOrder.review.requestedDelivery',
  'mobile.newOrder.review.estimatedDelivery',
  'mobile.orderDetail.schedule.title',
  'mobile.orderDetail.schedule.committedDate',
  'mobile.orderDetail.schedule.estimatedDate',
  'mobile.orderDetail.schedule.requestedDate',
  'mobile.orderDetail.schedule.noDateYet',
  'mobile.orderDetail.schedule.changeDate',
  'mobile.orderDetail.schedule.requestDateChange',
  'mobile.orderDetail.schedule.dateLocked',
  'mobile.orderDetail.schedule.changeDateTitle',
  'mobile.orderDetail.schedule.changeDateBody',
  'mobile.orderDetail.schedule.requestDateChangeTitle',
  'mobile.orderDetail.schedule.requestDateChangeBody',
  'mobile.orderDetail.schedule.newDateLabel',
  'mobile.orderDetail.schedule.saveDate',
  'mobile.orderDetail.schedule.sendRequest',
  'mobile.orderDetail.schedule.dateChangeFailed',
  'mobile.orderDetail.schedule.dateUpdated',
  'mobile.orderDetail.schedule.dateRequestSent',
  'mobile.dealerHome.committedDeliveryLabel',
  'mobile.productionFlow.committedDelivery',
  'mobile.adminHome.navScheduling',
  'mobile.adminHome.navSchedulingHint',
  'mobile.tasks.cardScheduled',
  'mobile.tasks.scheduledToday',
  'mobile.tasks.timerScheduledStart',
] as const;

describe('scheduling i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves all scheduling keys in ${locale}`, () => {
      for (const key of SCHEDULING_KEYS) {
        const value = translate(locale, key, { date: '1', number: 'PO-1', n: 1 });
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }

  it('formats interpolate vars for earliest + plannedFor', () => {
    expect(translate('en', 'mobile.newOrder.delivery.earliest', { date: '18 Sep' })).toBe(
      'Earliest available: 18 Sep',
    );
    expect(translate('en', 'mobile.adminScheduling.plannedFor', { date: 'Tue' })).toBe(
      'Planned for Tue',
    );
    expect(translate('en', 'mobile.adminScheduling.dayOrdersTitle', { date: '11 Aug' })).toBe(
      'Orders on 11 Aug',
    );
    expect(translate('en', 'mobile.adminScheduling.dayCapacity.title', { date: '11 Aug' })).toBe(
      'Day capacity · 11 Aug',
    );
    expect(
      translate('en', 'catalog.calendar.exceptions.typeOvertime', {
        start: '08:00',
        end: '20:00',
      }),
    ).toBe('Overtime 08:00–20:00');
    expect(translate('en', 'catalog.calendar.savedReplanned', { count: 3 })).toBe(
      'Production calendar saved. 3 orders replanned.',
    );
    expect(translate('en', 'mobile.newOrder.delivery.selectedDate', { date: '20 Sep' })).toBe(
      'Selected: 20 Sep',
    );
    expect(translate('en', 'mobile.dealerHome.committedDeliveryLabel', { date: '20 Sep' })).toBe(
      'Confirmed 20 Sep',
    );
  });
});
