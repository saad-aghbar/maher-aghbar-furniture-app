import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { PdfController } from './pdf.controller';

describe('goods receipt PDF', () => {
  function make() {
    const prisma = {
      goodsReceipt: { findUniqueOrThrow: jest.fn() },
    };
    const ctrl = new PdfController(prisma as never, {} as never, {} as never, {} as never);
    return { ctrl, prisma };
  }

  const dealer: AuthUser = {
    id: 'user-d',
    username: 'nile',
    email: 'a@example.com',
    name: 'Nile',
    roles: ['CUSTOMER'],
    permissions: ['purchase-order.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  it('stays off dealer routes', async () => {
    const { ctrl, prisma } = make();
    await expect(
      ctrl.goodsReceiptPdf('grn-1', dealer, undefined, undefined, undefined, {} as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.goodsReceipt.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
