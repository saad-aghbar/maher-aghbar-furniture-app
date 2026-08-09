import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SequenceService } from './sequence.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  providers: [PrismaService, SequenceService, IdempotencyService],
  exports: [PrismaService, SequenceService, IdempotencyService],
})
export class PrismaModule {}
