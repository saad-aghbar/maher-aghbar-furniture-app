import { BadRequestException } from '@nestjs/common';
import { PurchaseOrderStatus, PurchaseRequestStatus } from '@maher/database';
import { PurchasingService } from './purchasing.service';

function makeService(overrides: {
  prisma?: Record<string, unknown>;
  sequences?: { next: jest.Mock };
  whatsapp?: { send: jest.Mock };
}) {
  const prisma = {
    purchaseRequest: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrder: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    supplierQuoteOffer: { update: jest.fn() },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    ...overrides.prisma,
  };
  const sequences = overrides.sequences ?? { next: jest.fn().mockResolvedValue('PORD-9') };
  const notifications = { sendFromTemplate: jest.fn() };
  const whatsapp = overrides.whatsapp ?? { send: jest.fn().mockResolvedValue({ ok: true }) };

  return {
    svc: new PurchasingService(
      prisma as never,
      sequences as never,
      notifications as never,
      whatsapp as never,
    ),
    prisma,
    whatsapp,
  };
}

describe('PurchasingService convertRequestToPo', () => {
  it('converts using preferredSupplier when there are no offers', async () => {
    const { svc, prisma } = makeService({});
    prisma.purchaseRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'pr1',
      status: PurchaseRequestStatus.APPROVED,
      purchaseOrderId: null,
      preferredSupplierId: 'sup1',
      warehouseId: null,
      reason: 'Need oak',
      lines: [
        {
          description: 'Oak',
          quantity: 10,
          unit: 'm',
          inventoryItemId: 'item1',
          inventoryItem: { id: 'item1', standardCost: 5, unit: 'm' },
        },
      ],
      offers: [],
    });
    prisma.purchaseOrder.create.mockResolvedValue({
      id: 'po1',
      number: 'PORD-9',
      supplierId: 'sup1',
      lines: [],
      supplier: { id: 'sup1' },
    });

    const po = await svc.convertRequestToPo('pr1', 'u1');
    expect(po.id).toBe('po1');
    expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierId: 'sup1',
          status: PurchaseOrderStatus.DRAFT,
          lines: {
            create: [
              expect.objectContaining({
                description: 'Oak',
                unitPrice: '5.000',
              }),
            ],
          },
        }),
      }),
    );
  });

  it('rejects when neither offers nor preferred supplier exist', async () => {
    const { svc, prisma } = makeService({});
    prisma.purchaseRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'pr1',
      status: PurchaseRequestStatus.APPROVED,
      purchaseOrderId: null,
      preferredSupplierId: null,
      lines: [],
      offers: [],
    });
    await expect(svc.convertRequestToPo('pr1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PurchasingService sendPurchaseOrder', () => {
  it('marks SENT and returns whatsapp.ok when provider succeeds', async () => {
    const { svc, prisma, whatsapp } = makeService({});
    prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
      id: 'po1',
      number: 'PORD-1',
      status: PurchaseOrderStatus.APPROVED,
      supplierId: 'sup1',
      supplier: { id: 'sup1', name: 'Wood Co', phone: '+9627', whatsappPhone: null },
      lines: [{ description: 'Oak', quantity: 2, unit: 'm' }],
    });
    prisma.purchaseOrder.update.mockResolvedValue({
      id: 'po1',
      number: 'PORD-1',
      status: PurchaseOrderStatus.SENT,
      supplierId: 'sup1',
      whatsappSentAt: new Date(),
      whatsappLastBody: 'x',
      whatsappLastTo: '+9627',
      supplier: { id: 'sup1', name: 'Wood Co', phone: '+9627', whatsappPhone: null },
      lines: [{ description: 'Oak', quantity: 2, unit: 'm' }],
    });

    const result = await svc.sendPurchaseOrder('po1', 'u1');
    expect(whatsapp.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+9627', body: expect.stringContaining('Oak') }),
    );
    expect(result.whatsapp.ok).toBe(true);
    expect(result.purchaseOrder.status).toBe(PurchaseOrderStatus.SENT);
  });

  it('still marks SENT when supplier has no phone', async () => {
    const { svc, prisma, whatsapp } = makeService({});
    prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
      id: 'po1',
      number: 'PORD-1',
      status: PurchaseOrderStatus.APPROVED,
      supplierId: 'sup1',
      supplier: { id: 'sup1', name: 'Wood Co', phone: null, whatsappPhone: null },
      lines: [{ description: 'Oak', quantity: 2, unit: 'pcs' }],
    });
    prisma.purchaseOrder.update.mockResolvedValue({
      id: 'po1',
      number: 'PORD-1',
      status: PurchaseOrderStatus.SENT,
      supplierId: 'sup1',
      whatsappSentAt: new Date(),
      whatsappLastBody: 'x',
      whatsappLastTo: null,
      supplier: { id: 'sup1', name: 'Wood Co', phone: null, whatsappPhone: null },
      lines: [{ description: 'Oak', quantity: 2, unit: 'pcs' }],
    });

    const result = await svc.sendPurchaseOrder('po1');
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(result.whatsapp.ok).toBe(false);
    expect(result.whatsapp.error).toMatch(/no WhatsApp/i);
    expect(result.purchaseOrder.status).toBe(PurchaseOrderStatus.SENT);
  });
});
