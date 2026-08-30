import { NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { PdfController } from './pdf.controller';

describe('quotation PDF ownership', () => {
  function make() {
    const prisma = {
      quotation: { findFirst: jest.fn() },
    };
    const ctrl = new PdfController(prisma as never, {} as never, {} as never);
    return { ctrl, prisma };
  }

  const dealerA: AuthUser = {
    id: 'user-a',
    username: 'nile',
    email: 'a@example.com',
    name: 'Nile',
    roles: ['CUSTOMER'],
    permissions: ['quotation.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  it('404s when dealer B fetches dealer A PDF', async () => {
    const { ctrl, prisma } = make();
    prisma.quotation.findFirst.mockResolvedValue({
      id: 'q-b',
      customerId: 'customer-b',
      status: 'SENT',
      archivedAt: null,
      lines: [],
      customer: { name: 'Oasis' },
    });
    await expect(
      ctrl.quotationPdf('q-b', dealerA, undefined, undefined, undefined, {} as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s unsent quotation PDFs for dealers', async () => {
    const { ctrl, prisma } = make();
    prisma.quotation.findFirst.mockResolvedValue({
      id: 'q-a',
      customerId: 'customer-a',
      status: 'DRAFT',
      archivedAt: null,
      lines: [],
      customer: { name: 'Nile' },
    });
    await expect(
      ctrl.quotationPdf('q-a', dealerA, undefined, undefined, undefined, {} as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
