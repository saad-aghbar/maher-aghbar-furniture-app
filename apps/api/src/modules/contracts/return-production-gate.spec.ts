import { ReturnPieceService } from './return-piece.service';
import type { AuthUser } from '@maher/types';

describe('ReturnPieceService production charge gate', () => {
  const user: AuthUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['return.inspect', 'return.work', 'return.scrap.approve', 'return.replacement.create'],
    preferredLanguage: 'en',
  };

  function makeService(chargeStatus: string) {
    const row = {
      id: 'ret-1',
      number: 'RET-1',
      chargeStatus,
      pieces: [
        {
          id: 'p1',
          returnRequestId: 'ret-1',
          code: 'RET-1-P1',
          state: 'RECEIVED',
          decision: null,
        },
      ],
    };
    const prisma = {
      returnRequest: { findUnique: jest.fn().mockResolvedValue(row) },
      auditEvent: { create: jest.fn() },
    };
    const service = new ReturnPieceService(
      prisma as never,
      { next: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return service;
  }

  it('blocks piece decisions while the dealer charge is unresolved', async () => {
    for (const status of ['DRAFT', 'AWAITING_DEALER', 'REJECTED']) {
      const service = makeService(status);
      await expect(
        service.decidePieces('ret-1', user, { items: [{ pieceId: 'p1', decision: 'REPAIR' }] }),
      ).rejects.toMatchObject({ response: { code: 'RETURN_CHARGE_NOT_CONFIRMED' } });
    }
  });

  it('allows factory work when the charge is not required or already confirmed', async () => {
    const service = makeService('NOT_REQUIRED');
    await expect(
      service.decidePieces('ret-1', user, { items: [] }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
});
