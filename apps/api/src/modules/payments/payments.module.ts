import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StatementsController } from './statements.controller';

@Module({
  controllers: [PaymentsController, StatementsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
