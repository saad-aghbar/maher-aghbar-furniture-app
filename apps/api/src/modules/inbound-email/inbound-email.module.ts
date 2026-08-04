import { Module } from '@nestjs/common';
import { AiIntakeModule } from '../ai-intake/ai-intake.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InboundEmailController } from './inbound-email.controller';
import { InboundEmailService } from './inbound-email.service';

@Module({
  imports: [AiIntakeModule, NotificationsModule],
  controllers: [InboundEmailController],
  providers: [InboundEmailService],
  exports: [InboundEmailService],
})
export class InboundEmailModule {}
