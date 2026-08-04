import { Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import {
  InboundWhatsAppService,
  InboundWhatsAppWebhookDto,
} from './inbound-whatsapp.service';

@ApiTags('webhooks')
@Controller('webhooks/inbound-whatsapp')
export class InboundWhatsAppController {
  constructor(private readonly inbound: InboundWhatsAppService) {}

  /** Meta Cloud API subscription verification. */
  @Public()
  @Get()
  verify(
    @Query()
    query: {
      'hub.mode'?: string;
      'hub.verify_token'?: string;
      'hub.challenge'?: string;
    },
    @Res() res: Response,
  ) {
    const challenge = this.inbound.verifyMetaSubscription(query);
    res.status(200).send(challenge);
  }

  /**
   * Inbound WhatsApp RFQ webhook.
   * Accepts either our simplified JSON body or a Meta Cloud API payload.
   */
  @Public()
  @Post()
  async receive(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: InboundWhatsAppWebhookDto | Record<string, unknown>,
  ) {
    this.inbound.assertWebhookSecret(headers);

    const simplified =
      body && typeof body === 'object' && 'from' in body && typeof (body as { from: unknown }).from === 'string'
        ? (body as InboundWhatsAppWebhookDto)
        : this.inbound.extractFromMetaPayload(body as Record<string, unknown>);

    if (!simplified) {
      return { ok: true, skipped: true, reason: 'NO_MESSAGE' };
    }

    return this.inbound.processInboundWhatsApp(simplified);
  }
}
