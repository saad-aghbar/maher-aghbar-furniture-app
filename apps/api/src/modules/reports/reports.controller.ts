import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request, Response } from 'express';
import { buildSimplePdf, parsePdfQuery, sendPdf, type PdfLocale, type PdfTheme } from '../../common/helpers/pdf.util';
import { EXPORT_FILENAMES, exportLabel, periodMeta, type ReportExportDataset, type ReportExportName } from './report-exports';
import type { AuthUser } from '@maher/types';
import { ReportsService } from './reports.service';
import { CostPerformanceService } from './cost-performance.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class SalesReportQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() salesRepId?: string;
}

class PeriodReportQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsUUID() customerId?: string;
}

class CostOrdersQueryDto extends PeriodReportQueryDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsOptional() @IsUUID() optionValueId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() dateBasis?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() complexity?: string;
  @IsOptional() @IsString() delivered?: string;
  @IsOptional() @IsString() hasReturn?: string;
  @IsOptional() @IsString() hasRework?: string;
  @IsOptional() @IsString() coverage?: string;
  @IsOptional() @IsString() marginHealth?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsString() lifecycle?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
}

class CreateLaborRateDto {
  @IsOptional() @IsUUID() stageDefinitionId?: string;
  @IsOptional() @IsUUID() userId?: string;
  @Type(() => Number) @IsNumber() @Min(0.001) hourlyRate!: number;
  @IsString() effectiveFrom!: string;
  @IsOptional() @IsString() effectiveTo?: string;
}

class ExportFormatQuery {
  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  theme?: string;
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly costPerformance: CostPerformanceService,
  ) {}

  @Get('dashboard')
  @RequirePermissions('report.sales.read')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('admin-home')
  @RequirePermissions('report.sales.read')
  adminHome(@CurrentUser() user: AuthUser) {
    return this.reports.adminHome(user);
  }

  /**
   * Piece 12 management desk aggregate.
   * Chosen path: GET /api/v1/reports/management-summary
   * (plan also allowed /management/summary — reports route reuses existing module wiring)
   */
  @Get('management-summary')
  @RequirePermissions('report.sales.read')
  managementSummary(@CurrentUser() user: AuthUser) {
    return this.reports.managementSummary(user);
  }

  @Get('dealer-home')
  @RequirePermissions('sales-order.read')
  dealerHome(@CurrentUser() user: AuthUser) {
    return this.reports.dealerHome(user);
  }

  @Get('worker-home')
  @RequirePermissions('production-task.read')
  workerHome(@CurrentUser() user: AuthUser, @Req() req: { headers?: Record<string, string | string[] | undefined> }) {
    const accept = req.headers?.['accept-language'];
    const header = Array.isArray(accept) ? accept[0] : accept;
    const localeOverride = header?.split(',')[0]?.trim().split('-')[0] ?? null;
    return this.reports.workerHome(user, localeOverride);
  }

  @Get('sales')
  @RequirePermissions('report.sales.read')
  sales(@Query() query: SalesReportQueryDto) {
    return this.reports.sales(query);
  }

  @Get('production')
  @RequirePermissions('report.production.read')
  production(@Query() query: PeriodReportQueryDto) {
    return this.reports.production(query);
  }

  @Get('order-profit')
  @RequirePermissions('report.financial.read')
  orderProfit(@Query() query: PeriodReportQueryDto) {
    return this.reports.orderProfit(query);
  }

  @Get('productivity')
  @RequirePermissions('report.production.read')
  productivity(@Query() query: PeriodReportQueryDto) {
    return this.reports.productivity(query);
  }

  @Get('ap-ledger')
  @RequirePermissions('report.financial.read')
  apLedger(@Query() query: PeriodReportQueryDto) {
    return this.reports.apLedger(query);
  }

  @Get('period-pl')
  @RequirePermissions('report.financial.read')
  periodPl(@Query() query: PeriodReportQueryDto) {
    return this.reports.periodPl(query);
  }

  @Get('cash-flow')
  @RequirePermissions('report.financial.read')
  cashFlow(@Query() query: PeriodReportQueryDto) {
    return this.reports.cashFlow(query);
  }

  @Get('production-summary')
  @RequirePermissions('production-order.read')
  productionSummary(
    @Query('origin') origin?: string,
    @Query('complexity') complexity?: string,
    @Query('customerId') customerId?: string,
  ) {
    const parsed = origin === 'normal' || origin === 'returned' ? origin : undefined;
    const complexityParsed =
      complexity === 'STANDARD' || complexity === 'MODIFIED' || complexity === 'CUSTOM'
        ? complexity
        : undefined;
    return this.reports.productionSummary(parsed, {
      complexity: complexityParsed,
      customerId: customerId?.trim() || undefined,
    });
  }

  @Get('inventory')
  @RequirePermissions('report.inventory.read')
  inventory() {
    return this.reports.inventory();
  }

  @Get('financial')
  @RequirePermissions('report.financial.read')
  financial() {
    return this.reports.financial();
  }

  @Get('purchasing')
  @RequirePermissions('report.inventory.read')
  purchasing() {
    return this.reports.purchasing();
  }

  /** One dataset per export; served as CSV or as a branded PDF. */
  private async exportDataset(name: ReportExportName, query: PeriodReportQueryDto & SalesReportQueryDto, locale: PdfLocale): Promise<ReportExportDataset> {
    switch (name) {
      case 'sales': {
        const data = await this.reports.sales(query);
        return { name, columns: ['customer', 'orders', 'total'], meta: periodMeta(query, locale), rows: data.topCustomers.map((c) => ({ customer: c.customerName, orders: c.orderCount, total: c.total })) };
      }
      case 'order-profit': {
        const data = await this.reports.orderProfit(query);
        return {
          name,
          columns: ['number', 'customer', 'sellerPrice', 'productionPrice', 'profit', 'marginPercent', 'status', 'orderDate'],
          meta: periodMeta(query, locale),
          rows: data.orders.map((o) => ({ number: o.number, customer: o.customerName, sellerPrice: o.sellerPrice, productionPrice: o.productionPrice, profit: o.profit, marginPercent: o.marginPercent, status: o.status, orderDate: o.orderDate.slice(0, 10) })),
        };
      }
      case 'ap-ledger': {
        const data = await this.reports.apLedger(query);
        return {
          name,
          columns: ['number', 'supplier', 'purchaseOrder', 'dueDate', 'outstanding', 'daysPastDue', 'status'],
          meta: periodMeta(query, locale),
          rows: data.openInvoices.map((i) => ({ number: i.number, supplier: i.supplierName, purchaseOrder: i.purchaseOrderNumber, dueDate: i.dueDate?.slice(0, 10) ?? '', outstanding: i.outstanding, daysPastDue: i.daysPastDue, status: i.status })),
        };
      }
      case 'period-pl': {
        const data = await this.reports.periodPl(query);
        const t = data.totals;
        return {
          name,
          columns: ['revenueOrders', 'revenueInvoiced', 'materialCogs', 'reworkCost', 'replacementCost', 'recoveredValue', 'scrapValue', 'returnWriteOff', 'supplierSpend', 'laborHours', 'laborCost', 'laborRateJod', 'grossProfit', 'contribution', 'orderCount'],
          meta: periodMeta(query, locale),
          rows: [{ revenueOrders: t.revenueOrders, revenueInvoiced: t.revenueInvoiced, materialCogs: t.materialCogs, reworkCost: t.reworkCost, replacementCost: t.replacementCost, recoveredValue: t.recoveredValue, scrapValue: t.scrapValue, returnWriteOff: t.returnWriteOff, supplierSpend: t.supplierSpend, laborHours: t.laborHours, laborCost: t.laborCost, laborRateJod: data.laborRateJod, grossProfit: t.grossProfit, contribution: t.contribution, orderCount: t.orderCount }],
        };
      }
      case 'cash-flow': {
        const data = await this.reports.cashFlow(query);
        const rows = [
          ...data.recentInflows.map((r) => ({ direction: 'IN', number: r.number, party: r.party, method: r.method, amount: r.amount, date: r.date.slice(0, 10) })),
          ...data.recentOutflows.map((r) => ({ direction: 'OUT', number: r.number, party: r.party, method: r.method, amount: r.amount, date: r.date.slice(0, 10) })),
        ];
        return { name, columns: ['direction', 'number', 'party', 'method', 'amount', 'date'], meta: periodMeta(query, locale), rows };
      }
      case 'financial': {
        const data = await this.reports.financial();
        return { name, columns: ['number', 'customer', 'dueDate', 'outstanding'], meta: periodMeta({}, locale), rows: data.openInvoices.map((i) => ({ number: i.number, customer: i.customer, dueDate: i.dueDate ? new Date(i.dueDate as unknown as string).toISOString().slice(0, 10) : '', outstanding: Number(i.outstanding) })) };
      }
    }
  }

  private sendExportCsv(res: Response, dataset: ReportExportDataset, locale: PdfLocale) {
    const headers = dataset.columns.map((c) => exportLabel(c, locale));
    const csv = dataset.rows.length ? this.reports.toCsv(dataset.rows.map((row) => Object.fromEntries(dataset.columns.map((c, i) => [headers[i]!, row[c] ?? ''])))) : headers.join(',');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${EXPORT_FILENAMES[dataset.name]}.csv"`);
    res.send(`\ufeff${csv}`);
  }

  private async sendExportPdf(res: Response, dataset: ReportExportDataset, locale: PdfLocale, theme: PdfTheme) {
    const buffer = await buildSimplePdf({
      locale,
      theme,
      title: exportLabel(dataset.name, locale),
      subtitle: `${exportLabel('rows', locale)}: ${dataset.rows.length}`,
      meta: dataset.meta,
      columns: dataset.columns.map((c) => exportLabel(c, locale)),
      rows: dataset.rows.map((row) => dataset.columns.map((c) => (row[c] == null ? '' : typeof row[c] === 'number' ? String(Math.round((row[c] as number) * 100) / 100) : String(row[c])))),
    });
    sendPdf(res, `${EXPORT_FILENAMES[dataset.name]}.pdf`, buffer);
  }

  private async serveExport(name: ReportExportName, format: 'csv' | 'pdf', query: PeriodReportQueryDto & SalesReportQueryDto & { lang?: string; theme?: string }, req: Request, res: Response) {
    const { locale, theme } = parsePdfQuery({ lang: query.lang, theme: query.theme, acceptLanguage: req.headers['accept-language'] });
    const dataset = await this.exportDataset(name, query, locale);
    if (format === 'csv') return this.sendExportCsv(res, dataset, locale);
    return this.sendExportPdf(res, dataset, locale, theme);
  }

  @Get('export/sales.csv')
  @RequirePermissions('report.sales.read')
  exportSales(@Query() query: SalesReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('sales', 'csv', query, req, res);
  }

  @Get('export/sales.pdf')
  @RequirePermissions('report.sales.read')
  exportSalesPdf(@Query() query: SalesReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('sales', 'pdf', query, req, res);
  }

  @Get('export/order-profit.csv')
  @RequirePermissions('report.financial.read')
  exportOrderProfit(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('order-profit', 'csv', query, req, res);
  }

  @Get('export/order-profit.pdf')
  @RequirePermissions('report.financial.read')
  exportOrderProfitPdf(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('order-profit', 'pdf', query, req, res);
  }

  @Get('export/ap-ledger.csv')
  @RequirePermissions('report.financial.read')
  exportApLedger(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('ap-ledger', 'csv', query, req, res);
  }

  @Get('export/ap-ledger.pdf')
  @RequirePermissions('report.financial.read')
  exportApLedgerPdf(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('ap-ledger', 'pdf', query, req, res);
  }

  @Get('export/period-pl.csv')
  @RequirePermissions('report.financial.read')
  exportPeriodPl(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('period-pl', 'csv', query, req, res);
  }

  @Get('export/period-pl.pdf')
  @RequirePermissions('report.financial.read')
  exportPeriodPlPdf(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('period-pl', 'pdf', query, req, res);
  }

  @Get('export/cash-flow.csv')
  @RequirePermissions('report.financial.read')
  exportCashFlow(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('cash-flow', 'csv', query, req, res);
  }

  @Get('export/cash-flow.pdf')
  @RequirePermissions('report.financial.read')
  exportCashFlowPdf(@Query() query: PeriodReportQueryDto & ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('cash-flow', 'pdf', query, req, res);
  }

  @Get('cost/money')
  @RequirePermissions('inventory.cost.read')
  costMoney(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.moneyDesk({ ...query, user });
  }

  @Get('cost/orders')
  @RequirePermissions('inventory.cost.read')
  costOrders(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.listOrders({ ...query, user });
  }

  @Get('cost/orders/:id')
  @RequirePermissions('inventory.cost.read')
  costOrderDossier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.costPerformance.dossier(id, user);
  }

  @Get('cost/returns')
  @RequirePermissions('inventory.cost.read')
  costReturns(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.listReturns({ ...query, user });
  }

  @Get('cost/returns/:id')
  @RequirePermissions('inventory.cost.read')
  costReturnDossier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.costPerformance.returnDossier(id, user);
  }

  @Get('cost/custom-work')
  @RequirePermissions('inventory.cost.read')
  costCustomWork(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.customWork({ ...query, user });
  }

  @Get('cost/products/:productId/variants/:variantId')
  @RequirePermissions('inventory.cost.read')
  costVariantProfile(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Query() query: CostOrdersQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costPerformance.variantProfile(productId, variantId, { ...query, user });
  }

  @Get('cost/products/:productId')
  @RequirePermissions('inventory.cost.read')
  costProductProfile(
    @Param('productId') productId: string,
    @Query() query: CostOrdersQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costPerformance.productProfile(productId, { ...query, user });
  }

  @Get('cost/products')
  @RequirePermissions('inventory.cost.read')
  costProducts(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.productAnalytics(user, query);
  }

  @Get('cost/inventory/summary')
  @RequirePermissions('inventory.cost.read')
  costInventorySummary(@CurrentUser() user: AuthUser) {
    return this.costPerformance.inventorySummary(user);
  }

  @Get('cost/inventory/flow')
  @RequirePermissions('inventory.cost.read')
  costInventoryFlow(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.inventoryFlow({ ...query, user });
  }

  @Get('cost/inventory/items/:id')
  @RequirePermissions('inventory.cost.read')
  costInventoryItem(
    @Param('id') id: string,
    @Query() query: CostOrdersQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costPerformance.inventoryItemDetail(id, { ...query, user });
  }

  @Get('cost/inventory/items')
  @RequirePermissions('inventory.cost.read')
  costInventoryItems(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.inventoryItems({ ...query, user });
  }

  @Get('cost/coverage/issues')
  @RequirePermissions('inventory.cost.read')
  costCoverageIssues(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.coverageIssues({ ...query, user });
  }

  @Get('cost/coverage')
  @RequirePermissions('inventory.cost.read')
  costCoverage(@Query() query: CostOrdersQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.costCoverage(user, query);
  }

  @Post('cost/coverage/backfill')
  @RequirePermissions('inventory.cost.read')
  backfillCoverage(@CurrentUser() user: AuthUser) {
    return this.costPerformance.backfillPricesFromReceipts(user);
  }

  @Get('cost/labor-rates')
  @RequirePermissions('inventory.cost.read')
  laborRates(@CurrentUser() user: AuthUser) {
    return this.costPerformance.listLaborRates(user);
  }

  @Get('cost/labor')
  @RequirePermissions('inventory.cost.read')
  laborActuals(@Query() query: PeriodReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.listLaborActuals({ ...query, user });
  }

  @Post('cost/labor-rates')
  @RequirePermissions('inventory.cost.read')
  createLaborRate(@Body() body: CreateLaborRateDto, @CurrentUser() user: AuthUser) {
    return this.costPerformance.createLaborRate(body, user);
  }

  @Get('export/financial.csv')
  @RequirePermissions('report.financial.read')
  exportFinancial(@Query() query: ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('financial', 'csv', query as PeriodReportQueryDto & SalesReportQueryDto & ExportFormatQuery, req, res);
  }

  @Get('export/financial.pdf')
  @RequirePermissions('report.financial.read')
  exportFinancialPdf(@Query() query: ExportFormatQuery, @Req() req: Request, @Res() res: Response) {
    return this.serveExport('financial', 'pdf', query as PeriodReportQueryDto & SalesReportQueryDto & ExportFormatQuery, req, res);
  }
}
