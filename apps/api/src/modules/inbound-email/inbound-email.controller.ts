import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { InboundEmailService, InboundEmailWebhookDto } from './inbound-email.service';

@ApiTags('webhooks')
@Controller('webhooks/inbound-email')
export class InboundEmailController {
  constructor(private readonly inbound: InboundEmailService) {}

  /** Stub webhook for inbound RFQ emails (SendGrid/Mailgun/etc. can POST here). */
  @Public()
  @Post()
  receive(@Headers() headers: Record<string, string | string[] | undefined>, @Body() body: InboundEmailWebhookDto) {
    this.inbound.assertWebhookSecret(headers);
    return this.inbound.processInboundEmail(body);
  }
}
