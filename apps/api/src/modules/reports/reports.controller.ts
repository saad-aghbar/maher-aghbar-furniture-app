import { Body, Controller, Get, Header, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
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

  @Get('export/sales.csv')
  @RequirePermissions('report.sales.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportSales(@Query() query: SalesReportQueryDto, @Res() res: Response) {
    const data = await this.reports.sales(query);
    const csv = this.reports.toCsv(
      data.topCustomers.map((c) => ({
        customer: c.customerName,
        orders: c.orderCount,
        total: c.total,
      })),
    );
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
    res.send(csv);
  }

  @Get('export/order-profit.csv')
  @RequirePermissions('report.financial.read')
  async exportOrderProfit(@Query() query: PeriodReportQueryDto, @Res() res: Response) {
    const data = await this.reports.orderProfit(query);
    const csv = this.reports.toCsv(
      data.orders.map((o) => ({
        number: o.number,
        customer: o.customerName,
        sellerPrice: o.sellerPrice,
        productionPrice: o.productionPrice,
        profit: o.profit,
        marginPercent: o.marginPercent,
        status: o.status,
        orderDate: o.orderDate.slice(0, 10),
      })),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="order-profit.csv"');
    res.send(csv);
  }

  @Get('export/ap-ledger.csv')
  @RequirePermissions('report.financial.read')
  async exportApLedger(@Query() query: PeriodReportQueryDto, @Res() res: Response) {
    const data = await this.reports.apLedger(query);
    const csv = this.reports.toCsv(
      data.openInvoices.map((i) => ({
        number: i.number,
        supplier: i.supplierName,
        purchaseOrder: i.purchaseOrderNumber,
        dueDate: i.dueDate?.slice(0, 10) ?? '',
        outstanding: i.outstanding,
        daysPastDue: i.daysPastDue,
        status: i.status,
      })),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ap-ledger.csv"');
    res.send(csv);
  }

  @Get('export/period-pl.csv')
  @RequirePermissions('report.financial.read')
  async exportPeriodPl(@Query() query: PeriodReportQueryDto, @Res() res: Response) {
    const data = await this.reports.periodPl(query);
    const csv = this.reports.toCsv([
      {
        revenueOrders: data.totals.revenueOrders,
        revenueInvoiced: data.totals.revenueInvoiced,
        materialCogs: data.totals.materialCogs,
        reworkCost: data.totals.reworkCost,
        replacementCost: data.totals.replacementCost,
        recoveredValue: data.totals.recoveredValue,
        scrapValue: data.totals.scrapValue,
        returnWriteOff: data.totals.returnWriteOff,
        supplierSpend: data.totals.supplierSpend,
        laborHours: data.totals.laborHours,
        laborCost: data.totals.laborCost,
        laborRateJod: data.laborRateJod,
        grossProfit: data.totals.grossProfit,
        contribution: data.totals.contribution,
        orderCount: data.totals.orderCount,
      },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="period-pl.csv"');
    res.send(csv);
  }

  @Get('export/cash-flow.csv')
  @RequirePermissions('report.financial.read')
  async exportCashFlow(@Query() query: PeriodReportQueryDto, @Res() res: Response) {
    const data = await this.reports.cashFlow(query);
    const rows = [
      ...data.recentInflows.map((r) => ({
        direction: 'IN',
        number: r.number,
        party: r.party,
        method: r.method,
        amount: r.amount,
        date: r.date.slice(0, 10),
      })),
      ...data.recentOutflows.map((r) => ({
        direction: 'OUT',
        number: r.number,
        party: r.party,
        method: r.method,
        amount: r.amount,
        date: r.date.slice(0, 10),
      })),
    ];
    const csv = this.reports.toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cash-flow.csv"');
    res.send(csv);
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
  async exportFinancial(@Res() res: Response) {
    const data = await this.reports.financial();
    const csv = this.reports.toCsv(
      data.openInvoices.map((i) => ({
        number: i.number,
        customer: i.customer,
        dueDate: i.dueDate,
        outstanding: i.outstanding,
      })),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="financial-aging.csv"');
    res.send(csv);
  }
}
