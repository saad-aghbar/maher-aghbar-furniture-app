import { resolveHourlyRate, versionHourlyRate } from './labor-rate';

describe('versionHourlyRate', () => {
  it('closes the open row and inserts a new rate', async () => {
    const existing = { id: 'r1', hourlyRate: 20 };
    const prisma = {
      laborRate: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue({ id: 'r2' }),
      },
    };
    await versionHourlyRate(prisma, { userId: 'u1', hourlyRate: 35, actorId: 'admin' });
    expect(prisma.laborRate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: { effectiveTo: expect.any(Date) },
      }),
    );
    expect(prisma.laborRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', hourlyRate: 35 }),
      }),
    );
  });

  it('closes the open row when the rate is cleared', async () => {
    const prisma = {
      laborRate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', hourlyRate: 20 }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    };
    await versionHourlyRate(prisma, { userId: 'u1', hourlyRate: 0 });
    expect(prisma.laborRate.update).toHaveBeenCalled();
    expect(prisma.laborRate.create).not.toHaveBeenCalled();
  });

  it('does not rewrite when the rate is unchanged', async () => {
    const prisma = {
      laborRate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', hourlyRate: 20 }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    await versionHourlyRate(prisma, { userId: 'u1', hourlyRate: 20 });
    expect(prisma.laborRate.update).not.toHaveBeenCalled();
    expect(prisma.laborRate.create).not.toHaveBeenCalled();
  });
});

describe('resolveHourlyRate', () => {
  it('prefers a closed historical user rate for past work', () => {
    const at = new Date('2026-06-01T00:00:00.000Z');
    const rate = resolveHourlyRate(
      [
        {
          userId: 'u1',
          hourlyRate: 40,
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: null,
        },
        {
          userId: 'u1',
          hourlyRate: 20,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-07-01T00:00:00.000Z'),
        },
      ],
      at,
      { userId: 'u1' },
    );
    expect(rate).toBe(20);
  });
});
