import {
  pickTrackingOrder,
  pipelineStepIndex,
} from '@/features/admin-home/pickTrackingOrder';
import type { AdminHomePayload } from '@/features/admin-home/api';

function payload(partial: Partial<AdminHomePayload>): AdminHomePayload {
  return {
    newOrders: 0,
    ordersInProduction: 0,
    ordersNearingDelivery: 0,
    completedOrders: 0,
    delayedOrders: 0,
    openInvoices: 0,
    outstandingReceivables: 0,
    dealersActive: 0,
    pendingReturns: 0,
    lowStockItems: 0,
    recentOrders: [],
    generatedAt: new Date().toISOString(),
    completedToday: 0,
    urgentTasksCount: 0,
    urgentTasks: [],
    unreadNotifications: 0,
    recentActivity: null,
    floorSpotlight: null,
    ...partial,
  };
}

describe('pipelineStepIndex', () => {
  it('maps known statuses', () => {
    expect(pipelineStepIndex('CONFIRMED')).toBe(0);
    expect(pipelineStepIndex('IN_PRODUCTION')).toBe(1);
    expect(pipelineStepIndex('READY')).toBe(2);
    expect(pipelineStepIndex('DELIVERED')).toBe(3);
  });
});

describe('pickTrackingOrder', () => {
  it('returns null when no spotlight and no actionable recent', () => {
    expect(
      pickTrackingOrder(
        payload({
          recentOrders: [
            {
              id: '1',
              number: 'SO-1',
              status: 'CONFIRMED',
              title: 'A',
              imageUrl: null,
              customerName: 'C',
              externalOrderNumber: null,
              endCustomerName: null,
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('uses API floorSpotlight over recentOrders', () => {
    const picked = pickTrackingOrder(
      payload({
        delayedOrders: 12,
        floorSpotlight: {
          reason: 'late',
          peerCount: 12,
          order: {
            id: 'hot',
            number: 'SO-HOT',
            status: 'IN_PRODUCTION',
            title: 'Late sofa',
            imageUrl: null,
            customerName: 'Factory Dealer',
            externalOrderNumber: null,
            endCustomerName: null,
            requiredDeliveryDate: '2026-07-01T00:00:00.000Z',
          },
        },
        recentOrders: [
          {
            id: '1',
            number: 'SO-1',
            status: 'IN_PRODUCTION',
            title: 'Newer',
            imageUrl: null,
            customerName: 'C',
            externalOrderNumber: null,
            endCustomerName: null,
          },
        ],
      }),
    );
    expect(picked?.order.number).toBe('SO-HOT');
    expect(picked?.reason).toBe('late');
    expect(picked?.peerCount).toBe(12);
  });

  it('falls back to in-production from recent with peer scale', () => {
    const data = payload({
      ordersInProduction: 40,
      recentOrders: [
        {
          id: '1',
          number: 'SO-1',
          status: 'CONFIRMED',
          title: 'A',
          imageUrl: null,
          customerName: 'C',
          externalOrderNumber: null,
          endCustomerName: null,
        },
        {
          id: '2',
          number: 'SO-2',
          status: 'IN_PRODUCTION',
          title: 'B',
          imageUrl: null,
          customerName: 'D',
          externalOrderNumber: null,
          endCustomerName: null,
        },
      ],
    });
    const picked = pickTrackingOrder(data);
    expect(picked?.order.number).toBe('SO-2');
    expect(picked?.stepIndex).toBe(1);
    expect(picked?.reason).toBe('in_production');
    expect(picked?.peerCount).toBe(40);
  });
});
