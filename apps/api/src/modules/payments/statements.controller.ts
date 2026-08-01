import { Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { roundMoney } from '../../common/helpers/money.util';
import { buildSimplePdf, sendPdf } from '../../common/helpers/pdf.util';

@ApiTags('statements')
@Controller('statements')
export class StatementsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAccess(user: AuthUser, customerId: string) {
    if (user.customerId && user.customerId !== customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your statement.' });
    }
  }

  @Get(':customerId/pdf')
  @RequirePermissions('statement.read')
  async pdf(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    this.assertAccess(user, customerId);
    const statement = await this.get(customerId, user, asOf);
    const company = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
    const buffer = await buildSimplePdf({
      title: company,
      subtitle: `Statement of Account — ${statement.customer.name} (${statement.customer.code})`,
      meta: [
        `As of: ${statement.asOf.slice(0, 10)}`,
        `Closing balance: ${statement.closingBalance} ${statement.currency}`,
      ],
      columns: ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance'],
      rows: statement.entries.map((e) => [
        e.date.slice(0, 10),
        e.reference,
        e.description,
        e.debit,
        e.credit,
        e.balance,
      ]),
      footerLines: [`Closing: ${statement.closingBalance} ${statement.currency}`],
    });
    sendPdf(res, `SOA-${statement.customer.code}.pdf`, buffer);
  }

  @Get(':customerId')
  @RequirePermissions('statement.read')
  async get(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthUser,
    @Query('asOf') asOf?: string,
  ) {
    this.assertAccess(user, customerId);
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        archivedAt: null,
        status: { notIn: ['CANCELLED', 'VOID'] },
        invoiceDate: { lte: asOfDate },
      },
      orderBy: { invoiceDate: 'asc' },
    });
    const payments = await this.prisma.payment.findMany({
      where: { customerId, paymentDate: { lte: asOfDate } },
      orderBy: { paymentDate: 'asc' },
    });

    type Entry = {
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      debit: string;
      credit: string;
      description: string;
    };

    const entries: Entry[] = [
      ...invoices.map((inv) => ({
        date: inv.invoiceDate,
        type: 'INVOICE' as const,
        reference: inv.number,
        debit: String(inv.total),
        credit: '0.000',
        description: `Invoice ${inv.number}`,
      })),
      ...payments.map((pay) => ({
        date: pay.paymentDate,
        type: 'PAYMENT' as const,
        reference: pay.number,
        debit: '0.000',
        credit: String(pay.amount),
        description: `Payment ${pay.number}`,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    const withBalance = entries.map((e) => {
      balance += Number(e.debit) - Number(e.credit);
      return { ...e, balance: roundMoney(balance), date: e.date.toISOString() };
    });

    return {
      customer: { id: customer.id, code: customer.code, name: customer.name },
      asOf: asOfDate.toISOString(),
      openingBalance: '0.000',
      closingBalance: roundMoney(balance),
      currency: 'JOD',
      entries: withBalance,
    };
  }
}
