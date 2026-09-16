import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { AuthUser } from '@maher/types';
import {
  TOPIC_GROUP_LABELS,
  TOPICS,
  canPauseAllDevices,
  eligibleTopicsForUser,
  getTopic,
  pickLocaleCopy,
  type PushLocale,
} from '@maher/notifications';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeviceTokensService } from './device-tokens.service';

class RegisterDeviceTokenDto {
  @IsString()
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsIn(['granted', 'denied', 'undetermined'])
  osPermission?: 'granted' | 'denied' | 'undetermined';

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

class ReleaseDeviceTokenDto {
  @IsString()
  token!: string;
}

class DevicePrefDto {
  @IsString()
  token!: string;

  @IsBoolean()
  pushEnabled!: boolean;
}

class PutPreferencesDto {
  @IsOptional()
  @IsBoolean()
  masterEnabled?: boolean;

  @IsOptional()
  @IsObject()
  topics?: Record<string, boolean>;

  @IsOptional()
  @ValidateNested()
  @Type(() => DevicePrefDto)
  device?: DevicePrefDto;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DeviceTokensService,
  ) {}

  @Get('templates')
  @RequirePermissions('notification.read')
  listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { code: 'asc' } });
  }

  @Get('topics')
  @RequirePermissions('notification.read')
  async listTopics(
    @CurrentUser() user: AuthUser,
    @Query('token') token?: string,
  ) {
    const eligible = eligibleTopicsForUser(user, TOPICS);
    const locale = (user.preferredLanguage ?? 'ar') as PushLocale;
    const prefs = await this.prisma.userNotificationPreference.findMany({
      where: { userId: user.id, topic: { in: eligible.map((t) => t.code) } },
    });
    const prefByTopic = new Map(prefs.map((p) => [p.topic, p.enabled]));
    const settings = await this.prisma.userPushSettings.findUnique({
      where: { userId: user.id },
    });
    const device = await this.devices.getForUser(user.id, token);
    const pauseAll = canPauseAllDevices(user);
    return {
      canPauseAllDevices: pauseAll,
      masterEnabled: pauseAll ? (settings?.masterEnabled ?? true) : true,
      device: device
        ? {
            token: device.token,
            pushEnabled: device.pushEnabled,
            osPermission: device.osPermission,
            platform: device.platform,
          }
        : null,
      groups: [...new Set(eligible.map((t) => t.group))].map((group) => ({
        id: group,
        name: pickLocaleCopy(TOPIC_GROUP_LABELS[group], locale),
      })),
      topics: eligible.map((topic) => ({
        code: topic.code,
        group: topic.group,
        name: pickLocaleCopy(topic.name, locale),
        hint: pickLocaleCopy(topic.hint, locale),
        urgency: topic.urgency,
        defaultOn: topic.defaultOn,
        enabled: prefByTopic.has(topic.code) ? prefByTopic.get(topic.code)! : topic.defaultOn,
      })),
    };
  }

  @Put('preferences')
  @RequirePermissions('notification.read')
  async putPreferences(@Body() dto: PutPreferencesDto, @CurrentUser() user: AuthUser) {
    const eligible = new Set(eligibleTopicsForUser(user, TOPICS).map((t) => t.code));
    if (dto.masterEnabled != null) {
      if (!canPauseAllDevices(user)) {
        throw new ForbiddenException({
          code: 'MASTER_PAUSE_NOT_ALLOWED',
          message: 'Pause on every device is only available to system administrators.',
        });
      }
      await this.prisma.userPushSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, masterEnabled: dto.masterEnabled },
        update: { masterEnabled: dto.masterEnabled },
      });
    }
    if (dto.topics) {
      const ineligible = Object.keys(dto.topics).filter((code) => !eligible.has(code) || !getTopic(code));
      if (ineligible.length) {
        throw new BadRequestException({
          code: 'TOPIC_NOT_ELIGIBLE',
          message: 'One or more topics are not available for this account.',
          topics: ineligible,
        });
      }
      for (const [code, enabled] of Object.entries(dto.topics)) {
        if (typeof enabled !== 'boolean') continue;
        await this.prisma.userNotificationPreference.upsert({
          where: { userId_topic: { userId: user.id, topic: code } },
          create: { userId: user.id, topic: code, enabled },
          update: { enabled },
        });
      }
    }
    if (dto.device?.token) {
      await this.devices.setPushEnabled(user.id, dto.device.token, dto.device.pushEnabled);
    }
    return { ok: true as const };
  }

  @Get()
  @RequirePermissions('notification.read')
  list(@CurrentUser() user: AuthUser) {
    const eligible = eligibleTopicsForUser(user, TOPICS).map((topic) => topic.code);
    return this.prisma.notification.findMany({
      where: {
        userId: user.id,
        OR:
          eligible.length > 0
            ? [{ topic: null }, { topic: { in: eligible } }]
            : [{ topic: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('device-token')
  @RequirePermissions('notification.read')
  async registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.devices.register({
      userId: user.id,
      token: dto.token,
      platform: dto.platform,
      osPermission: dto.osPermission,
      pushEnabled: dto.pushEnabled,
      deviceId: dto.deviceId,
    });
    return { ok: true, id: row.id };
  }

  @Post('device-token/release')
  @RequirePermissions('notification.read')
  releaseDeviceToken(@Body() dto: ReleaseDeviceTokenDto, @CurrentUser() user: AuthUser) {
    return this.devices.release(user.id, dto.token);
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
