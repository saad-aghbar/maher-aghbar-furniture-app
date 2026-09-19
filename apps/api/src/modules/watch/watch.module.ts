import { Module } from '@nestjs/common';
import { QualityModule } from '../quality/quality.module';
import { ReportsModule } from '../reports/reports.module';
import { WatchController } from './watch.controller';
import { WatchService } from './watch.service';

@Module({
  imports: [ReportsModule, QualityModule],
  controllers: [WatchController],
  providers: [WatchService],
})
export class WatchModule {}
