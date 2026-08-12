import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { roundMoney } from '../../common/helpers/money.util';
import {
  buildSimplePdf,
  parsePdfQuery,
  sendPdf,
} from '../../common/helpers/pdf.util';
import { localizedName, pdfMessages } from '../../common/helpers/pdf-i18n';

@ApiTags('statements')
@Controller('statements')
export class StatementsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAccess(user: AuthUser, customerId: string) {
    if (user.customerId && user.customerId !== customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your statement.',
      });
    }
  }

  @Get(':customerId/pdf')
  @RequirePermissions('statement.read')
  async pdf(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('asOf') asOf?: string,
    @Query('lang') lang?: string,
    @Query('theme') theme?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    this.assertAccess(user, customerId);
    const { locale, theme: pdfTheme } = parsePdfQuery({
      lang,
      theme,
      acceptLanguage,
    });
    const m = pdfMessages(locale);
    const statement = await this.buildStatement(customerId, user, asOf, locale);
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.statementOfAccount,
      subtitle: statement.customer.name,
      meta: [
        `${m.asOf}: ${statement.asOf.slice(0, 10)}`,
        `${m.closing}: ${statement.closingBalance} ${statement.currency}`,
      ],
      columns: [m.date, m.ref, m.description, m.debit, m.credit, m.balance],
      rows: statement.entries.map((e) => [
        e.date.slice(0, 10),
        e.reference,
        e.description,
        e.debit,
        e.credit,
        e.balance,
      ]),
      footerLines: [
        `${m.closing}: ${statement.closingBalance} ${statement.currency}`,
      ],
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
    return this.buildStatement(customerId, user, asOf, 'en');
  }

  private async buildStatement(
    customerId: string,
    user: AuthUser,
    asOf: string | undefined,
    locale: import('../../common/helpers/pdf.util').PdfLocale,
  ) {
    this.assertAccess(user, customerId);
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
    });
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const m = pdfMessages(locale);

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
      entityId: string;
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      debit: string;
      credit: string;
      description: string;
    };

    const entries: Entry[] = [
      ...invoices.map((inv) => ({
        entityId: inv.id,
        date: inv.invoiceDate,
        type: 'INVOICE' as const,
        reference: inv.number,
        debit: String(inv.total),
        credit: '0.000',
        description: `${m.invoice} ${inv.number}`,
      })),
      ...payments.map((pay) => ({
        entityId: pay.id,
        date: pay.paymentDate,
        type: 'PAYMENT' as const,
        reference: pay.number,
        debit: '0.000',
        credit: String(pay.amount),
        description: `${m.paymentReceipt} ${pay.number}`,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;
    const withBalance = entries.map((e) => {
      balance += Number(e.debit) - Number(e.credit);
      totalInvoiced += Number(e.debit);
      totalPaid += Number(e.credit);
      return { ...e, balance: roundMoney(balance), date: e.date.toISOString() };
    });

    const displayName = localizedName(locale, customer);

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: displayName || customer.name,
      },
      asOf: asOfDate.toISOString(),
      openingBalance: '0.000',
      closingBalance: roundMoney(balance),
      outstandingBalance: roundMoney(balance),
      totalInvoiced: roundMoney(totalInvoiced),
      totalPaid: roundMoney(totalPaid),
      currency: 'ILS',
      entries: withBalance,
      payments: payments.map((p) => ({
        id: p.id,
        number: p.number,
        amount: String(p.amount),
        method: p.method,
        paymentDate: p.paymentDate.toISOString(),
        referenceNumber: p.referenceNumber,
        bank: p.bank,
        notes: p.notes,
      })),
    };
  }
}
