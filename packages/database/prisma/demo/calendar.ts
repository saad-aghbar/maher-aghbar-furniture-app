import { Prisma, PrismaClient } from '@prisma/client';
import { ymd } from './clock';

const DEFAULT_WORKING_WEEKDAYS = [0, 1, 2, 3, 4, 6];

export async function seedDemoCalendar(prisma: PrismaClient) {
  const calendar = await prisma.factoryCalendar.create({
    data: {
      name: 'Amman factory',
      timezone: 'Asia/Amman',
      workingWeekdays: DEFAULT_WORKING_WEEKDAYS,
      shiftStart: '08:00',
      shiftEnd: '16:00',
      deliveryBufferWorkingDays: 1,
      breaks: [{ start: '12:00', end: '13:00' }] as unknown as Prisma.InputJsonValue,
      overtimeConfig: { eveningEnd: '20:00' } as unknown as Prisma.InputJsonValue,
      isDefault: true,
    },
  });

  const exceptions: Array<{ date: Date; type: 'SHUTDOWN' | 'EXTRA_SHIFT'; note: string; shiftStart?: string; shiftEnd?: string }> =
    [
      { date: ymd(2026, 6, 25), type: 'SHUTDOWN', note: 'Eid al-Adha factory shutdown' },
      { date: ymd(2026, 7, 22), type: 'EXTRA_SHIFT', note: 'Sectional catch-up evening', shiftStart: '16:00', shiftEnd: '20:00' },
      { date: ymd(2026, 8, 5), type: 'EXTRA_SHIFT', note: 'Hotel banquettes overtime', shiftStart: '16:00', shiftEnd: '20:00' },
      { date: ymd(2026, 8, 12), type: 'EXTRA_SHIFT', note: 'August load evening', shiftStart: '16:00', shiftEnd: '20:00' },
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
