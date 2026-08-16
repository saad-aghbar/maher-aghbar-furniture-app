/**
 * Isolated evidence: opening a closed day / adding overtime.
 * Domain planner only — no Prisma, seed, or live calendar mutation.
 *
 * Records actual engine behavior for the dynamic-capacity audit.
 */
import { backwardSchedule, forwardSchedule } from '../schedule-planner';
import {
  STG,
  amman,
  carpentryOnly,
  ctx,
  eightHourCalendar,
  localHour,
  localYmd,
  occupancy,
  order,
  sequentialPlan,
  worker,
} from './scheduling-capacity-uat.fixtures';

const WED = '2026-08-12';
const THU = '2026-08-13';
const SUN_NEXT = '2026-08-16';
const DUE = amman(2026, 8, 20, 16, 0); // Thursday next week

const earlyOccupancy = [
  occupancy('w1', amman(2026, 8, 9, 8, 0), amman(2026, 8, 9, 16, 0), 'sun'),
  occupancy('w1', amman(2026, 8, 10, 8, 0), amman(2026, 8, 10, 16, 0), 'mon'),
  occupancy('w1', amman(2026, 8, 11, 8, 0), amman(2026, 8, 11, 16, 0), 'tue'),
];

function closedWed() {
  return eightHourCalendar({
    exceptions: [{ date: amman(2026, 8, 12, 12, 0), type: 'SHUTDOWN' }],
  });
}

function openWed() {
  return eightHourCalendar();
}

function overtimeThu() {
  return eightHourCalendar({
    exceptions: [
      {
        date: amman(2026, 8, 13, 12, 0),
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '20:00',
      },
    ],
  });
}

const workers = [worker('w1', [STG.carpentry])];

describe('calendar open-day / overtime replan (domain evidence)', () => {
  it('forward earliest-available occupies a newly opened Wednesday', () => {
    const ready = order({ id: 'po-fwd', stages: carpentryOnly(240) });
    const closed = forwardSchedule([ready], ctx(workers, { calendar: closedWed(), existingOccupancy: earlyOccupancy }));
    const opened = forwardSchedule([ready], ctx(workers, { calendar: openWed(), existingOccupancy: earlyOccupancy }));

    expect(localYmd(closed.allocations[0]!.plannedStart)).toBe(THU);
    expect(localYmd(opened.allocations[0]!.plannedStart)).toBe(WED);
    expect(opened.planningMode).toBe('FORWARD');
  });

  it('backward requested-date work stays near the due date when Wednesday opens', () => {
    const dated = order({
      id: 'po-back',
      stages: carpentryOnly(240),
      requestedDeliveryDate: DUE,
      latestCompletionTarget: DUE,
    });
    const closed = backwardSchedule([dated], ctx(workers, { calendar: closedWed(), existingOccupancy: earlyOccupancy }));
    const opened = backwardSchedule([dated], ctx(workers, { calendar: openWed(), existingOccupancy: earlyOccupancy }));

    expect(closed.planningMode).toBe('BACKWARD');
    expect(opened.planningMode).toBe('BACKWARD');
    expect(localYmd(closed.allocations[0]!.plannedStart)).toBe('2026-08-20');
    expect(localYmd(opened.allocations[0]!.plannedStart)).toBe('2026-08-20');
    expect(opened.allocations.some((a) => localYmd(a.plannedStart) === WED)).toBe(false);
  });

  it('backward only uses the opened day when the due date itself was closed', () => {
    const dueWed = amman(2026, 8, 12, 16, 0);
    const dated = order({
      id: 'po-need',
      stages: carpentryOnly(240),
      requestedDeliveryDate: dueWed,
      latestCompletionTarget: dueWed,
    });
    const closed = backwardSchedule([dated], ctx(workers, { calendar: closedWed(), existingOccupancy: earlyOccupancy }));
    const opened = backwardSchedule([dated], ctx(workers, { calendar: openWed(), existingOccupancy: earlyOccupancy }));

    expect(closed.requestedDateFeasible).toBe(false);
    expect(localYmd(closed.allocations[0]!.plannedStart)).toBe(THU);
    expect(opened.requestedDateFeasible).toBe(true);
    expect(localYmd(opened.allocations[0]!.plannedStart)).toBe(WED);
  });

  it('forward uses Thursday overtime when 08:00–16:00 is already full', () => {
    const ready = order({ id: 'po-ot-fwd', stages: carpentryOnly(240) });
    const thuFull = [
      ...earlyOccupancy,
      occupancy('w1', amman(2026, 8, 12, 8, 0), amman(2026, 8, 12, 16, 0), 'wed'),
      occupancy('w1', amman(2026, 8, 13, 8, 0), amman(2026, 8, 13, 16, 0), 'thu'),
    ];
    const noOt = forwardSchedule([ready], ctx(workers, { calendar: openWed(), existingOccupancy: thuFull }));
    const withOt = forwardSchedule([ready], ctx(workers, { calendar: overtimeThu(), existingOccupancy: thuFull }));

    expect(localYmd(noOt.allocations[0]!.plannedStart)).toBe(SUN_NEXT);
    expect(localYmd(withOt.allocations[0]!.plannedStart)).toBe(THU);
    expect(localHour(withOt.allocations[0]!.plannedStart)).toBe(16);
  });

  it('backward does not pull later due-date work into Thursday overtime', () => {
    const dated = order({
      id: 'po-ot-back',
      stages: carpentryOnly(240),
      requestedDeliveryDate: DUE,
      latestCompletionTarget: DUE,
    });
    const thuFull = [
      ...earlyOccupancy,
      occupancy('w1', amman(2026, 8, 13, 8, 0), amman(2026, 8, 13, 16, 0), 'thu'),
    ];
    const withOt = backwardSchedule([dated], ctx(workers, { calendar: overtimeThu(), existingOccupancy: thuFull }));

    expect(withOt.planningMode).toBe('BACKWARD');
    expect(localYmd(withOt.allocations[0]!.plannedStart)).toBe('2026-08-20');
    expect(withOt.allocations.some((a) => localYmd(a.plannedStart) === THU && localHour(a.plannedStart) >= 16)).toBe(
      false,
    );
  });

  it('sequential factory replan is first-wins occupancy, not a global packer', () => {
    const ready = [
      order({ id: 'po-a', stages: carpentryOnly(480) }),
      order({ id: 'po-b', stages: carpentryOnly(480) }),
      order({ id: 'po-c', stages: carpentryOnly(480) }),
    ];
    const closed = sequentialPlan(ready, ctx(workers, { calendar: closedWed(), existingOccupancy: earlyOccupancy }), 'forward');
    const opened = sequentialPlan(ready, ctx(workers, { calendar: openWed(), existingOccupancy: earlyOccupancy }), 'forward');

    expect(closed.allocations.map((a) => localYmd(a.plannedStart))).toEqual([THU, SUN_NEXT, '2026-08-17']);
    expect(opened.allocations.map((a) => localYmd(a.plannedStart))).toEqual([WED, THU, SUN_NEXT]);

    const dated = ready.map((o, i) =>
      order({
        ...o,
        id: `po-d${i}`,
        requestedDeliveryDate: DUE,
        latestCompletionTarget: DUE,
      }),
    );
    const openedBack = sequentialPlan(
      dated,
      ctx(workers, { calendar: openWed(), existingOccupancy: earlyOccupancy }),
      'backward',
    );
    expect(openedBack.allocations.some((a) => localYmd(a.plannedStart) === WED)).toBe(false);
    expect(openedBack.results.every((r) => r.planningMode === 'BACKWARD')).toBe(true);
  });

  it('backward target follows committed date when it is earlier than requested', () => {
    const requested = amman(2026, 8, 20, 16, 0);
    const committed = amman(2026, 8, 13, 16, 0);
    const dated = order({
      id: 'po-committed',
      stages: carpentryOnly(240),
      requestedDeliveryDate: requested,
      committedDeliveryDate: committed,
      latestCompletionTarget: committed,
    });
    const opened = backwardSchedule([dated], ctx(workers, { calendar: openWed(), existingOccupancy: earlyOccupancy }));
    expect(opened.planningMode).toBe('BACKWARD');
    expect(localYmd(opened.allocations[0]!.plannedEnd) <= '2026-08-13').toBe(true);
  });
});
