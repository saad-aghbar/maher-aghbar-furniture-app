import { BadRequestException } from '@nestjs/common';
import { ReturnPieceService } from './return-piece.service';
import type { AuthUser } from '@maher/types';

describe('ReturnPieceService recovery line edit/delete', () => {
  const user: AuthUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['return.recovery.record'],
    preferredLanguage: 'en',
  };

  function service(prisma: unknown) {
    return new ReturnPieceService(
      prisma as never,
      { next: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('updates an unposted line', async () => {
    const prisma = {
      returnRecoveryLine: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'line-1',
          postedAt: null,
          quantity: 1,
          outcome: 'DISPOSE',
          returnPiece: { id: 'p1' },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'line-1',
          label: 'Foam',
          quantity: 2,
          postedAt: null,
        }),
      },
    };
    const result = await service(prisma).updateRecoveryLine('line-1', user, {
      label: 'Foam',
      quantity: 2,
    });
    expect(prisma.returnRecoveryLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-1' },
        data: expect.objectContaining({ label: 'Foam', quantity: '2.000' }),
      }),
    );
    expect(result.id).toBe('line-1');
  });

  it('rejects editing a posted line', async () => {
    const prisma = {
      returnRecoveryLine: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'line-1',
          postedAt: new Date('2026-09-01'),
          returnPiece: { id: 'p1' },
        }),
        update: jest.fn(),
      },
    };
    await expect(
      service(prisma).updateRecoveryLine('line-1', user, { label: 'Foam' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.returnRecoveryLine.update).not.toHaveBeenCalled();
  });

  it('deletes an unposted line and rejects posted ones', async () => {
    const prisma = {
      returnRecoveryLine: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'line-1', postedAt: null })
          .mockResolvedValueOnce({ id: 'line-2', postedAt: new Date('2026-09-01') }),
        delete: jest.fn().mockResolvedValue({ id: 'line-1' }),
      },
    };
    const svc = service(prisma);
    await expect(svc.deleteRecoveryLine('line-1', user)).resolves.toEqual({
      ok: true,
      id: 'line-1',
    });
    expect(prisma.returnRecoveryLine.delete).toHaveBeenCalledWith({ where: { id: 'line-1' } });
    await expect(svc.deleteRecoveryLine('line-2', user)).rejects.toBeInstanceOf(BadRequestException);
  });
});
