import { BadRequestException } from '@nestjs/common';
import { ReturnPieceService } from './return-piece.service';
import type { AuthUser } from '@maher/types';

describe('ReturnPieceService.decidePieces', () => {
  const user: AuthUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['return.inspect', 'return.work', 'return.scrap.approve', 'return.replacement.create'],
    preferredLanguage: 'en',
  };

  function makeService(pieces: Array<Record<string, unknown>>) {
    const row = {
      id: 'ret-1',
      number: 'RET-1',
      pieces,
    };
    const prisma = {
      returnRequest: {
        findUnique: jest.fn().mockResolvedValue(row),
      },
      returnPiece: {
        findUniqueOrThrow: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const piece = pieces.find((row) => row.id === where.id) ?? pieces[0];
          return {
            productionOrderId: piece?.productionOrderId ?? null,
            recoveryOrderId: piece?.recoveryOrderId ?? null,
          };
        }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new ReturnPieceService(
      prisma as never,
      { next: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  }

  it('rejects an empty decision list', async () => {
    const { service } = makeService([]);
    await expect(service.decidePieces('ret-1', user, { items: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects RESTOCK — only the three factory decisions are valid', async () => {
    const { service } = makeService([
      { id: 'p1', returnRequestId: 'ret-1', code: 'RET-1-P1', state: 'RECEIVED', decision: null },
    ]);
    await expect(
      service.decidePieces('ret-1', user, {
        items: [{ pieceId: 'p1', decision: 'RESTOCK' as never }],
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects a decision before the piece is received', async () => {
    const { service } = makeService([
      {
        id: 'p1',
        returnRequestId: 'ret-1',
        code: 'RET-1-P1',
        state: 'AWAITING_RECEIPT',
        decision: null,
      },
    ]);
    await expect(
      service.decidePieces('ret-1', user, { items: [{ pieceId: 'p1', decision: 'REPAIR' }] }),
    ).rejects.toMatchObject({ response: { code: 'RETURN_PIECE_NOT_RECEIVED' } });
  });

  it('rejects a second different decision on the same piece', async () => {
    const { service } = makeService([
      {
        id: 'p1',
        returnRequestId: 'ret-1',
        code: 'RET-1-P1',
        state: 'IN_PROGRESS',
        decision: 'REPAIR',
        productionOrderId: 'rw-1',
      },
    ]);
    await expect(
      service.decidePieces('ret-1', user, { items: [{ pieceId: 'p1', decision: 'REPLACEMENT' }] }),
    ).rejects.toMatchObject({ response: { code: 'RETURN_PIECE_ALREADY_DECIDED' } });
  });

  it('is a no-op when the same decision is confirmed again', async () => {
    const { service, prisma } = makeService([
      {
        id: 'p1',
        returnRequestId: 'ret-1',
        code: 'RET-1-P1',
        state: 'IN_PROGRESS',
        decision: 'REPAIR',
        productionOrderId: 'rw-1',
      },
    ]);
    await service.decidePieces('ret-1', user, { items: [{ pieceId: 'p1', decision: 'REPAIR' }] });
    expect(prisma.auditEvent.create).toHaveBeenCalled();
    expect(prisma.returnPiece.findUniqueOrThrow).toHaveBeenCalled();
  });
});
