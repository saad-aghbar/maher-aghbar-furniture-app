import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PurchasingService } from './purchasing.service';

@ApiTags('webhooks')
@Controller('webhooks/low-stock-pr')
export class LowStockPrWebhookController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Public()
  @Post()
  async tick(@Headers() headers: Record<string, string | string[] | undefined>) {
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
    const created = await this.purchasing.createFromLowStock({
      reason: 'AUTO_REORDER',
      requireEnabled: true,
      throwIfEmpty: false,
    });
    return { ok: true, created };
  }
}
