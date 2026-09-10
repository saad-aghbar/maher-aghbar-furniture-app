import { formatDocumentNumber, SequenceService } from './sequence.service';

describe('formatDocumentNumber', () => {
  it('pads the yearly sequence', () => {
    expect(formatDocumentNumber('SPAY', 2026, 14)).toBe('SPAY-2026-00014');
  });
});

describe('SequenceService.nextUnused', () => {
  it('skips numbers that already exist', async () => {
    let current = 0;
    const prisma = {
      sequenceCounter: {
        upsert: jest.fn(async () => {
          current += 1;
          return { current };
        }),
      },
    };
    const service = new SequenceService(prisma as never);
    const year = new Date().getFullYear();
    const taken = new Set([
      `SPAY-${year}-00001`,
      `SPAY-${year}-00002`,
    ]);

    const number = await service.nextUnused('SPAY', 'SPAY', async (n) => taken.has(n));

    expect(number).toBe(`SPAY-${year}-00003`);
    expect(prisma.sequenceCounter.upsert).toHaveBeenCalledTimes(3);
  });
});
