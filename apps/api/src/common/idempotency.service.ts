import { Injectable } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from './prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T = unknown>(scope: string, key: string): Promise<T | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    if (!row) return null;
    return row.response as T;
  }

  async put(params: {
    scope: string;
    key: string;
    userId?: string;
    entityId?: string;
    response: unknown;
  }) {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          scope: params.scope,
          key: params.key,
          userId: params.userId,
          entityId: params.entityId,
          response: params.response as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Concurrent duplicate insert — treat as success; caller should re-get.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  }

  /** Get-or-run: if key exists return cached; else run factory, store, return. */
  async once<T>(
    scope: string,
    key: string | undefined,
    meta: { userId?: string; entityId?: string },
    factory: () => Promise<T>,
  ): Promise<{ result: T; replayed: boolean }> {
    if (!key) {
      return { result: await factory(), replayed: false };
    }
    const cached = await this.get<T>(scope, key);
    if (cached != null) {
      return { result: cached, replayed: true };
    }
    const result = await factory();
    await this.put({
      scope,
      key,
      userId: meta.userId,
      entityId: meta.entityId,
      response: result as unknown,
    });
    return { result, replayed: false };
  }
}
