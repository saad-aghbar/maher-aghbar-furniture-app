import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class RegisterDeviceTokenDto {
  @IsString()
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('templates')
  @RequirePermissions('notification.read')
  listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { code: 'asc' } });
  }

  @Get()
  @RequirePermissions('notification.read')
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Post('device-token')
  @RequirePermissions('notification.read')
  async registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.devicePushToken.upsert({
      where: { userId_token: { userId: user.id, token: dto.token } },
      create: {
        userId: user.id,
        token: dto.token,
        platform: dto.platform,
      },
      update: { platform: dto.platform },
    });
    return { ok: true, id: row.id };
  }

  @Post('read-all')
  @RequirePermissions('notification.read')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Post(':id/read')
  @RequirePermissions('notification.read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
