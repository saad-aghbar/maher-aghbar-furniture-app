import { Module } from '@nestjs/common';
import { AiIntakeModule } from '../ai-intake/ai-intake.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InboundWhatsAppController } from './inbound-whatsapp.controller';
import { InboundWhatsAppService } from './inbound-whatsapp.service';

@Module({
  imports: [AiIntakeModule, NotificationsModule],
  controllers: [InboundWhatsAppController],
  providers: [InboundWhatsAppService],
  exports: [InboundWhatsAppService],
})
export class InboundWhatsAppModule {}
