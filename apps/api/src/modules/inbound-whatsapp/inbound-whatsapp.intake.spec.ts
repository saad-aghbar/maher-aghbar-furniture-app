import { RequestSource } from '@maher/database';
import { InboundWhatsAppService } from './inbound-whatsapp.service';

describe('inbound WhatsApp intake classification', () => {
  it('routes WhatsApp text through AI draft RFQ (CUSTOM, never STANDARD)', async () => {
    const prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cust-1',
            name: 'Dealer A',
            code: 'DA',
            phone: '972501234567',
            accountManagerId: 'am-1',
            accountManager: { id: 'am-1' },
            contacts: [],
          },
        ]),
      },
      customerContact: { findMany: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const aiIntake = {
      createJobAndDraftRfqFromText: jest.fn().mockResolvedValue({
        job: { id: 'job-1', number: 'AI-1' },
        request: {
          id: 'rfq-1',
          number: 'RFQ-1',
          items: [{ manufacturingComplexity: 'CUSTOM', productId: null }],
        },
      }),
    };
    const notifications = { sendFromTemplate: jest.fn() };
    const service = new InboundWhatsAppService(
      prisma as never,
      aiIntake as never,
      notifications as never,
    );

    const result = await service.processInboundWhatsApp({
      from: '+972501234567',
      text: 'Need a custom corner sofa 300cm, photo attached',
      messageId: 'wa-1',
    });

    expect(result.ok).toBe(true);
    expect(aiIntake.createJobAndDraftRfqFromText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'WHATSAPP',
        source: RequestSource.WHATSAPP,
        customerId: 'cust-1',
        text: 'Need a custom corner sofa 300cm, photo attached',
      }),
    );
    const created = await aiIntake.createJobAndDraftRfqFromText.mock.results[0]?.value;
    expect(created.request.items[0]?.manufacturingComplexity).toBe('CUSTOM');
    expect(created.request.items[0]?.productId).toBeNull();
  });
});
