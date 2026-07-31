import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ReturnsController } from './returns.controller';

@Module({
  controllers: [ContractsController, ReturnsController],
})
export class ContractsModule {}
