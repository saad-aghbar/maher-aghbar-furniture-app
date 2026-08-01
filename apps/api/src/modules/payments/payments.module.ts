import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StatementsController } from './statements.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController, StatementsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
