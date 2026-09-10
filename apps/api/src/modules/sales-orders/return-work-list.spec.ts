import type { AuthUser } from '@maher/types';
import { SalesOrdersService } from './sales-orders.service';
import type { PrismaService } from '../../common/prisma.service';

describe('SalesOrdersService.listReturnedCases', () => {
  const admin: AuthUser = {
    id: 'admin',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['sales-order.read'],
    preferredLanguage: 'en',
  };

  const dealer: AuthUser = {
    ...admin,
    id: 'dealer',
    username: 'nile',
    roles: ['CUSTOMER'],
    customerId: 'cust-nile',
  };

  const caseRow = {
    id: 'ret-1',
    number: 'RET-1',
    lifecycleState: 'REWORKING',
    productDesc: 'Sofa + chairs',
    quantity: 3,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    customer: {
      id: 'cust-nile',
      name: 'Nile',
      nameAr: null,
      nameEn: 'Nile',
      nameHe: null,
      code: 'NILE',
    },
    salesOrder: { id: 'so-1', number: 'SO-1' },
    pieces: [
      { state: 'IN_PROGRESS', decision: 'REPAIR', outboundEligible: true, productDesc: 'Sofa' },
      { state: 'IN_PROGRESS', decision: 'REPLACEMENT', outboundEligible: true, productDesc: 'Chair' },
      { state: 'RECOVERED', decision: 'SCRAP_RECOVERY', outboundEligible: false, productDesc: 'Chair' },
    ],
  };

  function makeService(rows: typeof caseRow[] = [caseRow], total = rows.length) {
    const prisma = {
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
      returnRequest: {
        count: jest.fn().mockResolvedValue(total),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
    const service = new SalesOrdersService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  }

  it('returns one row per return case with piece counts', async () => {
    const { service, prisma } = makeService();
    const result = await service.listReturnedCases({ page: 1, pageSize: 20 }, admin);
    expect(prisma.returnRequest.count).toHaveBeenCalled();
    expect(result.meta.totalItems).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'ret-1',
      number: 'RET-1',
      kind: 'returnCase',
      originalOrder: { id: 'so-1', number: 'SO-1' },
      pieceSummary: { total: 3, repair: 1, replacement: 1, scrapRecovery: 1 },
    });
  });

  it('scopes dealers to their customerId', async () => {
    const { service, prisma } = makeService();
    await service.listReturnedCases({ page: 1, pageSize: 20, customerId: 'other' }, dealer);
    expect(prisma.returnRequest.findMany.mock.calls[0][0].where.customerId).toBe('cust-nile');
  });
});
