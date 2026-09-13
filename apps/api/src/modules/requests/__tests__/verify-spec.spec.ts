import { ForbiddenException } from '@nestjs/common';
import { RequestsService } from '../requests.service';

describe('verifySpec', () => {
  const requestRow = {
    id: 'rfq-1',
    number: 'RFQ-1',
    status: 'SUBMITTED',
    customerId: 'customer-a',
    archivedAt: null,
    submittedAt: new Date(),
    createdAt: new Date(),
    reviewHistory: [],
    items: [{ id: 'item-1', productName: 'Karina', quantity: 1, fabricType: null, fabricColor: null, fabricCode: null }],
    documents: [],
    aiJobs: [],
    customer: { id: 'customer-a', name: 'Nile' },
    quotations: [],
  };

  const storedItem = {
    id: 'item-1',
    requestId: 'rfq-1',
    productId: 'prod-1',
    variantId: 'var-1',
    variantSku: 'KAR-UK',
    variantLabel: 'Ukrainian',
    productName: 'Karina',
    quantity: 1,
    unit: 'pcs',
    width: 250,
    height: 90,
    depth: 95,
    woodType: 'Oak',
    woodColor: 'Walnut',
    foamDensity: 'D35',
    finish: 'Matte',
    accessories: null,
    orientation: 'LEFT',
    notes: 'Match showroom',
    customMeasurements: [{ label: 'Seat', value: '45' }],
    options: [{ groupCode: 'DEALER_SPEC', nameEn: 'Piping', note: 'Navy' }],
    fabrics: [{ type: 'Linen', color: 'Sand' }],
    photoDocumentIds: ['doc-photo'],
    primaryImageDocumentId: 'doc-photo',
    sortOrder: 0,
  };

  function makeService() {
    const prisma: any = {
      requestForQuotation: {
        findFirst: jest.fn().mockResolvedValue(requestRow),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...requestRow,
          ...data,
        })),
      },
      requestItem: {
        findFirst: jest.fn().mockResolvedValue(storedItem),
        update: jest.fn(),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-1',
            sku: 'KAR',
            width: 250,
            height: 90,
            depth: 95,
            seatHeight: 45,
            customMeasurements: [],
            imageUrl: null,
            nameEn: 'Karina',
            nameAr: 'كارينا',
            nameHe: null,
            variants: [
              {
                id: 'var-1',
                productId: 'prod-1',
                sku: 'KAR-UK',
                code: 'UK',
                nameAr: 'Ukrainian',
                nameEn: 'Ukrainian',
                nameHe: null,
                isDefault: true,
                isActive: true,
                width: 250,
                height: 90,
                depth: 95,
                seatHeight: 45,
                measurements: [],
                composition: null,
                includedItems: null,
                imageUrl: null,
                options: [],
              },
            ],
          },
        ]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productionOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      factoryCalendar: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }) },
      auditEvent: { create: jest.fn() },
    };
    const service = new RequestsService(
      prisma,
      { next: jest.fn() } as never,
      { notifyAdminUsers: jest.fn(), notifyCustomerUsers: jest.fn() } as never,
      { createAccessToken: jest.fn(() => 'tok') } as never,
    );
    return { service, prisma };
  }

  const staff = {
    id: 'admin-1',
    username: 'admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['request.update'],
    preferredLanguage: 'en',
  } as never;

  it('appends SPEC_CONFIRMED to reviewHistory', async () => {
    const { service, prisma } = makeService();
    await service.verifySpec('rfq-1', staff, { itemId: 'item-1', action: 'CONFIRM' });
    expect(prisma.requestItem.update).not.toHaveBeenCalled();
    const updateCalls = prisma.requestForQuotation.update.mock.calls as Array<
      [{ data: { reviewHistory?: Array<{ action: string }> } }]
    >;
    const historyCall = updateCalls.find((call) => Array.isArray(call[0]?.data?.reviewHistory));
    expect(historyCall?.[0]?.data?.reviewHistory?.some((row) => row.action === 'SPEC_CONFIRMED')).toBe(true);
  });

  it('appends SPEC_CORRECTED and keeps the original dealer value retrievable', async () => {
    const { service, prisma } = makeService();
    await service.verifySpec('rfq-1', staff, {
      itemId: 'item-1',
      action: 'CORRECT',
      message: 'Karina · 250',
      fields: { width: '255' },
    });
    expect(prisma.requestItem.update).toHaveBeenCalled();
    const updateCalls = prisma.requestForQuotation.update.mock.calls as Array<
      [{ data: { reviewHistory?: Array<{ action: string; message?: string | null }> } }]
    >;
    const historyCall = updateCalls.find((call) => Array.isArray(call[0]?.data?.reviewHistory));
    expect(
      historyCall?.[0]?.data?.reviewHistory?.some(
        (row) => row.action === 'SPEC_CORRECTED' && row.message === 'Karina · 250',
      ),
    ).toBe(true);
  });

  it('persists the full CORRECT payload and reclassifies MODIFIED', async () => {
    const { service, prisma } = makeService();
    await service.verifySpec('rfq-1', staff, {
      itemId: 'item-1',
      action: 'CORRECT',
      fields: {
        width: '255',
        notes: 'Factory note',
        woodColor: 'Black',
        accessories: 'Piping',
        customMeasurements: [{ label: 'Seat', value: '46' }],
        options: [{ groupCode: 'DEALER_SPEC', nameEn: 'Piping', note: 'Navy welt' }],
        fabrics: [{ type: 'Velvet', color: 'Ink' }],
        photoDocumentIds: ['doc-photo', 'doc-b'],
      },
    });
    expect(prisma.requestItem.findFirst).toHaveBeenCalledWith({
      where: { id: 'item-1', requestId: 'rfq-1' },
    });
    const data = prisma.requestItem.update.mock.calls[0][0].data as {
      width: number;
      notes: string;
      woodColor: string;
      accessories: string;
      manufacturingComplexity: string;
      photoDocumentIds: string[];
      customMeasurements: Array<{ label: string; value: string }>;
    };
    expect(data.width).toBe(255);
    expect(data.notes).toBe('Factory note');
    expect(data.woodColor).toBe('Black');
    expect(data.accessories).toBe('Piping');
    expect(data.photoDocumentIds).toEqual(['doc-photo', 'doc-b']);
    expect(data.customMeasurements).toEqual([{ label: 'Seat', value: '46' }]);
    expect(data.manufacturingComplexity).toBe('MODIFIED');
  });

  it('forbids dealers from verifying specs', async () => {
    const { service } = makeService();
    await expect(
      service.verifySpec(
        'rfq-1',
        {
          id: 'dealer-1',
          username: 'nile',
          roles: ['CUSTOMER'],
          permissions: ['request.update'],
          preferredLanguage: 'ar',
          customerId: 'customer-a',
        } as never,
        { itemId: 'item-1', action: 'CONFIRM' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
