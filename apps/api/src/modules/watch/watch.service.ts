import { Injectable } from '@nestjs/common';
import { hasPermission } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { QualityFloorService } from '../quality/quality-floor.service';
import { ReportsService } from '../reports/reports.service';
import type {
  WatchAdminSummary,
  WatchCurrentTask,
  WatchDealerOrders,
  WatchInspectionGlance,
  WatchWorkerToday,
} from './watch.types';

const STARTABLE = new Set(['NOT_STARTED', 'READY', 'PAUSED']);
const COMPLETABLE = new Set(['IN_PROGRESS']);

@Injectable()
export class WatchService {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
    private readonly qualityFloor: QualityFloorService,
  ) {}

  async workerToday(user: AuthUser, locale?: string | null): Promise<WatchWorkerToday> {
    const home = await this.reports.workerHome(user, locale);
    const raw = home.urgentTask ?? home.todaysTasks[0] ?? null;
    const currentTask = raw ? mapWorkerTask(raw) : null;

    let nextInspection: WatchInspectionGlance | null = null;
    if (hasPermission(user.permissions ?? [], 'quality-inspection.perform')) {
      nextInspection = await this.pendingInspection();
    }

    return {
      currentTask,
      nextInspection,
      completedToday: home.completedTodayCount,
      unreadNotifications: home.unreadNotifications,
    };
  }

  async adminSummary(user: AuthUser): Promise<WatchAdminSummary> {
    const [home, qualityCards, unread] = await Promise.all([
      this.reports.adminHome(user),
      hasPermission(user.permissions ?? [], 'quality-inspection.read')
        ? this.qualityFloor.qualityAttentionCards(3)
        : Promise.resolve([]),
      hasPermission(user.permissions ?? [], 'notification.read')
        ? this.prisma.notification.findMany({
            where: { userId: user.id, readAt: null },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, titleEn: true, titleAr: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const lang = String(user.preferredLanguage || 'en').toLowerCase();
    const alerts = [
      ...unread.map((n) => ({
        id: n.id,
        title: lang.startsWith('ar') ? n.titleAr || n.titleEn : n.titleEn,
        kind: 'notification' as const,
        createdAt: n.createdAt.toISOString(),
      })),
      ...home.urgentTasks.slice(0, 2).map((t) => ({
        id: t.id,
        title: t.name,
        kind: 'task' as const,
        createdAt: t.plannedCompletion,
      })),
      ...qualityCards.slice(0, 2).map((card) => ({
        id: card.reworkId,
        title: card.reasonEn,
        kind: 'quality' as const,
        createdAt: null,
      })),
    ].slice(0, 5);

    return {
      counts: {
        urgentTasks: home.urgentTasksCount,
        unreadNotifications: home.unreadNotifications,
        completedToday: home.completedToday,
      },
      alerts,
    };
  }

  async dealerOrders(user: AuthUser): Promise<WatchDealerOrders> {
    const home = await this.reports.dealerHome(user);
    return {
      counts: {
        active: home.activeOrders,
        inProduction: home.ordersInProduction,
        nearingDelivery: home.ordersNearingDelivery,
        completed: home.completedOrders,
      },
      orders: home.recentOrders.slice(0, 5).map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        title: order.title,
        customerStatus: order.customerStatus ?? null,
        calendarDate: order.calendarDate ?? null,
      })),
    };
  }

  private async pendingInspection(): Promise<WatchInspectionGlance | null> {
    const row = await this.prisma.qualityInspection.findFirst({
      where: { result: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        stageCode: true,
        productionOrder: {
          select: {
            number: true,
            productDescription: true,
            product: { select: { nameEn: true } },
            salesOrder: { select: { number: true } },
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      orderNumber: row.productionOrder.salesOrder?.number ?? row.productionOrder.number,
      productTitle:
        row.productionOrder.product?.nameEn ?? row.productionOrder.productDescription ?? 'Order',
      stageCode: row.stageCode,
    };
  }
}

function mapWorkerTask(raw: {
  id: string;
  name: string;
  status: string;
  orderNumber: string;
  productTitle: string;
}): WatchCurrentTask {
  return {
    id: raw.id,
    title: raw.productTitle,
    stageName: raw.name,
    orderNumber: raw.orderNumber,
    productTitle: raw.productTitle,
    status: raw.status,
    canStart: STARTABLE.has(raw.status),
    canComplete: COMPLETABLE.has(raw.status),
  };
}
