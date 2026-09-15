import { Module } from '@nestjs/common';
import { DeviceTokensService } from './device-tokens.service';
import { ExpoPushClient } from './expo-push.client';
import { FloorHandoffService } from './floor-handoff.service';
import { IamNotifyService } from './iam-notify.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OpsJobsWorker } from './ops-jobs.worker';
import { OpsNotifyService } from './ops-notify.service';
import { PushDispatchWorker } from './push-dispatch.worker';
import { RecipientResolverService } from './recipient-resolver.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DeviceTokensService,
    RecipientResolverService,
    NotificationOutboxService,
    ExpoPushClient,
    PushDispatchWorker,
    FloorHandoffService,
    OpsNotifyService,
    IamNotifyService,
    OpsJobsWorker,
  ],
  exports: [NotificationsService, FloorHandoffService, OpsNotifyService, IamNotifyService, DeviceTokensService],
})
export class NotificationsModule {}
