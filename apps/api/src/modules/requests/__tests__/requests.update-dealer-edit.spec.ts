import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { RequestsService } from '../requests.service';
import type { PrismaService } from '../../../common/prisma.service';
import type { SequenceService } from '../../../common/sequence.service';
import { DEALER_EDIT_WINDOW_MS } from '../dealer-edit-policy';

describe('RequestsService.update dealer edit enforcement', () => {
  const dealer: AuthUser = {
    id: 'user-dealer',
    username: 'cedar',
    email: 'cedar@example.com',
    name: 'Cedar',
    roles: ['CUSTOMER'],
    permissions: ['request.update', 'request.read'],
    preferredLanguage: 'en',
    customerId: 'customer-1',
  };

  function baseRequest(overrides: Record<string, unknown> = {}) {
    const submittedAt = new Date(Date.now() - 60_000);
    return {
      id: 'rfq-1',
      number: 'RFQ-1',
      customerId: 'customer-1',
      status: 'SUBMITTED',
      createdAt: submittedAt,
      submittedAt,
      notes: 'old notes',
      deliveryAddress: 'Ramallah',
      externalOrderNumber: 'PO-1',
      endCustomerName: 'Omar',
      endCustomerPhone: '+970591111111',
      items: [
        {
          id: 'item-1',
          productName: 'Sofa',
          quantity: 1,
          fabricType: 'Linen',
          fabricColor: 'Beige',
          fabricCode: null,
          notes: null,
          width: null,
          height: null,
          depth: null,
        },
      ],
      customer: { id: 'customer-1', name: 'Cedar' },
      quotations: [],
      documents: [],
      ...overrides,
    };
  }

  function buildService(opts: {
    request: ReturnType<typeof baseRequest>;
    production?: { currentStageCode: string | null; progressPercent: number } | null;
  }) {
    const updatedRow = {
      ...opts.request,
      notes: 'new notes',
      items: opts.request.items,
    };

    const prisma = {
      requestForQuotation: {
        findFirst: jest.fn().mockResolvedValue(opts.request),
        update: jest.fn().mockResolvedValue(updatedRow),
      },
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue(opts.production ?? null),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      requestItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          requestItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          requestForQuotation: {
            update: jest.fn().mockResolvedValue(updatedRow),
          },
        }),
      ),
    } as unknown as PrismaService;

    const service = new RequestsService(
      prisma,
      {} as SequenceService,
      {
        sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }),
        notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }),
        notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }),
      } as any,
      { createAccessToken: jest.fn(() => 'tok') } as any,
    );
    return { service, prisma };
  }

  it('rejects edits after the 3-day window with 409 ORDER_LOCKED', async () => {
    const submittedAt = new Date(Date.now() - DEALER_EDIT_WINDOW_MS - 60_000);
    const { service } = buildService({
      request: baseRequest({ submittedAt, createdAt: submittedAt }),
    });

    await expect(service.update('rfq-1', { notes: 'too late' }, dealer)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.update('rfq-1', { notes: 'too late' }, dealer)).rejects.toMatchObject({
      response: { code: 'ORDER_LOCKED' },
    });
  });

  it('rejects fabric changes when production is in upholstery (409 FABRIC_LOCKED)', async () => {
    const { service, prisma } = buildService({
      request: baseRequest(),
      production: { currentStageCode: 'UPHOLSTERY', progressPercent: 20 },
    });

    await expect(
      service.update(
        'rfq-1',
        {
          items: [
            {
              productName: 'Sofa',
              quantity: 1,
              fabric: 'Velvet',
              color: 'Navy',
            },
          ],
        },
        dealer,
      ),
    ).rejects.toMatchObject({
      response: { code: 'FABRIC_LOCKED' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows notes/dimensions while fabric is locked', async () => {
    const { service, prisma } = buildService({
      request: baseRequest(),
      production: { currentStageCode: 'UPHOLSTERY', progressPercent: 20 },
    });

    const result = await service.update(
      'rfq-1',
      {
        notes: 'Gate code 12',
        items: [
          {
            productName: 'Sofa',
            quantity: 1,
            fabric: 'Linen',
            color: 'Beige',
            width: 200,
            notes: 'Dims note',
          },
        ],
      },
      dealer,
    );

    expect(result).toBeTruthy();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'request.update' }),
      }),
    );
  });

  it('rejects modified-client unlock attempts', async () => {
    const submittedAt = new Date(Date.now() - DEALER_EDIT_WINDOW_MS - 60_000);
    const { service } = buildService({
      request: baseRequest({ submittedAt, createdAt: submittedAt }),
    });

    await expect(
      service.update('rfq-1', { notes: 'hack', forceUnlock: true } as never, dealer),
    ).rejects.toMatchObject({
      response: { code: 'ORDER_LOCKED' },
    });
  });

  it('allows admin edits on quoted requests (dealer lock does not apply)', async () => {
    const admin: AuthUser = {
      id: 'user-admin',
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      roles: ['ADMIN'],
      permissions: ['request.update', 'request.read'],
      preferredLanguage: 'en',
    };
    const { service, prisma } = buildService({
      request: baseRequest({ status: 'QUOTED' }),
    });

    await expect(
      service.update('rfq-1', { projectName: 'Updated project' }, admin),
    ).resolves.toBeTruthy();
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
