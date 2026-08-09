import type { DealerHomePayload } from './api';

export const dealerHomeSuccessFixture: DealerHomePayload = {
  activeOrders: 12,
  ordersInProduction: 5,
  ordersNearingDelivery: 3,
  completedOrders: 18,
  outstandingBalance: '18750.000',
  balanceDueInDays: 15,
  unreadNotifications: 2,
  recentOrders: [
    {
      id: 'so1',
      number: 'ORD-1258',
      status: 'IN_PRODUCTION',
      title: 'Lobby Sofa',
      imageUrl: null,
      progressPercent: 40,
      progressLabel: 'In progress',
      externalOrderNumber: 'PO-88',
      endCustomerName: null,
      requiredDeliveryDate: null,
    },
    {
      id: 'so2',
      number: 'ORD-1260',
      status: 'READY_FOR_DELIVERY',
      title: 'Dining Chairs',
      imageUrl: null,
      progressPercent: 80,
      progressLabel: 'Near completion',
      externalOrderNumber: null,
      endCustomerName: null,
      requiredDeliveryDate: null,
    },
  ],
  recentInvoices: [
    {
      id: 'inv1',
      number: 'INV-1042',
      status: 'ISSUED',
      total: '9200.000',
      outstandingAmount: '9200.000',
      issuedAt: '2026-07-20T00:00:00.000Z',
      dueDate: '2026-08-20T00:00:00.000Z',
    },
  ],
  generatedAt: '2026-08-05T12:00:00.000Z',
};

export const dealerHomeEmptyFixture: DealerHomePayload = {
  ...dealerHomeSuccessFixture,
  activeOrders: 0,
  ordersInProduction: 0,
  ordersNearingDelivery: 0,
  completedOrders: 0,
  outstandingBalance: '0.000',
  balanceDueInDays: null,
  unreadNotifications: 0,
  recentOrders: [],
  recentInvoices: [],
};
