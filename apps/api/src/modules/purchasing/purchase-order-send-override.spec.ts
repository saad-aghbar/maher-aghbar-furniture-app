import { PurchaseOrderStatus } from '@maher/database';
import { PurchasingService } from './purchasing.service';

function makeService(overrides: { sendOk?: boolean; throwSend?: boolean } = {}) {
  const po = {
    id: 'po1',
    number: 'PORD-1',
    status: PurchaseOrderStatus.APPROVED,
    currency: 'ILS',
    total: 20,
    expectedDeliveryDate: null,
    supplierId: 'sup1',
    supplier: { id: 'sup1', name: 'Wood Co', nameAr: 'خشب', nameEn: 'Wood Co', phone: '+9627', whatsappPhone: null },
    warehouse: null,
    lines: [{ description: 'Oak', quantity: 2, unit: 'm', unitPrice: 10, warehouse: null }],
  };
  const prisma = {
    purchaseOrder: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(po),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...po,
        ...data,
        supplier: po.supplier,
        lines: po.lines,
      })),
    },
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const whatsapp = {
    send: jest.fn(async ({ body: _body }: { body: string }) => {
      if (overrides.throwSend) throw new Error('provider down');
      return { ok: overrides.sendOk ?? true, id: 'wa-1' };
    }),
  };
  const svc = new PurchasingService(
    prisma as never,
    { next: jest.fn() } as never,
    { sendFromTemplate: jest.fn() } as never,
    whatsapp as never,
  );
  return { svc, prisma, whatsapp, po };
}

describe('purchase-order send override', () => {
  it('persists the edited body even when the provider fails', async () => {
    const { svc, prisma, whatsapp } = makeService({ throwSend: true });
    const result = await svc.sendPurchaseOrder('po1', 'u1', { body: 'Edited body' });
    expect(whatsapp.send).toHaveBeenCalledWith({ to: '+9627', body: 'Edited body' });
    expect(result.whatsapp.ok).toBe(false);
    expect(result.whatsapp.body).toBe('Edited body');
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PurchaseOrderStatus.SENT,
          whatsappLastBody: 'Edited body',
        }),
      }),
    );
  });

  it('auto-approves a draft before sending', async () => {
    const { svc, prisma, po } = makeService();
    po.status = PurchaseOrderStatus.DRAFT;
    await svc.sendPurchaseOrder('po1', 'u1', { body: 'Hi', autoApprove: true });
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PurchaseOrderStatus.APPROVED },
      }),
    );
  });
});
