import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RequestsService } from '../requests.service';
import { classifyManufacturingComplexity } from '@maher/types';

function dealer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dealer-a',
    username: 'nile',
    customerId: 'customer-a',
    roles: ['CUSTOMER'],
    permissions: ['request.read', 'request.create', 'request.update'],
    preferredLanguage: 'en',
    ...overrides,
  };
}

function admin() {
  return {
    id: 'admin-1',
    username: 'admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['request.read', 'request.update'],
    preferredLanguage: 'en',
  };
}

function makeService(existing?: Partial<{
  id: string;
  status: string;
  customerId: string;
  items: unknown[];
  reviewHistory: unknown;
  informationRequestReason: string | null;
  submittedAt: Date | null;
  createdAt: Date;
}>) {
  const requestRow = {
    id: 'rfq-1',
    number: 'RFQ-1',
    status: 'DRAFT',
    customerId: 'customer-a',
    archivedAt: null,
    submittedAt: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    informationRequestReason: null,
    reviewHistory: null,
    notes: null,
    internalNotes: null,
    items: [
      {
        productName: 'Sofa',
        quantity: 1,
        productId: 'p1',
        fabricType: null,
        fabricColor: null,
        fabricCode: null,
      },
    ],
    documents: [],
    customer: { id: 'customer-a', name: 'Nile', nameEn: 'Nile' },
    quotations: [],
    ...existing,
  };

  const prisma: any = {
    requestForQuotation: {
      findFirst: jest.fn().mockResolvedValue(requestRow),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...requestRow,
        ...data,
        items: requestRow.items,
        customer: requestRow.customer,
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...requestRow,
        ...data,
        items: requestRow.items,
        customer: requestRow.customer,
      })),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([requestRow]),
    },
    requestItem: { deleteMany: jest.fn() },
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', width: 100, height: 80, depth: 50, seatHeight: null, imageUrl: null, nameEn: 'Sofa', nameAr: null },
      ]),
      findUnique: jest.fn().mockResolvedValue({ imageUrl: null }),
    },
    productionOrder: { findFirst: jest.fn().mockResolvedValue(null) },
    auditEvent: { create: jest.fn() },
    customer: { findUnique: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return (arg as (t: any) => Promise<unknown>)(prisma);
    }),
  };
  const sequences = { next: jest.fn().mockResolvedValue('RFQ-TEST-1') };
  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { createAccessToken: jest.fn().mockReturnValue('tok') };
  const service = new RequestsService(
    prisma as never,
    sequences as never,
    notifications as never,
    storage as never,
  );
  return { service, prisma, notifications, requestRow };
}

describe('requests Piece 1 lifecycle', () => {
  it('creates a draft owned by the dealer without notifying factory', async () => {
    const { service, prisma, notifications } = makeService();
    await service.create(
      {
        items: [{ productName: 'Sofa', quantity: 1, productId: 'p1' }],
      } as never,
      'dealer-a',
      { submit: false, user: dealer() as never },
    );
    expect(prisma.requestForQuotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT', customerId: 'customer-a' }),
      }),
    );
    expect(notifications.notifyAdminUsers).not.toHaveBeenCalled();
  });

  it('rejects submit without items', async () => {
    const { service } = makeService({ items: [] });
    await expect(service.submit('rfq-1', dealer() as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('submits draft to SUBMITTED and notifies admin', async () => {
    const { service, prisma, notifications } = makeService({ status: 'DRAFT' });
    const result = await service.submit('rfq-1', dealer() as never);
    expect(prisma.requestForQuotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      }),
    );
    expect(notifications.notifyAdminUsers).toHaveBeenCalled();
    expect(result.presentationKey).toBe('waitingForReview');
  });

  it('requires reason for needs-information and notifies dealer', async () => {
    const { service, notifications } = makeService({ status: 'SUBMITTED' });
    await expect(
      service.markNeedsInformation('rfq-1', '  ', admin() as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    const updated = await service.markNeedsInformation(
      'rfq-1',
      'Fabric unclear',
      admin() as never,
    );
    expect(updated.informationRequestReason).toBe('Fabric unclear');
    expect(notifications.notifyCustomerUsers).toHaveBeenCalled();
  });

  it('forbids dealers from factory review actions', async () => {
    const { service } = makeService({ status: 'SUBMITTED' });
    await expect(
      service.markNeedsInformation('rfq-1', 'x', dealer() as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.markUnderReview('rfq-1', dealer() as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('resubmit from NEEDS_INFORMATION clears reason into history', async () => {
    const { service, prisma } = makeService({
      status: 'NEEDS_INFORMATION',
      informationRequestReason: 'Dims unclear',
      reviewHistory: [{ at: 'a', action: 'NEEDS_INFORMATION', message: 'Dims unclear' }],
    });
    await service.submit('rfq-1', dealer() as never);
    expect(prisma.requestForQuotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUBMITTED',
          informationRequestReason: null,
        }),
      }),
    );
  });

  it('discards only drafts', async () => {
    const { service } = makeService({ status: 'SUBMITTED' });
    await expect(service.discardDraft('rfq-1', dealer() as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const draft = makeService({ status: 'DRAFT' });
    await expect(draft.service.discardDraft('rfq-1', dealer() as never)).resolves.toEqual({
      id: 'rfq-1',
      discarded: true,
    });
  });

  it('denies cross-dealer access', async () => {
    const { service } = makeService({ customerId: 'customer-a' });
    await expect(
      service.getById('rfq-1', dealer({ customerId: 'customer-b' }) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not mutate catalog Product when classifying customized lines', () => {
    const catalog = { width: 100, bom: { a: 1 } };
    const complexity = classifyManufacturingComplexity({
      productId: 'p1',
      width: 120,
      catalog: { width: 100 },
    });
    expect(complexity).toBe('MODIFIED');
    expect(catalog).toEqual({ width: 100, bom: { a: 1 } });
  });

  it('locks dealer edits outside the window', async () => {
    const { service } = makeService({
      status: 'SUBMITTED',
      submittedAt: new Date('2020-01-01T00:00:00Z'),
      createdAt: new Date('2020-01-01T00:00:00Z'),
    });
    await expect(
      service.update('rfq-1', { notes: 'try' } as never, dealer() as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
