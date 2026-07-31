import { Module } from '@nestjs/common';
import { QualityController } from './quality.controller';

@Module({
  controllers: [QualityController],
})
export class QualityModule {}
