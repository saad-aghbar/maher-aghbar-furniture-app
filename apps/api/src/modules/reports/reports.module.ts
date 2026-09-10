import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { CostPerformanceService } from './cost-performance.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, CostPerformanceService],
  exports: [ReportsService, CostPerformanceService],
})
export class ReportsModule {}
