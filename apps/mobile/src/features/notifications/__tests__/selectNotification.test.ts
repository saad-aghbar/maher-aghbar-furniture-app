import {
  groupNotificationsByDay,
  normalizeNotificationList,
  notificationIconFor,
  notificationTemplateVars,
  polishNotificationCopy,
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

  it('groups notifications by day newest first', () => {
    const cards = [
      selectNotificationCard(row, 'en'),
      selectNotificationCard(
        { ...row, id: 'n2', createdAt: '2026-05-03T12:00:00.000Z' },
        'en',
      ),
      selectNotificationCard(
        { ...row, id: 'n3', createdAt: '2026-05-03T08:00:00.000Z' },
        'en',
      ),
    ];
    const sections = groupNotificationsByDay(cards, (d) => d);
    expect(sections.map((s) => s.key)).toEqual(['2026-05-03', '2026-05-01']);
    expect(sections[0]?.data).toHaveLength(2);
  });
});

describe('polishNotificationCopy', () => {
  const leftoverEn =
    'A proposed production schedule for order (v) is awaiting your approval.';
  const leftoverAr =
    'تم إنشاء جدول إنتاج مقترح لأمر الإنتاج (نسخة) وينتظر موافقتك.';
  const leftoverHe = 'לוח ייצור מוצע להזמנה (גרסה) ממתין לאישורך.';

  it('inserts the payload order code in place of leftover (v)', () => {
    const vars = { orderNumber: 'PO-1042', number: 'PO-1042', v: 'PO-1042' };
    expect(polishNotificationCopy(leftoverEn, vars)).toBe(
      'A proposed production schedule for order PO-1042 is awaiting your approval.',
    );
    expect(polishNotificationCopy(leftoverEn, vars)).not.toMatch(/\(v\)/);
  });

  it('omits the parenthetical when there is no order id', () => {
    expect(polishNotificationCopy(leftoverEn, {})).toBe(
      'A proposed production schedule is awaiting your approval.',
    );
    expect(polishNotificationCopy(leftoverEn, {})).not.toMatch(/\(v\)/);
    expect(polishNotificationCopy(leftoverEn, {})).not.toMatch(/\{v\}/);
  });

  it('fills mustache tokens and never leaves raw placeholders', () => {
    const template =
      'A proposed production schedule for order {{orderNumber}} (v{{version}}) is awaiting your approval.';
    expect(
      polishNotificationCopy(template, { orderNumber: 'PO-9', number: 'PO-9' }),
    ).toBe('A proposed production schedule for order PO-9 is awaiting your approval.');
    expect(
      polishNotificationCopy('Invoice {{number}} for {{total}} ILS was created.', {
        number: 'INV-12',
        total: '340',
      }),
    ).toBe('Invoice INV-12 for 340 ILS was created.');
    expect(
      polishNotificationCopy('Invoice {{number}} for {{total}} ILS was created.', {}),
    ).toBe('Invoice for ILS was created.');
    expect(polishNotificationCopy('Due {v}', {})).toBe('Due');
    expect(polishNotificationCopy('Due {v}', { v: 'soon' })).toBe('Due soon');
  });

  it('strips leftover Arabic and Hebrew version parentheticals', () => {
    expect(polishNotificationCopy(leftoverAr, { orderNumber: 'PO-1', number: 'PO-1' })).toBe(
      'تم إنشاء جدول إنتاج مقترح لأمر الإنتاج PO-1 وينتظر موافقتك.',
    );
    expect(polishNotificationCopy(leftoverHe, { orderNumber: 'PO-1', number: 'PO-1' })).toBe(
      'לוח ייצור מוצע להזמנה PO-1 ממתין לאישורך.',
    );
  });
});

describe('notificationTemplateVars', () => {
  const base: AppNotification = {
    id: 'n1',
    type: 'SCHEDULE_AWAITING_APPROVAL',
    titleEn: 'Production schedule awaiting approval',
    bodyEn: 'A proposed production schedule for order (v) is awaiting your approval.',
    createdAt: '2026-08-29T20:52:00.000Z',
  };

  it('reads order codes from payload extras and human link segments', () => {
    expect(
      notificationTemplateVars({
        ...base,
        orderNumber: 'PO-1042',
      } as AppNotification),
    ).toMatchObject({ orderNumber: 'PO-1042', number: 'PO-1042' });

    expect(
      notificationTemplateVars({
        ...base,
        vars: { number: 'SO-22' },
      } as AppNotification),
    ).toMatchObject({ number: 'SO-22', orderNumber: 'SO-22' });

    expect(
      notificationTemplateVars({ ...base, linkUrl: '/production-orders/PO-88' }),
    ).toMatchObject({ orderNumber: 'PO-88' });
  });

  it('does not treat a UUID link as an order code', () => {
    const vars = notificationTemplateVars({
      ...base,
      linkUrl: '/production-orders/3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });
    expect(vars.orderNumber).toBeUndefined();
    expect(vars.number).toBeUndefined();
  });

  it('selects polished body copy from the payload', () => {
    const card = selectNotificationCard(
      {
        ...base,
        orderNumber: 'PO-1042',
      } as AppNotification,
      'en',
    );
    expect(card.body).toBe(
      'A proposed production schedule for order PO-1042 is awaiting your approval.',
    );
    expect(card.body).not.toContain('(v)');
  });
});
