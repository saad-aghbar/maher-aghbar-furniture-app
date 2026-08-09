import {
  normalizeNotificationList,
  notificationIconFor,
  selectNotificationCard,
  unreadCount,
} from '../selectNotification';
import type { AppNotification } from '../api';

describe('selectNotification', () => {
  const row: AppNotification = {
    id: 'n1',
    type: 'NEW_ORDER',
    titleEn: 'New order',
    titleAr: 'طلب جديد',
    bodyEn: 'RFQ-1 submitted',
    bodyAr: 'تم تقديم RFQ-1',
    createdAt: '2026-05-01T00:00:00.000Z',
    readAt: null,
  };

  it('maps locale titles and unread', () => {
    expect(selectNotificationCard(row, 'en').title).toBe('New order');
    expect(selectNotificationCard(row, 'ar').title).toBe('طلب جديد');
    expect(selectNotificationCard(row, 'en').unread).toBe(true);
  });

  it('normalizes array and paginated payloads', () => {
    expect(normalizeNotificationList([row])).toHaveLength(1);
    expect(normalizeNotificationList({ data: [row] })).toHaveLength(1);
    expect(unreadCount([row, { ...row, id: 'n2', readAt: '2026-05-02T00:00:00.000Z' }])).toBe(1);
  });

  it('picks icons from type and link', () => {
    expect(notificationIconFor('NEW_ORDER', '/sales-orders/abc')).toBe('cube-outline');
    expect(notificationIconFor('INVOICE_DUE', null)).toBe('receipt-outline');
    expect(notificationIconFor('TASK_ASSIGNED', '/tasks/1')).toBe('construct-outline');
    expect(notificationIconFor('GENERIC', null)).toBe('notifications-outline');
  });
});
