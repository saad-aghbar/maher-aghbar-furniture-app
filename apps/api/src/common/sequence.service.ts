import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(key: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const row = await this.prisma.sequenceCounter.upsert({
      where: { key_year: { key, year } },
      create: { key, year, current: 1 },
      update: { current: { increment: 1 } },
    });
    return `${prefix}-${year}-${String(row.current).padStart(5, '0')}`;
  }
}
