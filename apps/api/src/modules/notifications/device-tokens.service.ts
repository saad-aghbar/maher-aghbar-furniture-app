import { Injectable } from '@nestjs/common';
import { Prisma } from '@maher/database';
import {
  canReleaseDeviceToken,
  nextDeviceTokenBinding,
  type DeviceOsPermission,
} from '@maher/notifications';
import { PrismaService } from '../../common/prisma.service';

export type RegisterDeviceInput = {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  osPermission?: DeviceOsPermission | null;
  pushEnabled?: boolean;
  deviceId?: string | null;
};

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDeviceInput) {
    const token = input.token.trim();
    const existing = await this.prisma.devicePushToken.findUnique({
      where: { token },
      select: { id: true, userId: true },
    });
    const binding = nextDeviceTokenBinding({
      existingUserId: existing?.userId ?? null,
      incomingUserId: input.userId,
    });
    const data = {
      userId: input.userId,
      platform: input.platform,
      osPermission: input.osPermission ?? undefined,
      pushEnabled: input.pushEnabled ?? true,
      deviceId: input.deviceId ?? undefined,
      lastSeenAt: new Date(),
      disabledAt: null,
      failedCount: 0,
    };
    if (binding.action === 'create' || !existing) {
      try {
        return await this.prisma.devicePushToken.create({
          data: { token, ...data },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return this.prisma.devicePushToken.update({
            where: { token },
            data,
          });
        }
        throw err;
      }
    }
    return this.prisma.devicePushToken.update({
      where: { token },
      data,
    });
  }

  async release(userId: string, token: string) {
    const row = await this.prisma.devicePushToken.findUnique({
      where: { token: token.trim() },
      select: { userId: true },
    });
    if (!canReleaseDeviceToken({ tokenUserId: row?.userId ?? null, requesterUserId: userId })) {
      return { ok: true as const, released: false };
    }
    await this.prisma.devicePushToken.deleteMany({
      where: { token: token.trim(), userId },
    });
    return { ok: true as const, released: true };
  }

  async setPushEnabled(userId: string, token: string, pushEnabled: boolean) {
    await this.prisma.devicePushToken.updateMany({
      where: { token: token.trim(), userId, disabledAt: null },
      data: { pushEnabled, lastSeenAt: new Date() },
    });
  }

  async disableToken(token: string, reason?: string) {
    await this.prisma.devicePushToken.updateMany({
      where: { token },
      data: {
        disabledAt: new Date(),
        failedCount: { increment: 1 },
      },
    });
    return reason;
  }

  async disableAllForUser(userId: string) {
    await this.prisma.devicePushToken.updateMany({
      where: { userId, disabledAt: null },
      data: { disabledAt: new Date() },
    });
  }

  async listDeliverable(userId: string) {
    return this.prisma.devicePushToken.findMany({
      where: {
        userId,
        pushEnabled: true,
        disabledAt: null,
        OR: [{ osPermission: null }, { osPermission: 'granted' }],
      },
    });
  }

  async getForUser(userId: string, token?: string | null) {
    if (!token) return null;
    return this.prisma.devicePushToken.findFirst({
      where: { userId, token: token.trim() },
    });
  }
}
