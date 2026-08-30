import { translate, translatePlural } from '../translate';

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
  'mobile.adminScheduling.replan.recalculating',
  'mobile.adminScheduling.replan.updated',
  'mobile.adminScheduling.replan.nothingToMove',
  'mobile.adminScheduling.replan.ordersMoved',
  'mobile.adminScheduling.replan.atRiskRecovered',
  'mobile.adminScheduling.replan.needsAttention',
  'mobile.adminScheduling.replan.failed',
  'mobile.adminScheduling.replan.pinnedClosedDay',
  'mobile.adminScheduling.replan.pinnedClosedDayBody',
  'mobile.adminScheduling.replan.review',
  'mobile.adminScheduling.dayCapacity.edit',
  'mobile.adminScheduling.dayCapacity.title',
  'mobile.adminScheduling.dayCapacity.body',
  'mobile.adminScheduling.dayCapacity.open',
  'mobile.adminScheduling.dayCapacity.close',
  'mobile.adminScheduling.dayCapacity.addOvertime',
  'mobile.adminScheduling.dayCapacity.overtimeUntil',
  'mobile.adminScheduling.dayCapacity.overtimeEarlier',
  'mobile.adminScheduling.dayCapacity.overtimeLater',
  'mobile.adminScheduling.dayCapacity.overtimeExtra',
  'mobile.adminScheduling.dayCapacity.statusOpen',
  'mobile.adminScheduling.dayCapacity.statusClosed',
  'mobile.adminScheduling.dayCapacity.clear',
  'mobile.adminScheduling.dayCapacity.normalShift',
  'mobile.adminScheduling.dayCapacity.workingDay',
  'mobile.adminScheduling.dayCapacity.shiftStart',
  'mobile.adminScheduling.dayCapacity.shiftEnd',
  'mobile.adminScheduling.duration.minutes',
  'mobile.adminScheduling.duration.minutesZero',
  'mobile.adminScheduling.duration.minutesOne',
  'mobile.adminScheduling.duration.minutesTwo',
  'mobile.adminScheduling.duration.minutesFew',
  'mobile.adminScheduling.duration.minutesMany',
  'mobile.adminScheduling.duration.hours',
  'mobile.adminScheduling.duration.hoursZero',
  'mobile.adminScheduling.duration.hoursOne',
  'mobile.adminScheduling.duration.hoursTwo',
  'mobile.adminScheduling.duration.hoursFew',
  'mobile.adminScheduling.duration.hoursMany',
  'mobile.adminScheduling.duration.hoursAndMinutes',
  'mobile.adminScheduling.qtyZero',
  'mobile.adminScheduling.qtyOne',
  'mobile.adminScheduling.qtyTwo',
  'mobile.adminScheduling.qtyFew',
  'mobile.adminScheduling.qtyMany',
  'mobile.adminScheduling.viewAllOrders',
  'mobile.adminScheduling.viewAllOrdersZero',
  'mobile.adminScheduling.viewAllOrdersOne',
  'mobile.adminScheduling.viewAllOrdersTwo',
  'mobile.adminScheduling.viewAllOrdersFew',
  'mobile.adminScheduling.viewAllOrdersMany',
  'mobile.adminScheduling.showFewerOrders',
  'mobile.adminScheduling.approvalsTitle',
  'catalog.calendar.savedReplanned',
  'catalog.calendar.recalculating',
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
  'catalog.calendar.exceptions.recalculating',
  'catalog.calendar.exceptions.clearedRecalculating',
  'catalog.calendar.exceptions.dateInvalid',
  'catalog.calendar.exceptions.typeOpen',
  'catalog.calendar.exceptions.typeClosed',
  'catalog.calendar.exceptions.typeOvertime',
  'mobile.adminScheduling.approvalsEmpty',
  'mobile.adminScheduling.atRiskTitle',
  'mobile.adminScheduling.atRiskEmpty',
  'mobile.adminScheduling.conflictsTitle',
  'mobile.adminScheduling.conflictsEmpty',
  'mobile.adminScheduling.weekOrdersTitle',
  'mobile.adminScheduling.weekOrdersEmpty',
  'mobile.adminScheduling.clearFocus',
  'mobile.adminScheduling.scrollForMore',
  'mobile.adminScheduling.searchPlaceholder',
  'mobile.adminScheduling.searchEmpty',
  'mobile.adminScheduling.focusFilter.today',
  'mobile.adminScheduling.focusFilter.week',
  'mobile.adminScheduling.focusFilter.awaitingApproval',
  'mobile.adminScheduling.focusFilter.atRisk',
  'mobile.adminScheduling.focusFilter.conflicts',
  'mobile.adminScheduling.errorTitle',
  'mobile.adminScheduling.errorBody',
  'mobile.adminScheduling.retry',
  'mobile.adminScheduling.plannedFor',
  'mobile.adminScheduling.plannedWindow',
  'mobile.adminScheduling.requiredBy',
  'mobile.adminScheduling.suggestedBy',
  'mobile.adminScheduling.qty',
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
  'mobile.adminScheduling.sheets.approveSuccess',
  'mobile.adminScheduling.sheets.changeDateSuccess',
  'mobile.adminScheduling.sheets.recalculateSuccess',
  'mobile.adminScheduling.sheets.approveAll',
  'mobile.adminScheduling.sheets.approveAllTitle',
  'mobile.adminScheduling.sheets.approveAllBody',
  'mobile.adminScheduling.sheets.approveAllBodyZero',
  'mobile.adminScheduling.sheets.approveAllBodyOne',
  'mobile.adminScheduling.sheets.approveAllBodyTwo',
  'mobile.adminScheduling.sheets.approveAllBodyFew',
  'mobile.adminScheduling.sheets.approveAllBodyMany',
  'mobile.adminScheduling.sheets.approveAllConfirm',
  'mobile.adminScheduling.sheets.approveAllSuccess',
  'mobile.adminScheduling.sheets.approveAllSuccessZero',
  'mobile.adminScheduling.sheets.approveAllSuccessOne',
  'mobile.adminScheduling.sheets.approveAllSuccessTwo',
  'mobile.adminScheduling.sheets.approveAllSuccessFew',
  'mobile.adminScheduling.sheets.approveAllSuccessMany',
  'mobile.adminScheduling.sheets.approveAllPartial',
  'mobile.adminScheduling.sheets.approveAllFailed',
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
  'mobile.newOrder.delivery.confirmAfterCheck',
  'mobile.orders.modeOrders',
  'mobile.orders.modeUpcoming',
  'mobile.orders.modeCalendar',
  'mobile.orders.groupToday',
  'mobile.orders.groupThisWeek',
  'mobile.tabs.schedule',
  'mobile.orders.legendExpected',
  'mobile.orders.legendConfirmed',
  'mobile.orders.legendMayBeDelayed',
  'mobile.orders.legendDelivered',
  'mobile.orders.notConfirmed',
  'mobile.orders.scheduleUpdating',
  'mobile.orders.emptyDayTitle',
  'mobile.orders.emptyDayBody',
  'mobile.orders.a11yDay',
  'mobile.orders.expectedShort',
  'mobile.orders.requestedShort',
  'mobile.orders.confirmedShort',
  'mobile.orders.currentExpected',
  'mobile.orders.plannedShort',
  'mobile.orderDetail.schedule.projectedDate',
  'mobile.orderDetail.schedule.expectedDate',
  'mobile.orderDetail.schedule.actualDate',
  'production.dealerDelivery.requested',
  'production.dealerDelivery.expected',
  'production.dealerDelivery.confirmed',
  'production.dealerDelivery.currentExpected',
  'production.dealerDelivery.planned',
  'production.dealerDelivery.notConfirmed',
  'production.dealerDelivery.modeUpcoming',
  'production.dealerDelivery.modeCalendar',
  'catalog.preferredDeliveryDate',
  'catalog.preferredDeliveryDateHint',
  'mobile.orders.modeCalendar',
  'mobile.dealerAccount.placeCalendarHint',
  'mobile.dealerAccount.calendarTitle',
  'mobile.dealerAccount.calendarSubtitle',
  'mobile.dealerAccount.calendarFocusHint',
  'mobile.dealerAccount.calendarShowDay',
  'mobile.dealerAccount.calendarToday',
  'mobile.dealerAccount.calendarMonthTitle',
  'mobile.orders.deliveryEyebrow',
  'mobile.orders.deliverySubtitle',
  'mobile.orders.deliveryFocusHint',
  'mobile.orders.rfqSectionHint',
  'mobile.orders.summaryUpcoming',
  'mobile.orders.summaryThisWeek',
  'mobile.orders.summaryAwaiting',
  'mobile.orders.summaryDelayed',
  'mobile.orders.groupAttention',
  'mobile.orders.groupToday',
  'mobile.orders.groupThisWeek',
  'mobile.orders.groupUpcoming',
  'mobile.orders.groupLater',
  'mobile.orders.groupDelivered',
  'mobile.orders.filterAll',
  'mobile.orders.filterUpcoming',
  'mobile.orders.filterAttention',
  'mobile.orders.filterDelivered',
  'mobile.orders.emptyDeliveriesTitle',
  'mobile.orders.emptyDeliveriesBody',
  'mobile.orders.compactOnTrack',
  'mobile.orders.newDateProposed',
  'mobile.orders.earliestAvailable',
  'mobile.orders.productionDelay',
  'mobile.orderDetail.schedule.compactOnTrack',
  'mobile.orderDetail.schedule.timelineTitle',
  'mobile.orderDetail.schedule.timelineReceived',
  'mobile.orderDetail.schedule.timelineDelivered',
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
  'mobile.adminScheduling.capacity.title',
  'mobile.adminScheduling.capacity.subtitle',
  'mobile.adminScheduling.capacity.day',
  'mobile.adminScheduling.capacity.week',
  'mobile.adminScheduling.capacity.today',
  'mobile.adminScheduling.capacity.previousDay',
  'mobile.adminScheduling.capacity.nextDay',
  'mobile.adminScheduling.capacity.pickDate',
  'mobile.adminScheduling.capacity.eligibleWorkers',
  'mobile.adminScheduling.capacity.eligibleWorkersZero',
  'mobile.adminScheduling.capacity.eligibleWorkersOne',
  'mobile.adminScheduling.capacity.eligibleWorkersTwo',
  'mobile.adminScheduling.capacity.eligibleWorkersFew',
  'mobile.adminScheduling.capacity.eligibleWorkersMany',
  'mobile.adminScheduling.capacity.available',
  'mobile.adminScheduling.capacity.allocated',
  'mobile.adminScheduling.capacity.remaining',
  'mobile.adminScheduling.capacity.utilization',
  'mobile.adminScheduling.capacity.hours',
  'mobile.adminScheduling.capacity.hoursOf',
  'mobile.adminScheduling.capacity.hoursOfA11y',
  'mobile.adminScheduling.capacity.percent',
  'mobile.adminScheduling.capacity.state.available',
  'mobile.adminScheduling.capacity.state.moderate',
  'mobile.adminScheduling.capacity.state.nearCapacity',
  'mobile.adminScheduling.capacity.state.full',
  'mobile.adminScheduling.capacity.state.unavailable',
  'mobile.adminScheduling.capacity.state.noEligibleWorkers',
  'mobile.adminScheduling.capacity.state.schedulingBlocked',
  'mobile.adminScheduling.capacity.state.closed',
  'mobile.adminScheduling.capacity.emptyScheduled',
  'mobile.adminScheduling.capacity.emptyClosed',
  'mobile.adminScheduling.capacity.emptyNoWorkers',
  'mobile.adminScheduling.capacity.loadErrorTitle',
  'mobile.adminScheduling.capacity.loadErrorBody',
  'mobile.adminScheduling.capacity.retry',
  'mobile.adminScheduling.capacity.updating',
  'mobile.adminScheduling.capacity.a11yCard',
  'mobile.adminScheduling.capacity.a11yBlocked',
  'mobile.adminScheduling.capacity.a11yFull',
  'mobile.adminScheduling.capacity.a11yClosed',
  'mobile.adminScheduling.capacity.a11yPrevDay',
  'mobile.adminScheduling.capacity.a11yNextDay',
  'mobile.adminScheduling.capacity.weekClosed',
  'mobile.adminScheduling.capacity.weekA11yDay',
  'mobile.adminScheduling.capacity.weekA11yClosed',
  'mobile.adminScheduling.capacity.detailTitle',
  'mobile.adminScheduling.capacity.detailWorkersHeading',
  'mobile.adminScheduling.capacity.detailNoWorkers',
  'mobile.adminScheduling.capacity.detailIneligibleHeading',
  'mobile.adminScheduling.capacity.detailIneligibleCaption',
  'mobile.adminScheduling.capacity.detailUnassignedHeading',
  'mobile.adminScheduling.capacity.detailUnassignedCaption',
  'mobile.adminScheduling.capacity.workerHours',
  'mobile.adminScheduling.capacity.workerAllocatedOnly',
  'mobile.adminScheduling.capacity.workerAvailable',
  'mobile.adminScheduling.capacity.workerFull',
  'mobile.adminScheduling.capacity.bottleneck',
  'mobile.adminScheduling.capacity.bottleneckValue',
  'mobile.adminScheduling.capacity.a11yBottleneck',
  'mobile.adminScheduling.capacity.bottleneckHeading',
  'mobile.adminScheduling.capacity.bottleneckHeadingZero',
  'mobile.adminScheduling.capacity.bottleneckHeadingOne',
  'mobile.adminScheduling.capacity.bottleneckHeadingTwo',
  'mobile.adminScheduling.capacity.bottleneckHeadingFew',
  'mobile.adminScheduling.capacity.bottleneckHeadingMany',
  'mobile.adminScheduling.capacity.a11yBottlenecks',
  'mobile.adminScheduling.capacity.loadHelpTitle',
  'mobile.adminScheduling.capacity.loadHelpBody',
  'mobile.adminScheduling.capacity.loadHelpA11y',
  'mobile.adminScheduling.capacity.needsAttention',
  'mobile.adminScheduling.capacity.forSelectedDay',
  'mobile.adminScheduling.capacity.viewWorkers',
  'mobile.adminScheduling.capacity.viewAllStages',
  'mobile.adminScheduling.capacity.viewAllStagesZero',
  'mobile.adminScheduling.capacity.viewAllStagesOne',
  'mobile.adminScheduling.capacity.viewAllStagesTwo',
  'mobile.adminScheduling.capacity.viewAllStagesFew',
  'mobile.adminScheduling.capacity.viewAllStagesMany',
  'mobile.adminScheduling.capacity.showFewerStages',
  'mobile.adminScheduling.dayDetail.title',
  'mobile.adminScheduling.dayDetail.factoryLoad',
  'mobile.adminScheduling.dayDetail.ordersScheduled',
  'mobile.adminScheduling.dayDetail.atRisk',
  'mobile.adminScheduling.dayDetail.conflicts',
  'mobile.adminScheduling.dayDetail.capacityByStage',
  'mobile.adminScheduling.dayDetail.noOrders',
  'mobile.adminScheduling.dayDetail.a11yLoad',
  'mobile.adminScheduling.dates.requested',
  'mobile.adminScheduling.dates.suggested',
  'mobile.adminScheduling.dates.committed',
  'mobile.adminScheduling.dates.earliestFeasible',
  'mobile.adminScheduling.dates.projectedCompletion',
  'mobile.adminScheduling.dates.notApproved',
  'mobile.adminScheduling.dates.feasible',
  'mobile.adminScheduling.dates.infeasibleTitle',
  'mobile.adminScheduling.dates.dealerRequested',
  'mobile.adminScheduling.dates.reviewSchedule',
  'mobile.adminScheduling.dates.identicalHint',
  'mobile.adminScheduling.dates.onTrack',
  'mobile.adminScheduling.dates.delivery',
  'mobile.adminScheduling.dates.requestedFeasible',
  'mobile.adminScheduling.dates.earliestAvailable',
  'mobile.adminScheduling.dates.schedulingMode',
  'mobile.adminScheduling.dates.productionDeadline',
  'mobile.adminScheduling.dates.plannedProduction',
  'mobile.adminScheduling.dates.deliveryPreparation',
  'mobile.adminScheduling.dates.deliveryPreparationZero',
  'mobile.adminScheduling.dates.deliveryPreparationOne',
  'mobile.adminScheduling.dates.deliveryPreparationTwo',
  'mobile.adminScheduling.dates.deliveryPreparationFew',
  'mobile.adminScheduling.dates.deliveryPreparationMany',
  'mobile.adminScheduling.dates.daysLater',
  'mobile.adminScheduling.dates.daysLaterZero',
  'mobile.adminScheduling.dates.daysLaterOne',
  'mobile.adminScheduling.dates.daysLaterTwo',
  'mobile.adminScheduling.dates.daysLaterFew',
  'mobile.adminScheduling.dates.daysLaterMany',
  'mobile.adminScheduling.blocked.title',
  'mobile.adminScheduling.blocked.noEligibleWorkers',
  'mobile.adminScheduling.blocked.materials',
  'mobile.adminScheduling.blocked.wip',
  'mobile.adminScheduling.blocked.estimateReview',
  'mobile.adminScheduling.blocked.generic',
  'mobile.adminScheduling.blocked.expectedReady',
  'mobile.adminScheduling.blocked.expectedReadyUnknown',
  'mobile.adminScheduling.reasons.noEligibleWorker',
  'mobile.adminScheduling.reasons.materialNotReady',
  'mobile.adminScheduling.reasons.wipNotReady',
  'mobile.adminScheduling.reasons.capacity',
  'mobile.adminScheduling.reasons.overlap',
  'mobile.adminScheduling.reasons.closedDay',
  'mobile.adminScheduling.reasons.skill',
  'mobile.adminScheduling.reasons.unknown',
  'mobile.adminScheduling.reasons.estimateReview',
  'mobile.adminScheduling.atRisk.due',
  'mobile.adminScheduling.atRisk.projected',
  'mobile.adminScheduling.atRisk.noProjected',
  'mobile.adminScheduling.atRisk.caption',
  'mobile.adminScheduling.atRisk.statusLate',
  'mobile.adminScheduling.atRisk.statusMayBeLate',
  'mobile.adminScheduling.atRisk.promised',
  'mobile.adminScheduling.atRisk.reason',
  'mobile.adminScheduling.atRisk.recommendedAction',
  'mobile.adminScheduling.atRisk.daysLate',
  'mobile.adminScheduling.atRisk.daysLateZero',
  'mobile.adminScheduling.atRisk.daysLateOne',
  'mobile.adminScheduling.atRisk.daysLateTwo',
  'mobile.adminScheduling.atRisk.daysLateFew',
  'mobile.adminScheduling.atRisk.daysLateMany',
  'mobile.adminScheduling.atRisk.helpTitle',
  'mobile.adminScheduling.atRisk.helpBody',
  'mobile.adminScheduling.atRisk.a11yCard',
  'mobile.adminScheduling.atRisk.resolveAll',
  'mobile.adminScheduling.atRisk.resolveAllTitle',
  'mobile.adminScheduling.atRisk.resolveAllBody',
  'mobile.adminScheduling.atRisk.resolvedAutomatically',
  'mobile.adminScheduling.atRisk.stillNeedsAttention',
  'mobile.adminScheduling.atRisk.alreadyOnTrack',
  'mobile.adminScheduling.atRisk.reviewEstimates',
  'mobile.adminScheduling.atRisk.viewProduction',
  'mobile.adminScheduling.atRisk.manageWorkers',
  'mobile.adminScheduling.atRisk.reviewCommitment',
  'mobile.adminScheduling.atRisk.viewMaterials',
  'mobile.adminScheduling.atRisk.committedCannotBeMet',
  'mobile.adminScheduling.atRisk.requestedCannotBeMet',
  'mobile.adminScheduling.atRisk.requiredWip',
  'mobile.adminScheduling.atRisk.producedBy',
  'mobile.adminScheduling.atRisk.currentStage',
  'mobile.adminScheduling.atRisk.missingMaterial',
  'mobile.adminScheduling.atRisk.stageAtCapacity',
  'mobile.adminScheduling.atRisk.earliestSlot',
  'mobile.adminScheduling.atRisk.recalculateUnchanged',
  'mobile.adminScheduling.atRisk.done',
  'mobile.adminScheduling.atRisk.remainingReason',
  'mobile.adminScheduling.atRisk.remainingReasonZero',
  'mobile.adminScheduling.atRisk.remainingReasonOne',
  'mobile.adminScheduling.atRisk.remainingReasonTwo',
  'mobile.adminScheduling.atRisk.remainingReasonFew',
  'mobile.adminScheduling.atRisk.remainingReasonMany',
  'mobile.adminScheduling.atRisk.resolveAllNeedsAdmin',
  'mobile.adminScheduling.atRisk.remainingCount',
  'mobile.adminScheduling.atRisk.remainingCountZero',
  'mobile.adminScheduling.atRisk.remainingCountOne',
  'mobile.adminScheduling.atRisk.remainingCountTwo',
  'mobile.adminScheduling.atRisk.remainingCountFew',
  'mobile.adminScheduling.atRisk.remainingCountMany',
  'mobile.adminScheduling.atRisk.resolveAllClearBody',
  'mobile.adminScheduling.atRisk.resolveAllStatusClear',
  'mobile.adminScheduling.atRisk.resolveAllReasonsTitle',
  'mobile.adminScheduling.conflicts.workerOverlap',
  'mobile.adminScheduling.conflicts.emptyDetail',
  'mobile.adminScheduling.conflicts.caption',
  'mobile.adminScheduling.conflicts.typeOverlap',
  'mobile.adminScheduling.conflicts.typeResource',
  'mobile.adminScheduling.conflicts.typeSkill',
  'mobile.adminScheduling.conflicts.typeClosed',
  'mobile.adminScheduling.conflicts.typeInactive',
  'mobile.adminScheduling.conflicts.typeLocked',
  'mobile.adminScheduling.conflicts.when',
  'mobile.adminScheduling.conflicts.overlap',
  'mobile.adminScheduling.conflicts.overlapWindow',
  'mobile.adminScheduling.conflicts.overlapDuration',
  'mobile.adminScheduling.conflicts.review',
  'mobile.adminScheduling.conflicts.suggestedResolution',
  'mobile.adminScheduling.conflicts.reassigned',
  'mobile.adminScheduling.conflicts.rescheduled',
  'mobile.adminScheduling.conflicts.movedTo',
  'mobile.adminScheduling.conflicts.reassignedTo',
  'mobile.adminScheduling.conflicts.resolveFailedAuto',
  'mobile.adminScheduling.conflicts.noAlternativeWorker',
  'mobile.adminScheduling.conflicts.noAvailableTime',
  'mobile.adminScheduling.conflicts.bothLocked',
  'mobile.adminScheduling.conflicts.inProgressNoWorker',
  'mobile.adminScheduling.conflicts.wouldMissCommitment',
  'mobile.adminScheduling.conflicts.sameDayAllowed',
  'mobile.adminScheduling.conflicts.helpTitle',
  'mobile.adminScheduling.conflicts.helpBody',
  'mobile.adminScheduling.conflicts.helpConflict',
  'mobile.adminScheduling.conflicts.helpAtRisk',
  'mobile.adminScheduling.conflicts.helpFull',
  'mobile.adminScheduling.conflicts.helpPriority',
  'mobile.adminScheduling.conflicts.twoTasksSameTime',
  'mobile.adminScheduling.conflicts.taskOne',
  'mobile.adminScheduling.conflicts.taskTwo',
  'mobile.adminScheduling.conflicts.affectingOrders',
  'mobile.adminScheduling.conflicts.affectingOrdersZero',
  'mobile.adminScheduling.conflicts.affectingOrdersOne',
  'mobile.adminScheduling.conflicts.affectingOrdersTwo',
  'mobile.adminScheduling.conflicts.affectingOrdersFew',
  'mobile.adminScheduling.conflicts.affectingOrdersMany',
  'mobile.adminScheduling.conflicts.ordersTitle',
  'mobile.adminScheduling.conflicts.ordersCaption',
  'mobile.adminScheduling.conflicts.ordersEmpty',
  'mobile.adminScheduling.conflicts.overlapTitle',
  'mobile.adminScheduling.conflicts.overlapEmpty',
  'mobile.adminScheduling.conflicts.bookedTwice',
  'mobile.adminScheduling.conflicts.viewAllOverlaps',
  'mobile.adminScheduling.conflicts.viewAllOverlapsZero',
  'mobile.adminScheduling.conflicts.viewAllOverlapsOne',
  'mobile.adminScheduling.conflicts.viewAllOverlapsTwo',
  'mobile.adminScheduling.conflicts.viewAllOverlapsFew',
  'mobile.adminScheduling.conflicts.viewAllOverlapsMany',
  'mobile.adminScheduling.conflicts.showFewerOverlaps',
  'mobile.adminScheduling.conflicts.resolve',
  'mobile.adminScheduling.conflicts.resolveAll',
  'mobile.adminScheduling.conflicts.resolveTitle',
  'mobile.adminScheduling.conflicts.resolveBody',
  'mobile.adminScheduling.conflicts.resolveOrderBody',
  'mobile.adminScheduling.conflicts.resolveAllBody',
  'mobile.adminScheduling.conflicts.resolveAllBodyZero',
  'mobile.adminScheduling.conflicts.resolveAllBodyOne',
  'mobile.adminScheduling.conflicts.resolveAllBodyTwo',
  'mobile.adminScheduling.conflicts.resolveAllBodyFew',
  'mobile.adminScheduling.conflicts.resolveAllBodyMany',
  'mobile.adminScheduling.conflicts.resolveAllOrdersBody',
  'mobile.adminScheduling.conflicts.resolveAllOrdersBodyZero',
  'mobile.adminScheduling.conflicts.resolveAllOrdersBodyOne',
  'mobile.adminScheduling.conflicts.resolveAllOrdersBodyTwo',
  'mobile.adminScheduling.conflicts.resolveAllOrdersBodyFew',
  'mobile.adminScheduling.conflicts.resolveAllOrdersBodyMany',
  'mobile.adminScheduling.conflicts.resolveConfirm',
  'mobile.adminScheduling.conflicts.resolveSuccess',
  'mobile.adminScheduling.conflicts.resolveSuccessMoved',
  'mobile.adminScheduling.conflicts.resolveSuccessReassigned',
  'mobile.adminScheduling.conflicts.alreadyResolved',
  'mobile.adminScheduling.conflicts.resolvePartial',
  'mobile.adminScheduling.conflicts.resolveFailed',
  'mobile.adminScheduling.conflicts.resolveNoTargets',
  'mobile.production.priority.LOW',
  'mobile.production.priority.NORMAL',
  'mobile.production.priority.HIGH',
  'mobile.production.priority.URGENT',
  'mobile.adminScheduling.orderStrip.title',
  'mobile.adminScheduling.orderStrip.viewOnBoard',
  'statuses.LATE',
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

  it('does not label requested or expected dates as confirmed', () => {
    const keys = [
      'production.dealerDelivery.requested',
      'production.dealerDelivery.expected',
      'production.dealerDelivery.earliest',
      'catalog.preferredDeliveryDate',
      'mobile.orderDetail.schedule.requestedDate',
      'mobile.orderDetail.schedule.expectedDate',
      'mobile.orders.expectedShort',
      'mobile.orders.requestedShort',
      'mobile.orders.plannedShort',
      'production.dealerDelivery.planned',
    ];
    for (const locale of ['en', 'ar', 'he'] as const) {
      for (const key of keys) {
        expect(translate(locale, key)).not.toMatch(/confirm|مؤكد|מאושר/i);
      }
    }
    expect(translate('en', 'production.dealerDelivery.confirmed')).toMatch(/confirm/i);
    expect(translate('ar', 'production.dealerDelivery.confirmed')).toMatch(/مؤكد/);
    expect(translate('he', 'production.dealerDelivery.confirmed')).toMatch(/מאושר/);
  });

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

  it('formats capacity interpolation vars', () => {
    expect(
      translate('en', 'mobile.adminScheduling.capacity.eligibleWorkers', { count: 4 }),
    ).toBe('4 eligible workers');
    expect(translate('en', 'mobile.adminScheduling.capacity.hours', { hours: 8 })).toBe('8h');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.percent', { percent: 75 }),
    ).toBe('75%');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.hoursOf', {
        allocated: 24,
        available: 32,
      }),
    ).toBe('24h / 32h');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.hoursOfA11y', {
        allocated: 14,
        available: 7.5,
      }),
    ).toBe('14 hours of 7.5 hours');
    expect(
      translate('ar', 'mobile.adminScheduling.capacity.hoursOf', {
        allocated: 0,
        available: 7,
      }),
    ).toBe('0 س / 7 س');
    expect(
      translate('ar', 'mobile.adminScheduling.capacity.hoursOfA11y', {
        allocated: 14,
        available: 7.5,
      }),
    ).toBe('14 ساعة من أصل 7.5 ساعة');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.a11yCard', {
        name: 'Carpentry',
        percent: 75,
        hours: 8,
      }),
    ).toBe('Carpentry, 75 percent utilized, 8 hours remaining');
    expect(
      translate('en', 'mobile.adminScheduling.dayDetail.title', { date: '11 Aug' }),
    ).toBe('11 Aug');
    expect(
      translate('en', 'mobile.adminScheduling.blocked.noEligibleWorkers', { name: 'Painting' }),
    ).toBe('Painting has no eligible workers.');
    expect(
      translate('en', 'mobile.adminScheduling.atRisk.due', { date: '20 Sep' }),
    ).toBe('Due 20 Sep');
    expect(
      translate('en', 'mobile.adminScheduling.atRisk.projected', { date: '22 Sep' }),
    ).toBe('Projected 22 Sep');
    expect(
      translate('en', 'mobile.adminScheduling.atRisk.a11yCard', {
        number: 'PO-2026-00055',
        status: 'May be late',
        projected: 'September 1',
        committed: 'August 30',
        reason: 'Upholstery capacity',
      }),
    ).toBe(
      'Order PO-2026-00055, May be late, projected September 1, committed August 30, reason Upholstery capacity.',
    );
    expect(translatePlural('en', 'mobile.adminScheduling.atRisk.daysLate', 3)).toBe('3 days late');
    expect(translatePlural('ar', 'mobile.adminScheduling.atRisk.daysLate', 1)).toBe(
      'متأخرة يوماً واحداً',
    );
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.workerOverlap', { name: 'Ali' }),
    ).toBe('Ali has overlapping work');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.workerHours', {
        allocated: 4,
        available: 7,
      }),
    ).toBe('4h / 7h allocated');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.workerAllocatedOnly', { hours: '4.8h' }),
    ).toBe('4.8h allocated');
    expect(
      translate('ar', 'mobile.adminScheduling.capacity.workerAllocatedOnly', { hours: '4.8 س' }),
    ).toBe('4.8 س محجوزة');
    expect(
      translate('he', 'mobile.adminScheduling.capacity.workerAllocatedOnly', { hours: '4.8ש׳' }),
    ).toBe('4.8ש׳ הוקצו');
    expect(
      translate('en', 'mobile.adminScheduling.capacity.bottleneckValue', {
        name: 'Inspection',
        state: 'Full',
      }),
    ).toBe('Inspection · Full');
    expect(translatePlural('en', 'mobile.adminScheduling.capacity.bottleneckHeading', 1)).toBe(
      'Bottleneck',
    );
    expect(translatePlural('en', 'mobile.adminScheduling.capacity.bottleneckHeading', 3)).toBe(
      'Bottlenecks',
    );
    expect(translatePlural('ar', 'mobile.adminScheduling.capacity.bottleneckHeading', 2)).toBe(
      'عنقا الزجاجة',
    );
    expect(
      translate('en', 'mobile.adminScheduling.capacity.a11yBottlenecks', {
        names: 'Inspection · Full, Assembly · Near capacity',
      }),
    ).toBe('Bottlenecks: Inspection · Full, Assembly · Near capacity');
    expect(
      translate('en', 'mobile.adminScheduling.blocked.expectedReady', { date: '18 Aug' }),
    ).toBe('Expected ready: 18 Aug');
    expect(
      translate('en', 'mobile.adminScheduling.sheets.approveAllPartial', { ok: 2, fail: 1 }),
    ).toBe('2 approved, 1 could not be approved.');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.resolveBody', { name: 'Ali' }),
    ).toBe('Move the lower-priority task so Ali is no longer double-booked?');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.resolveOrderBody', { number: 'PO-2026-00036' }),
    ).toBe('Resolve the overlap on PO-2026-00036?');
    expect(translatePlural('en', 'mobile.adminScheduling.conflicts.resolveAllOrdersBody', 3)).toBe(
      'Resolve overlaps affecting 3 orders?',
    );
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.movedTo', {
        number: 'PO-1057',
        range: '13:00–16:00',
      }),
    ).toBe('PO-1057 moved to 13:00–16:00');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.wouldMissCommitment', { number: 'PO-1057' }),
    ).toBe('Resolving this conflict will put PO-1057 at risk.');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.affectingOrders', {
        conflicts: 3,
        orders: 5,
      }),
    ).toBe('3 conflicts · affecting 5 production orders');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.overlapDuration', {
        hours: 1,
        minutes: 30,
      }),
    ).toBe('1h 30m');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.overlapWindow', {
        start: '11:30',
        end: '13:00',
      }),
    ).toBe('11:30–13:00');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.resolveSuccessMoved', {
        number: 'PO-1057',
        range: '13:00–16:00',
      }),
    ).toBe('PO-1057 moved to 13:00–16:00.');
    expect(
      translate('en', 'mobile.adminScheduling.conflicts.resolveSuccessReassigned', {
        number: 'PO-1057',
        name: 'Omar Haddad',
      }),
    ).toBe('PO-1057 reassigned to Omar Haddad.');
    expect(translatePlural('en', 'mobile.adminScheduling.conflicts.viewAllOverlaps', 35)).toBe(
      'View all 35 overlaps',
    );
    expect(translatePlural('en', 'mobile.adminScheduling.capacity.viewAllStages', 1)).toBe(
      'View 1 stage',
    );
    expect(translatePlural('en', 'mobile.adminScheduling.viewAllOrders', 4)).toBe(
      'View all 4 orders',
    );
    expect(translatePlural('ar', 'mobile.adminScheduling.dates.daysLater', 1)).toBe('بعد يوم واحد');
    expect(translatePlural('ar', 'mobile.adminScheduling.dates.daysLater', 2)).toBe('بعد يومين');
    expect(translatePlural('ar', 'mobile.adminScheduling.dates.daysLater', 5)).toBe('بعد 5 أيام');
    expect(translatePlural('ar', 'mobile.adminScheduling.duration.minutes', 1)).toBe('دقيقة واحدة');
    expect(translatePlural('ar', 'mobile.adminScheduling.duration.hours', 2)).toBe('ساعتان');
    expect(
      translate('ar', 'mobile.adminScheduling.duration.hoursAndMinutes', {
        hours: 'ساعتان',
        minutes: '33 دقيقة',
      }),
    ).toBe('ساعتان و33 دقيقة');
    expect(translate('ar', 'mobile.adminScheduling.conflicts.typeOverlap')).not.toMatch(
      /WORKER_OVERLAP|AVAILABLE|NEAR_CAPACITY/,
    );
    expect(translate('ar', 'mobile.adminScheduling.capacity.state.nearCapacity')).not.toMatch(
      /NEAR_CAPACITY|nearCapacity/,
    );
  });

  it('humanizes admin load legend labels (not all-caps leftovers)', () => {
    expect(translate('en', 'mobile.calendar.legend.empty')).toBe('Empty');
    expect(translate('en', 'mobile.calendar.legend.light')).toBe('Light');
    expect(translate('en', 'mobile.calendar.legend.half')).toBe('Half');
    expect(translate('en', 'mobile.calendar.legend.busy')).toBe('Busy');
    expect(translate('en', 'mobile.calendar.legend.closed')).toBe('Closed');
    expect(translate('ar', 'mobile.calendar.legend.empty')).toBe('فارغ');
    expect(translate('ar', 'mobile.calendar.legend.light')).toBe('خفيف');
    expect(translate('ar', 'mobile.calendar.legend.half')).toBe('متوسط');
    expect(translate('ar', 'mobile.calendar.legend.busy')).toBe('مزدحم');
    expect(translate('ar', 'mobile.calendar.legend.closed')).toBe('مغلق');
  });
});
