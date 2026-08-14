import type { AuthUser } from '@maher/types';
import {
  STAFF_CAPSULE_MAX,
  STAFF_CAPSULE_MIN,
  STAFF_SHELL_HEIGHT,
  capsuleFitsSlot,
  equalSlotLayouts,
  estimateStaffContentWidth,
  rectsOverlap,
  shouldUseStaffAdaptiveTabLayout,
  staffCapsuleInSlot,
  staffFallbackTabName,
  staffVisualLayouts,
} from '../staffAdaptiveTabLayout';
import { visibleTabsForUser } from '../tabConfig';

const base: AuthUser = {
  id: '1',
  username: 'test',
  email: 'a@b.c',
  name: 'Test',
  roles: [],
  permissions: [],
  preferredLanguage: 'en',
};

const staffUser = (permissions: string[]): AuthUser => ({
  ...base,
  permissions,
  rolesDetailed: [{ code: 'CUSTOM_STAFF', kind: 'STAFF', nameEn: 'Ops', nameAr: 'تشغيل', nameHe: 'תפעול' }],
});

const TRACK = { small: 276, current: 346, large: 384 } as const;

/** Approximate rendered caption widths (px) for capsule math — not font metrics. */
const LABEL_PX = {
  en: { home: 40, inventory: 72, more: 36, orders: 48, production: 78 },
  ar: { home: 52, inventory: 96, more: 48, orders: 64, production: 100 },
  he: { home: 48, inventory: 84, more: 40, orders: 56, production: 92 },
} as const;

function selectedCapsules(
  trackWidth: number,
  count: number,
  selectedIndex: number,
  labelWidth: number,
) {
  const slots = equalSlotLayouts(trackWidth, count);
  const contents = slots.map((_, i) =>
    estimateStaffContentWidth(labelWidth, i === selectedIndex),
  );
  return { slots, capsules: staffVisualLayouts(slots, contents) };
}

describe('shouldUseStaffAdaptiveTabLayout', () => {
  it('enables only admin-surface users with STAFF kind — not a staff-type code', () => {
    expect(shouldUseStaffAdaptiveTabLayout('admin', staffUser(['inventory.read']))).toBe(true);
  });

  it('stays off for System Admin, Worker, Dealer, and missing rolesDetailed', () => {
    const admin: AuthUser = {
      ...base,
      roles: ['SYSTEM_ADMINISTRATOR'],
      rolesDetailed: [
        { code: 'SYSTEM_ADMINISTRATOR', kind: 'ADMIN', nameEn: 'Admin', nameAr: 'مدير' },
      ],
      permissions: ['user.manage', 'inventory.read', 'sales-order.read'],
    };
    const worker: AuthUser = {
      ...base,
      rolesDetailed: [
        {
          code: 'PRODUCTION_WORKER',
          kind: 'PRODUCTION_WORKER',
          nameEn: 'Worker',
          nameAr: 'عامل',
        },
      ],
      permissions: ['production-task.read'],
    };
    const dealer: AuthUser = {
      ...base,
      customerId: 'c1',
      rolesDetailed: [{ code: 'CUSTOMER', kind: 'CUSTOMER', nameEn: 'Dealer', nameAr: 'تاجر' }],
      permissions: ['catalog.read'],
    };
    expect(shouldUseStaffAdaptiveTabLayout('admin', admin)).toBe(false);
    expect(shouldUseStaffAdaptiveTabLayout('employee', worker)).toBe(false);
    expect(shouldUseStaffAdaptiveTabLayout('customer', dealer)).toBe(false);
    expect(shouldUseStaffAdaptiveTabLayout('admin', { ...base, permissions: ['inventory.read'] })).toBe(
      false,
    );
  });
});

describe('staff adaptive layout cases A–F', () => {
  it('A — 2 tabs: balanced slots, capsule not half the bar, large hit targets', () => {
    for (const track of Object.values(TRACK)) {
      const { slots, capsules } = selectedCapsules(track, 2, 0, LABEL_PX.en.home);
      expect(slots).toHaveLength(2);
      expect(slots[0]!.width).toBeCloseTo(track / 2, 5);
      expect(slots[1]!.width).toBeCloseTo(track / 2, 5);
      expect(slots[0]!.width).toBeGreaterThanOrEqual(STAFF_CAPSULE_MIN);
      const pill = capsules[0]!;
      expect(pill.width).toBeLessThan(track * 0.5);
      expect(pill.width).toBeLessThanOrEqual(STAFF_CAPSULE_MAX);
      expect(capsuleFitsSlot(slots[0]!, pill)).toBe(true);
      expect(rectsOverlap(capsules[0]!, capsules[1]!)).toBe(false);
    }
  });

  it('B — 3 tabs: equal thirds', () => {
    const { slots, capsules } = selectedCapsules(TRACK.current, 3, 1, LABEL_PX.en.inventory);
    expect(slots.map((s) => s.width)).toEqual([
      TRACK.current / 3,
      TRACK.current / 3,
      TRACK.current / 3,
    ]);
    capsules.forEach((c, i) => expect(capsuleFitsSlot(slots[i]!, c)).toBe(true));
    expect(rectsOverlap(capsules[0]!, capsules[1]!)).toBe(false);
    expect(rectsOverlap(capsules[1]!, capsules[2]!)).toBe(false);
  });

  it('C — 4 tabs: no overlap', () => {
    const names = ['index', 'orders', 'inventory', 'more'] as const;
    const labels = [LABEL_PX.en.home, LABEL_PX.en.orders, LABEL_PX.en.inventory, LABEL_PX.en.more];
    const slots = equalSlotLayouts(TRACK.current, names.length);
    const capsules = staffVisualLayouts(
      slots,
      labels.map((w, i) => estimateStaffContentWidth(w, i === 2)),
    );
    expect(capsules).toHaveLength(4);
    for (let i = 0; i < 3; i++) {
      expect(rectsOverlap(capsules[i]!, capsules[i + 1]!)).toBe(false);
    }
  });

  it('D — 5 tabs: all slots accessible, selected label within max, no clipping', () => {
    const slots = equalSlotLayouts(TRACK.small, 5);
    expect(slots.every((s) => s.width >= STAFF_CAPSULE_MIN)).toBe(true);
    const capsules = staffVisualLayouts(
      slots,
      slots.map((_, i) => estimateStaffContentWidth(LABEL_PX.en.production, i === 3)),
    );
    capsules.forEach((c, i) => {
      expect(c.width).toBeLessThanOrEqual(STAFF_CAPSULE_MAX);
      expect(capsuleFitsSlot(slots[i]!, c)).toBe(true);
    });
  });

  it('E — 3 tabs → 2 tabs recomputes without a leftover slot', () => {
    const three = equalSlotLayouts(TRACK.current, 3);
    const two = equalSlotLayouts(TRACK.current, 2);
    expect(three).toHaveLength(3);
    expect(two).toHaveLength(2);
    expect(two[0]!.x + two[0]!.width + two[1]!.width).toBeCloseTo(TRACK.current, 5);
  });

  it('F — selected tab removed falls back to Home', () => {
    expect(staffFallbackTabName([{ name: 'index' }, { name: 'more' }], 'inventory')).toBe('index');
    expect(staffFallbackTabName([{ name: 'index' }, { name: 'inventory' }, { name: 'more' }], 'inventory')).toBe(
      'inventory',
    );
  });
});

describe('i18n, RTL, theme-stable chrome', () => {
  it('EN / AR / HE selected capsules stay inside the slot', () => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const { slots, capsules } = selectedCapsules(
        TRACK.current,
        3,
        1,
        LABEL_PX[locale].inventory,
      );
      expect(capsuleFitsSlot(slots[1]!, capsules[1]!)).toBe(true);
      expect(capsules[1]!.width).toBeLessThanOrEqual(STAFF_CAPSULE_MAX);
    }
  });

  it('RTL: reversing slot order still keeps capsules inside their slots', () => {
    const ltr = equalSlotLayouts(TRACK.current, 3);
    const rtl = [...ltr].reverse().map((s) => ({ ...s }));
    const capsules = staffVisualLayouts(
      rtl,
      rtl.map((_, i) => estimateStaffContentWidth(LABEL_PX.ar.home, i === 0)),
    );
    capsules.forEach((c, i) => expect(capsuleFitsSlot(rtl[i]!, c)).toBe(true));
  });

  it('shell height is constant across Home / Inventory / More', () => {
    expect(STAFF_SHELL_HEIGHT).toBe(58);
  });
});

describe('non-Staff tab sets stay on the existing permission path', () => {
  it('Admin / Worker / Dealer visible names are unchanged', () => {
    const admin: AuthUser = {
      ...base,
      permissions: ['sales-order.read', 'inventory.read', 'production-order.read', 'quotation.create'],
    };
    const worker: AuthUser = {
      ...base,
      permissions: ['production-task.read', 'production-task.update-own', 'notification.read'],
    };
    const dealer: AuthUser = {
      ...base,
      customerId: 'c1',
      permissions: ['catalog.read', 'request.create', 'sales-order.read'],
    };
    expect(visibleTabsForUser('admin', admin).map((t) => t.name)).toEqual([
      'index',
      'orders',
      'inventory',
      'production',
      'more',
    ]);
    expect(visibleTabsForUser('employee', worker).map((t) => t.name)).toEqual([
      'index',
      'tasks',
      'completed',
      'notifications',
      'profile',
    ]);
    expect(visibleTabsForUser('customer', dealer).map((t) => t.name)).toEqual([
      'index',
      'catalog',
      'orders',
      'account',
    ]);
    expect(shouldUseStaffAdaptiveTabLayout('admin', admin)).toBe(false);
    expect(shouldUseStaffAdaptiveTabLayout('employee', worker)).toBe(false);
    expect(shouldUseStaffAdaptiveTabLayout('customer', dealer)).toBe(false);
  });

  it('permission-driven Staff tab names do not require a type switch', () => {
    expect(visibleTabsForUser('admin', staffUser(['notification.read'])).map((t) => t.name)).toEqual([
      'index',
      'more',
    ]);
    expect(
      visibleTabsForUser(
        'admin',
        staffUser(['inventory.read', 'inventory.receive']),
      ).map((t) => t.name),
    ).toEqual(['index', 'inventory', 'more']);
    expect(
      visibleTabsForUser(
        'admin',
        staffUser(['inventory.read', 'sales-order.read']),
      ).map((t) => t.name),
    ).toEqual(['index', 'orders', 'inventory', 'more']);
  });
});

describe('staffCapsuleInSlot', () => {
  it('does not use slot width as the visible pill', () => {
    const slot = { x: 0, width: 200 };
    const capsule = staffCapsuleInSlot(slot, 80);
    expect(capsule.width).toBeLessThan(slot.width);
    expect(capsule.width).toBeGreaterThanOrEqual(STAFF_CAPSULE_MIN);
    expect(capsule.x).toBeCloseTo((200 - capsule.width) / 2, 5);
  });
});
