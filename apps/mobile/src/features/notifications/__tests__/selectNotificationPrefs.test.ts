import {
  groupLocalizedNotificationTopics,
  localizeNotificationTopicRow,
  localizeTopicGroupName,
} from '../selectNotificationPrefs';
import type { NotificationTopicRow } from '@/api/modules/notifications';

const arabicRow: NotificationTopicRow = {
  code: 'request.submitted',
  group: 'commercial',
  name: 'طلب جديد',
  hint: 'قدّم التاجر طلباً جديداً.',
  urgency: 'normal',
  defaultOn: true,
  enabled: true,
};

describe('selectNotificationPrefs locale overlay', () => {
  it('overlays English UI copy over an Arabic API payload', () => {
    const grouped = groupLocalizedNotificationTopics(
      [arabicRow],
      [{ id: 'commercial', name: 'الطلبات والعروض' }],
      'en',
    );
    expect(grouped[0]?.name).toBe('Orders & quotes');
    expect(grouped[0]?.rows[0]?.name).toBe('New request');
    expect(grouped[0]?.rows[0]?.hint).toBe('A dealer submitted a new request.');
  });

  it('overlays Arabic and Hebrew from the app locale', () => {
    expect(localizeNotificationTopicRow(arabicRow, 'ar').name).toBe('طلب جديد');
    expect(localizeNotificationTopicRow(arabicRow, 'he').name).toBe('בקשה חדשה');
    expect(localizeTopicGroupName('commercial', 'fallback', 'he')).toBe('הזמנות והצעות');
  });

  it('keeps API copy when the topic code is unknown', () => {
    const unknown: NotificationTopicRow = {
      ...arabicRow,
      code: 'not.a.topic',
    };
    expect(localizeNotificationTopicRow(unknown, 'en').name).toBe('طلب جديد');
  });
});
