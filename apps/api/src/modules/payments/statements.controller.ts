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
import {
  buildStatementLedger,
  money,
  summarizeDealerFinance,
} from './dealer-finance';

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
    @Query('from') from?: string,
    @Query('to') to?: string,
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
    const statement = await this.buildStatement(customerId, user, { from, to, asOf }, locale);
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.statementOfAccount,
      subtitle: statement.customer.name,
      meta: [
        `${m.asOf}: ${statement.asOf.slice(0, 10)}`,
        `Opening: ${statement.openingBalance} ${statement.currency}`,
        `${m.closing}: ${statement.closingBalance} ${statement.currency}`,
        `Amount due: ${statement.amountDue} ${statement.currency}`,
        `Account credit: ${statement.availableCredit} ${statement.currency}`,
      ],
      columns: [m.date, m.ref, m.description, m.debit, m.credit, m.balance],
      rows: statement.entries.map((e) => [
        e.date.slice(0, 10),
        e.reference,
        e.description,
        String(e.debit),
        String(e.credit),
        String(e.runningBalance),
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
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.buildStatement(customerId, user, { from, to, asOf }, 'en');
  }

  private async buildStatement(
    customerId: string,
    user: AuthUser,
    range: { from?: string; to?: string; asOf?: string },
    locale: import('../../common/helpers/pdf.util').PdfLocale,
  ) {
    this.assertAccess(user, customerId);
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
    });
    const asOfDate = range.asOf ? new Date(range.asOf) : new Date();
    const from = range.from ? new Date(range.from) : null;
    const to = range.to
      ? new Date(range.to)
      : range.asOf
        ? asOfDate
        : null;

    const invoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        archivedAt: null,
        status: { notIn: ['CANCELLED', 'VOID'] },
      },
      orderBy: { invoiceDate: 'asc' },
    });
    const payments = await this.prisma.payment.findMany({
      where: { customerId },
      include: { allocations: true },
      orderBy: { paymentDate: 'asc' },
    });

    const ledger = buildStatementLedger({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        invoiceDate: inv.invoiceDate,
        total: inv.total,
        status: inv.status,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        number: p.number,
        paymentDate: p.paymentDate,
        amount: p.amount,
      })),
      from,
      to: to ?? asOfDate,
    });

    const finance = summarizeDealerFinance({
      invoices,
      payments: payments.map((p) => ({
        amount: p.amount,
        allocations: p.allocations,
      })),
      currency: invoices[0]?.currency ?? 'ILS',
    });

    const displayName = localizedName(locale, customer);
    const m = pdfMessages(locale);

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: displayName || customer.name,
      },
      asOf: asOfDate.toISOString(),
      from: from?.toISOString() ?? null,
      to: (to ?? asOfDate).toISOString(),
      openingBalance: roundMoney(ledger.openingBalance),
      closingBalance: roundMoney(ledger.closingBalance),
      /** @deprecated prefer amountDue / availableCredit */
      outstandingBalance: roundMoney(finance.netPosition),
      amountDue: finance.amountDue,
      availableCredit: finance.availableCredit,
      openInvoiceCount: finance.openInvoiceCount,
      overdueAmount: finance.overdueAmount,
      totalInvoiced: roundMoney(ledger.totalInvoiced),
      totalPaid: roundMoney(ledger.totalPaid),
      currency: finance.currency,
      entries: ledger.entries.map((e) => ({
        ...e,
        debit: roundMoney(e.debit),
        credit: roundMoney(e.credit),
        balance: roundMoney(e.runningBalance),
        description:
          e.type === 'INVOICE'
            ? `${m.invoice} ${e.reference}`
            : `${m.paymentReceipt} ${e.reference}`,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        number: p.number,
        amount: String(p.amount),
        method: p.method,
        paymentDate: p.paymentDate.toISOString(),
        referenceNumber: p.referenceNumber,
        bank: p.bank,
        notes: p.notes,
        unallocatedAmount: money(p.amount) - p.allocations.reduce((s, a) => s + money(a.amount), 0),
      })),
    };
  }
}
