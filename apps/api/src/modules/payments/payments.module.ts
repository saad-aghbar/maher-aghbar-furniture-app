import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StatementsController } from './statements.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => InvoicesModule)],
  controllers: [PaymentsController, StatementsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
