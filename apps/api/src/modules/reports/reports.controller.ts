import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';

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

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('report.sales.read')
  dashboard() {
    return this.reports.dashboard();
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

  @Get('production-summary')
  @RequirePermissions('production-order.read')
  productionSummary() {
    return this.reports.productionSummary();
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
