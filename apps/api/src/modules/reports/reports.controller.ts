import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';

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
  sales() {
    return this.reports.sales();
  }

  @Get('production')
  @RequirePermissions('report.production.read')
  production() {
    return this.reports.production();
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
  async exportSales(@Res() res: Response) {
    const data = await this.reports.sales();
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
