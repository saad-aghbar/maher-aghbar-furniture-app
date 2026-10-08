import { Prisma, PrismaClient } from '@prisma/client';
import { daysAgo, ymd } from './clock';

const DEFAULT_WORKING_WEEKDAYS = [0, 1, 2, 3, 4, 6];

/** Amman civil date, shifted off Friday (factory closed). Negative = upcoming. */
function civilNotFriday(daysBeforeAsOf: number): Date {
  for (let step = 0; step < 6; step += 1) {
    const probe = daysAgo(daysBeforeAsOf - step, 12, 0);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Amman',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(probe);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    const date = ymd(year, month, day);
    if (date.getUTCDay() !== 5) return date;
  }
  return ymd(2026, 1, 1);
}

export async function seedDemoCalendar(prisma: PrismaClient) {
  const calendar = await prisma.factoryCalendar.create({
    data: {
      name: 'Amman factory',
      timezone: 'Asia/Amman',
      workingWeekdays: DEFAULT_WORKING_WEEKDAYS,
      shiftStart: '08:00',
      shiftEnd: '16:00',
      deliveryBufferWorkingDays: 1,
      maxProductionEarlyWorkingDays: 10,
      targetFactoryUtilizationPercent: 85,
      breaks: [{ start: '12:00', end: '12:30' }] as unknown as Prisma.InputJsonValue,
      overtimeConfig: { eveningEnd: '20:00' } as unknown as Prisma.InputJsonValue,
      isDefault: true,
    },
  });

  const exceptions: Array<{ date: Date; type: 'SHUTDOWN' | 'EXTRA_SHIFT'; note: string; shiftStart?: string; shiftEnd?: string }> =
    [
      { date: civilNotFriday(12), type: 'SHUTDOWN', note: 'Mid-month factory shutdown' },
      { date: civilNotFriday(6), type: 'EXTRA_SHIFT', note: 'Sectional catch-up evening', shiftStart: '16:00', shiftEnd: '20:00' },
      { date: civilNotFriday(2), type: 'EXTRA_SHIFT', note: 'Hotel banquettes overtime', shiftStart: '16:00', shiftEnd: '20:00' },
      { date: civilNotFriday(-3), type: 'EXTRA_SHIFT', note: 'Forward load evening', shiftStart: '16:00', shiftEnd: '20:00' },
    ];

  for (const ex of exceptions) {
    await prisma.factoryCalendarException.create({
      data: {
        calendarId: calendar.id,
        date: ex.date,
        type: ex.type,
        shiftStart: ex.shiftStart,
        shiftEnd: ex.shiftEnd,
        note: ex.note,
      },
    });
  }

  return calendar;
}
