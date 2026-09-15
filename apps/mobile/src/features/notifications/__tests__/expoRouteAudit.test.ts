import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LIVE_EXPO_ROUTE_FILES, TOPICS, eligibleSurfacesForTopic, isLiveExpoHref, resolveNotificationOpen } from '@maher/notifications';

const APP_DIR = join(__dirname, '../../../../app');

describe('notification destinations vs live Expo Router tree', () => {
  it('every catalog destination file exists', () => {
    const missing = LIVE_EXPO_ROUTE_FILES.filter((rel) => !existsSync(join(APP_DIR, rel)));
    expect(missing).toEqual([]);
  });

  it('every topic × eligible surface resolves to a live href', () => {
    for (const topic of TOPICS) {
      for (const surface of eligibleSurfacesForTopic(topic)) {
        const opened = resolveNotificationOpen({
          topic: topic.code,
          surface,
          entityType: topic.entity,
          entityId: 'ent-1',
          extras: { id: 'ent-1', salesOrderId: 'ent-1', taskId: 'ent-1', productionOrderId: 'ent-1' },
        });
        expect(opened).toBeTruthy();
        expect(isLiveExpoHref(opened!.href)).toBe(true);
        if (!opened || !isLiveExpoHref(opened.href)) {
          throw new Error(`${topic.code} ${surface} → ${opened?.href}`);
        }
        if (surface !== 'admin') {
          expect(opened.href.includes('(admin)')).toBe(false);
        }
      }
    }
  });

  it('opens detail destinations when an id is present', () => {
    expect(resolveNotificationOpen({ linkUrl: '/sales-orders/abc', surface: 'customer' })?.href).toBe(
      '/(app)/(customer)/orders/abc',
    );
    expect(resolveNotificationOpen({ linkUrl: '/sales-orders/abc', surface: 'admin' })?.href).toBe(
      '/(app)/(admin)/orders/abc',
    );
    expect(resolveNotificationOpen({ linkUrl: '/tasks/t1', surface: 'employee' })?.href).toBe(
      '/(app)/(employee)/tasks/t1',
    );
  });
});
