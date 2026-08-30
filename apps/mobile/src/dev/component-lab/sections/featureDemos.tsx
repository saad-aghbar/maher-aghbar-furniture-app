import type { ReactNode } from 'react';
import { NotificationBoardCard } from '@/features/notifications/components/NotificationBoardCard';
import type { NotificationCardModel } from '@/features/notifications/selectNotification';
import type { LabRenderContext } from '../registry/types';

const fixtureUnread: NotificationCardModel = {
  id: 'dev-notif-1',
  title: 'Production ready',
  body: 'PO-P14-GOLDEN is ready for the next stage.',
  type: 'PRODUCTION',
  unread: true,
  createdAt: new Date().toISOString(),
  linkUrl: '/production',
};

const fixtureRead: NotificationCardModel = {
  ...fixtureUnread,
  id: 'dev-notif-2',
  title: 'Delivery confirmed',
  body: 'Dealer confirmed receipt.',
  type: 'DELIVERY',
  unread: false,
};

export const featureDemoRenderers: Record<string, (ctx: LabRenderContext) => ReactNode> = {
  'feature.notifications.notification-board-card': (ctx) => (
    <NotificationBoardCard
      item={ctx.variant === 'read' ? fixtureRead : fixtureUnread}
      onPress={() => undefined}
    />
  ),
};
