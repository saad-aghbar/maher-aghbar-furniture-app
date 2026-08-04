import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ContractsController } from './contracts.controller';
import { ReturnsController } from './returns.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [ContractsController, ReturnsController],
})
export class ContractsModule {}
