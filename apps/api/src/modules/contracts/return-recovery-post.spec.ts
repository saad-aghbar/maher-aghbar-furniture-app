import { ReturnPieceService } from './return-piece.service';
import type { AuthUser } from '@maher/types';

describe('ReturnPieceService.postRecoveryLine', () => {
  const user: AuthUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['return.recovery.post'],
    preferredLanguage: 'en',
  };

  it('posts inventory once when the same line is posted twice', async () => {
    const line = {
      id: 'line-1',
      returnPieceId: 'p1',
      postedAt: null,
      quantity: 2,
      outcome: 'DISPOSE',
      inventoryItemId: 'item-1',
      destinationWarehouseId: 'wh-1',
      destinationLocationId: null,
      unitCost: 4,
      idempotencyKey: 'return-recovery:line-1',
      inventoryItem: { id: 'item-1', standardCost: 4, unit: 'pcs' },
      returnPiece: { id: 'p1', code: 'RET-1-P1', recoveryLines: [] },
    };
    const inventory = {
      applyMovement: jest.fn().mockResolvedValue({ id: 'tx-1' }),
      writeOffReturnPieceQuarantine: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      returnRecoveryLine: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(line)
          .mockResolvedValueOnce({ ...line, postedAt: new Date('2026-09-01') }),
        update: jest.fn().mockResolvedValue({ ...line, postedAt: new Date('2026-09-01') }),
        findMany: jest.fn().mockResolvedValue([{ id: 'line-1', postedAt: new Date() }]),
      },
      returnPiece: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          state: 'IN_PROGRESS',
          returnRequestId: 'ret-1',
          recoveryLines: [{ id: 'line-1', postedAt: new Date() }],
        }),
        update: jest.fn(),
      },
      returnRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ret-1',
          lifecycleState: 'REWORKING',
          pieces: [],
        }),
        update: jest.fn(),
      },
    };
    const service = new ReturnPieceService(
      prisma as never,
      { next: jest.fn() } as never,
      inventory as never,
      {} as never,
      {} as never,
    );

    await service.postRecoveryLine('line-1', user);
    const second = await service.postRecoveryLine('line-1', user);
    expect(inventory.applyMovement).toHaveBeenCalledTimes(1);
    expect(second.postedAt).toBeTruthy();
  });
});
