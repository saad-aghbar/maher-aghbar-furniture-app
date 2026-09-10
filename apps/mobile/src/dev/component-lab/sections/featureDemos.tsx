import type { ReactNode } from 'react';
import { View } from 'react-native';
import { WarehouseBinBoard } from '@/features/inventory/components/WarehouseBinBoard';
import { NotificationBoardCard } from '@/features/notifications/components/NotificationBoardCard';
import type { NotificationCardModel } from '@/features/notifications/selectNotification';
import { ReturnPieceDecisionSheet } from '@/features/returns/components/ReturnPieceDecisionSheet';
import { ReturnPiecesBoard } from '@/features/returns/components/ReturnPiecesBoard';
import { TaskRecoveryFloorSection } from '@/features/tasks/components/TaskRecoveryFloorSection';
import type { ReturnPiece, ReturnRecoveryLine } from '@/features/returns/api';
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

const fixturePieces: ReturnPiece[] = [
  {
    id: 'lab-p1',
    pieceNo: 1,
    code: 'RT-DEMO-PIECE-001-P1',
    productDesc: 'Sofa',
    state: 'RECEIVED',
    conditionNotes: 'Corner scuff',
  },
  {
    id: 'lab-p2',
    pieceNo: 2,
    code: 'RT-DEMO-PIECE-001-P2',
    productDesc: 'Chair',
    state: 'IN_PROGRESS',
    decision: 'REPLACEMENT',
    productionOrder: { id: 'lab-rp', number: 'RP-1', status: 'PLANNED' },
    recoveryOrder: { id: 'lab-rc', number: 'RC-1', status: 'IN_PROGRESS' },
  },
];

const fixtureRecoveryLines: ReturnRecoveryLine[] = [
  {
    id: 'lab-line-1',
    label: 'Foam offcut',
    quantity: 1,
    unit: 'pcs',
    outcome: 'DISPOSE',
    postedAt: null,
  },
];

export const featureDemoRenderers: Record<string, (ctx: LabRenderContext) => ReactNode> = {
  'feature.notifications.notification-board-card': (ctx) => (
    <NotificationBoardCard
      item={ctx.variant === 'read' ? fixtureRead : fixtureUnread}
      onPress={() => undefined}
    />
  ),
  'feature.returns.return-piece-decision-sheet': (ctx) => (
    <View style={{ minHeight: 520 }}>
      <ReturnPieceDecisionSheet
        open
        returnNumber="RT-DEMO-PIECE-001"
        pieces={
          ctx.variant === 'empty'
            ? [{ ...fixturePieces[0]!, state: 'IN_PROGRESS', decision: 'REPAIR' }]
            : ctx.variant === 'single'
              ? [fixturePieces[0]!]
              : fixturePieces.filter((piece) => piece.state === 'RECEIVED')
        }
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    </View>
  ),
  'feature.returns.return-pieces-board': (ctx) => (
    <ReturnPiecesBoard
      pieces={ctx.variant === 'empty' ? [] : ctx.variant === 'dealer' ? fixturePieces : fixturePieces}
      dealerFacing={ctx.variant === 'dealer'}
    />
  ),
  'feature.tasks.task-recovery-floor-section': (ctx) => (
    <TaskRecoveryFloorSection
      taskId="lab-task"
      returnRequestId="lab-ret"
      returnPieceId="lab-p2"
      previewLines={ctx.variant === 'empty' ? [] : fixtureRecoveryLines}
    />
  ),
  'feature.inventory.warehouse-bin-board': () => (
    <WarehouseBinBoard
      warehouseLabel="Raw materials"
      warehouseSubtitle="RAW · Aisle A1"
      locations={[
        {
          id: 'raw-main',
          warehouseId: 'raw',
          code: 'RAW-MAIN',
          name: 'Main floor',
          isDefault: true,
        },
        {
          id: 'raw-a1',
          warehouseId: 'raw',
          code: 'RAW-A1',
          name: 'Aisle A1',
          isDefault: false,
        },
      ]}
      selectedLocationId="raw-a1"
      onOpenWarehouse={() => undefined}
      onSelectLocation={() => undefined}
    />
  ),
};
