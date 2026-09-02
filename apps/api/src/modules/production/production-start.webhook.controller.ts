import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';

/**
 * Former day-tick auto-promote webhook.
 * Phase A hard rule: planned production date must NEVER flip Ready → In Production.
 * Kept as a no-op so old worker polls do not 404; returns promoted: 0 always.
 */
@ApiTags('webhooks')
@Controller('webhooks/production-start')
export class ProductionStartWebhookController {
  @Public()
  @Post()
  tick(@Headers() headers: Record<string, string | string[] | undefined>) {
    const secret = process.env.WORKER_SECRET ?? process.env.EMAIL_INBOUND_WEBHOOK_SECRET ?? '';
    const provided =
      typeof headers['x-worker-secret'] === 'string'
        ? headers['x-worker-secret']
        : Array.isArray(headers['x-worker-secret'])
          ? headers['x-worker-secret'][0]
          : '';
    if (!secret || provided !== secret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid worker secret.',
      });
    }
    return { ok: true as const, scanned: 0, promoted: 0, disabled: true as const };
  }
}
