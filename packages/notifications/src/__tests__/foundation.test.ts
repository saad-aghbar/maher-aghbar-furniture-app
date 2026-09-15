import { TOPICS } from '../topics';
import { eligibleSurfacesForTopic, mapNotificationLinkToHref, resolveNotificationOpen } from '../href';
import { hrefForSurfaceGroup, isLiveExpoHref, LIVE_EXPO_HREF_PATTERNS } from '../live-routes';
import { pushPayloadLooksSensitive, renderSafePushText, sanitizePushVars } from '../privacy';
import { lockScreenCopy } from '../copy';
import { notificationEventId } from '../event-id';
import {
  isEligibleForTopic,
  preferenceEnabled,
  shouldNotifyUser,
  eligibleTopicsForUser,
} from '../eligibility';
import { InMemoryOutboxLock, OUTBOX_CLAIM_SQL, pickClaimableOutboxIds } from '../outbox-claim';
import { isDevicePushDeliverable, nextDeviceTokenBinding } from '../device-token';
import { decideNotificationOpen } from '../pending-intent';
import type { RecipientUser } from '../types';

const admin: RecipientUser = {
  id: 'admin-1',
  roles: ['SYSTEM_ADMINISTRATOR'],
  permissions: ['notification.read', 'purchase-order.read', 'user.manage'],
};

const purchasing: RecipientUser = {
  id: 'buy-1',
  roles: ['STAFF'],
  permissions: ['purchase-order.read', 'purchase-request.read', 'notification.read'],
};

const dealer: RecipientUser = {
  id: 'dealer-1',
  roles: ['CUSTOMER'],
  permissions: ['notification.read', 'sales-order.read', 'invoice.read'],
  customerId: 'cust-1',
};

const worker: RecipientUser = {
  id: 'worker-1',
  roles: ['PRODUCTION_WORKER'],
  permissions: ['production-task.read', 'production-task.update-own', 'notification.read'],
};

describe('topic catalog privacy', () => {
  it('every lock-screen template is free of sensitive ERP fields', () => {
    for (const topic of TOPICS) {
      const en = lockScreenCopy(topic, 'en', {
        number: 'SO-1',
        taskName: 'Sew',
        stage: 'Sewing',
        nextStage: 'QC',
        date: '2026-09-14',
        sku: 'FAB-1',
        jobNumber: 'AI-1',
        count: '3',
        invoice: 'INV-1',
        delivery: 'DEL-1',
        amount: '9999',
        total: '8888',
        cost: '10',
      });
      expect(pushPayloadLooksSensitive(en.title)).toBe(false);
      expect(pushPayloadLooksSensitive(en.body)).toBe(false);
      expect(en.body).not.toContain('9999');
      expect(en.title).not.toContain('8888');
    }
  });

  it('strips cost, margin, rates, and notes from push vars', () => {
    const vars = sanitizePushVars({
      number: 'SO-9',
      amount: '50',
      total: '100',
      cost: '12',
      margin: '3',
      note: 'private',
      reason: 'internal',
    });
    expect(vars).toEqual({ number: 'SO-9' });
    expect(renderSafePushText('Order {number} {amount}', { number: 'SO-9', amount: '50' })).toBe(
      'Order SO-9',
    );
  });
});

describe('event idempotency', () => {
  it('same transition collapses; a new transition stays distinct', () => {
    const a = notificationEventId({
      topic: 'order.onHold',
      entityType: 'salesOrder',
      entityId: 'so-1',
      transition: 'ON_HOLD:100',
    });
    const b = notificationEventId({
      topic: 'order.onHold',
      entityType: 'salesOrder',
      entityId: 'so-1',
      transition: 'ON_HOLD:100',
    });
    const c = notificationEventId({
      topic: 'order.onHold',
      entityType: 'salesOrder',
      entityId: 'so-1',
      transition: 'ON_HOLD:200',
    });
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('recipient eligibility', () => {
  it('lets system admin see every topic', () => {
    for (const topic of TOPICS) {
      expect(isEligibleForTopic(admin, topic)).toBe(true);
    }
  });

  it('limits purchasing staff to purchasing/inventory-adjacent topics', () => {
    const po = TOPICS.find((t) => t.code === 'po.sent')!;
    const task = TOPICS.find((t) => t.code === 'task.assigned')!;
    expect(isEligibleForTopic(purchasing, po)).toBe(true);
    expect(isEligibleForTopic(purchasing, task)).toBe(false);
  });

  it('limits dealers to dealer audiences for their customer', () => {
    const quote = TOPICS.find((t) => t.code === 'quote.sent')!;
    const po = TOPICS.find((t) => t.code === 'po.sent')!;
    const qcFail = TOPICS.find((t) => t.code === 'quality.failed')!;
    const rework = TOPICS.find((t) => t.code === 'quality.reworkRequired')!;
    const stage = TOPICS.find((t) => t.code === 'stage.completed')!;
    expect(isEligibleForTopic(dealer, quote)).toBe(true);
    expect(isEligibleForTopic(dealer, po)).toBe(false);
    expect(isEligibleForTopic(dealer, qcFail)).toBe(false);
    expect(isEligibleForTopic(dealer, rework)).toBe(false);
    expect(isEligibleForTopic(dealer, stage)).toBe(false);
    const dealerPrefs = eligibleTopicsForUser(dealer, TOPICS).map((t) => t.code);
    expect(dealerPrefs).toContain('order.readyForDelivery');
    expect(dealerPrefs).toContain('order.onHold');
    expect(dealerPrefs).not.toContain('quality.failed');
    expect(dealerPrefs).not.toContain('quality.reworkRequired');
    expect(dealerPrefs).not.toContain('stage.completed');
    expect(dealerPrefs).not.toContain('task.ready');
    expect(dealerPrefs).not.toContain('po.late');
    expect(dealerPrefs).not.toContain('fabric.unavailable');
    expect(dealerPrefs).not.toContain('inventory.shortageBlockingProduction');
    expect(dealerPrefs).not.toContain('inventory.finishedPosted');
    expect(dealerPrefs).not.toContain('schedule.conflict');
    expect(dealerPrefs).toContain('invoice.overdue');
    expect(dealerPrefs).toContain('payment.received');
    expect(dealerPrefs).toContain('return.decision');
  });

  it('shows worker topics to floor workers and excludes the actor when asked', () => {
    const ready = TOPICS.find((t) => t.code === 'task.ready')!;
    expect(isEligibleForTopic(worker, ready)).toBe(true);
    expect(
      shouldNotifyUser({ user: worker, topic: ready, actorUserId: 'worker-1', excludeActor: true }),
    ).toBe(false);
    expect(
      shouldNotifyUser({ user: worker, topic: ready, actorUserId: 'other', excludeActor: true }),
    ).toBe(true);
  });

  it('uses default-on unless the user stored an explicit off', () => {
    const noisy = TOPICS.find((t) => t.code === 'inventory.received')!;
    const normal = TOPICS.find((t) => t.code === 'order.confirmed')!;
    expect(preferenceEnabled(noisy, null)).toBe(false);
    expect(preferenceEnabled(normal, null)).toBe(true);
    expect(preferenceEnabled(normal, false)).toBe(false);
    expect(preferenceEnabled(TOPICS.find((t) => t.code === 'inventory.lowStock')!, null)).toBe(true);
    expect(preferenceEnabled(TOPICS.find((t) => t.code === 'fabric.needsOrdering')!, null)).toBe(false);
    expect(preferenceEnabled(TOPICS.find((t) => t.code === 'schedule.awaitingApproval')!, null)).toBe(
      false,
    );
  });
});

describe('href catalog vs live Expo routes', () => {
  it('every live topic produces a non-dead destination for every eligible surface', () => {
    for (const topic of TOPICS) {
      for (const surface of eligibleSurfacesForTopic(topic)) {
        const opened = resolveNotificationOpen({
          topic: topic.code,
          surface,
          entityType: topic.entity,
          entityId: 'ent-1',
          extras: { id: 'ent-1', salesOrderId: 'ent-1', taskId: 'ent-1', productionOrderId: 'ent-1' },
          linkUrl: canonicalLink(topic.entity, 'ent-1'),
        });
        expect(opened).toBeTruthy();
        expect(isLiveExpoHref(opened!.href)).toBe(true);
        if (!opened || !isLiveExpoHref(opened.href)) {
          throw new Error(`${topic.code} ${surface} → ${opened?.href}`);
        }
        if (surface === 'customer' || surface === 'employee') {
          expect(hrefForSurfaceGroup(opened.href)).not.toBe('admin');
        }
      }
    }
  });

  it('never invents a quality detail route', () => {
    const href = resolveNotificationOpen({
      topic: 'quality.failed',
      surface: 'admin',
      entityId: 'qc-1',
      linkUrl: '/quality-inspections/qc-1',
    });
    expect(href?.href).not.toContain('/quality/');
    expect(isLiveExpoHref(href!.href)).toBe(true);
  });

  it('keeps published href patterns inside the audited set', () => {
    expect(LIVE_EXPO_HREF_PATTERNS.length).toBeGreaterThan(20);
  });

  it('treats filled Expo group hrefs as live, not only unparameterized hubs', () => {
    for (const pattern of LIVE_EXPO_HREF_PATTERNS) {
      const sample = pattern.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, 'sample');
      expect(isLiveExpoHref(sample)).toBe(true);
    }
  });

  it('opens sales-order and task detail instead of tab hubs', () => {
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'customer')).toBe(
      '/(app)/(customer)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'admin')).toBe(
      '/(app)/(admin)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/tasks/t1', 'employee')).toBe('/(app)/(employee)/tasks/t1');
    expect(mapNotificationLinkToHref('/tasks/t1', 'employee', 'task.ready')).toBe(
      '/(app)/(employee)/tasks/t1',
    );
    expect(mapNotificationLinkToHref('/tasks/t1', 'employee', 'quality.queued')).toBe(
      '/(app)/(employee)/tasks/t1',
    );
    expect(mapNotificationLinkToHref('/sales-orders/abc', 'customer', 'order.onHold')).toBe(
      '/(app)/(customer)/orders/abc',
    );
    expect(mapNotificationLinkToHref('/purchasing/po1', 'admin', 'po.late')).toBe(
      '/(app)/(admin)/purchasing/po1',
    );
    expect(mapNotificationLinkToHref('/inventory/receive/grn1', 'admin', 'grn.posted')).toBe(
      '/(app)/(admin)/inventory/receive/grn1',
    );
    expect(mapNotificationLinkToHref('/inventory/low-stock', 'admin', 'inventory.lowStock')).toBe(
      '/(app)/(admin)/inventory/low-stock',
    );
    expect(mapNotificationLinkToHref('/purchasing/fabric/fp1', 'admin', 'fabric.readyForPickup')).toBe(
      '/(app)/(admin)/purchasing/fabric/fp1',
    );
    expect(mapNotificationLinkToHref('/returns/r1', 'customer', 'return.submitted')).toBe(
      '/(app)/(customer)/returns/r1',
    );
    expect(mapNotificationLinkToHref('/invoices/inv1', 'customer', 'invoice.overdue')).toBe(
      '/(app)/(customer)/invoices/inv1',
    );
    expect(mapNotificationLinkToHref('/scheduling', 'admin', 'schedule.conflict')).toBe(
      '/(app)/(admin)/scheduling',
    );
    expect(mapNotificationLinkToHref('/inventory/finished/so1', 'admin', 'inventory.finishedPosted')).toBe(
      '/(app)/(admin)/inventory/finished/so1',
    );
    expect(mapNotificationLinkToHref('/invoices/inv1', 'admin', 'payment.received')).toBe(
      '/(app)/(admin)/invoices/inv1',
    );
    expect(mapNotificationLinkToHref('/inventory/receive/grn1', 'customer', 'grn.posted')).not.toContain(
      '(admin)',
    );
  });

  it('keeps Slice 5 factory/QC/packaging lock-screen copy in AR and HE (no English fallback)', () => {
    const codes = [
      'order.onHold',
      'order.resumed',
      'order.cancelled',
      'order.readyForDelivery',
      'task.ready',
      'task.assigned',
      'task.completed',
      'stage.completed',
      'quality.queued',
      'quality.passed',
      'quality.failed',
      'quality.reworkRequired',
      'quality.reworkReady',
      'packaging.ready',
      'packaging.completed',
      'delivery.readyToLoad',
    ];
    for (const code of codes) {
      const topic = TOPICS.find((t) => t.code === code);
      expect(topic).toBeTruthy();
      if (!topic) continue;
      for (const field of ['name', 'hint', 'pushTitle', 'pushBody'] as const) {
        const copy = topic[field];
        expect(copy.ar.trim().length).toBeGreaterThan(0);
        expect(copy.he.trim().length).toBeGreaterThan(0);
        expect(copy.ar).not.toBe(copy.en);
        expect(copy.he).not.toBe(copy.en);
        expect(copy.ar).not.toMatch(/PRODUCTION_TASK|StageInstance|SALES_ORDER/);
        expect(copy.he).not.toMatch(/PRODUCTION_TASK|StageInstance|SALES_ORDER/);
        expect(copy.en).not.toMatch(/PRODUCTION_TASK|StageInstance|SALES_ORDER/);
      }
    }
  });

  it('keeps Slice 6 operational lock-screen copy in AR and HE', () => {
    const codes = [
      'pr.created',
      'pr.approved',
      'po.approved',
      'po.sent',
      'po.partial',
      'po.received',
      'po.cancelled',
      'po.late',
      'grn.posted',
      'inventory.lowStock',
      'inventory.shortageBlockingProduction',
      'inventory.finishedPosted',
      'fabric.needsOrdering',
      'fabric.awaitingSupplier',
      'fabric.arrived',
      'fabric.readyForPickup',
      'fabric.unavailable',
      'return.submitted',
      'return.decision',
      'return.ready',
      'invoice.created',
      'invoice.overdue',
      'invoice.voided',
      'payment.received',
      'schedule.atRisk',
      'schedule.conflict',
      'task.scheduledToday',
    ];
    for (const code of codes) {
      const topic = TOPICS.find((t) => t.code === code);
      expect(topic).toBeTruthy();
      if (!topic) continue;
      for (const field of ['name', 'hint', 'pushTitle', 'pushBody'] as const) {
        const copy = topic[field];
        expect(copy.ar.trim().length).toBeGreaterThan(0);
        expect(copy.he.trim().length).toBeGreaterThan(0);
        expect(copy.ar).not.toBe(copy.en);
        expect(copy.he).not.toBe(copy.en);
      }
    }
  });

  it('keeps Slice 7 IAM lock-screen copy in AR and HE without secrets', () => {
    for (const code of ['user.invited', 'user.deactivated', 'user.roleChanged'] as const) {
      const topic = TOPICS.find((t) => t.code === code);
      expect(topic).toBeTruthy();
      if (!topic) continue;
      for (const field of ['name', 'hint', 'pushTitle', 'pushBody'] as const) {
        const copy = topic[field];
        expect(copy.ar.trim().length).toBeGreaterThan(0);
        expect(copy.he.trim().length).toBeGreaterThan(0);
        expect(copy.ar).not.toBe(copy.en);
        expect(copy.he).not.toBe(copy.en);
        expect(`${copy.en} ${copy.ar} ${copy.he}`).not.toMatch(/password|PIN|secret|token|مصفوفة|הרשאות מלאות/i);
      }
    }
  });
});

describe('durable outbox claim', () => {
  it('documents lease/claim SKIP LOCKED SQL', () => {
    expect(OUTBOX_CLAIM_SQL).toContain('FOR UPDATE SKIP LOCKED');
    expect(OUTBOX_CLAIM_SQL).toContain('leaseUntil');
  });

  it('two workers cannot claim the same pending row', () => {
    const row = {
      id: 'ob-1',
      status: 'PENDING' as const,
      availableAt: 1,
      leaseUntil: null,
      attempts: 0,
    };
    const lock = new InMemoryOutboxLock();
    const a = lock.claim([row], 10, 10, 'w1');
    const b = lock.claim([row], 10, 10, 'w2');
    expect(a).toEqual([{ id: 'ob-1', workerId: 'w1' }]);
    expect(b).toEqual([]);
    expect(pickClaimableOutboxIds([row], 10, 5, new Set(['ob-1']))).toEqual([]);
  });
});

describe('device token account switch', () => {
  it('reassigns a physical token from A to B', () => {
    expect(nextDeviceTokenBinding({ existingUserId: 'A', incomingUserId: 'B' })).toEqual({
      action: 'reassign',
      previousUserId: 'A',
    });
  });

  it('does not deliver to A after the token belongs to B', () => {
    expect(
      isDevicePushDeliverable({
        userId: 'B',
        intendedUserId: 'A',
        pushEnabled: true,
        osPermission: 'granted',
        disabledAt: null,
        userMasterEnabled: true,
      }),
    ).toBe(false);
  });
});

describe('cold-start navigation', () => {
  const intent = {
    userId: 'dealer-1',
    linkUrl: '/sales-orders/abc',
    topic: 'order.confirmed',
    entityId: 'abc',
  };

  it('waits until auth bootstrap finishes', () => {
    expect(
      decideNotificationOpen({
        status: 'bootstrapping',
        user: null,
        surface: null,
        intent,
      }),
    ).toEqual({ action: 'wait' });
  });

  it('never routes a dealer into an admin surface', () => {
    const decision = decideNotificationOpen({
      status: 'authenticated',
      user: { id: 'dealer-1' },
      surface: 'customer',
      intent,
    });
    expect(decision.action).toBe('navigate');
    if (decision.action === 'navigate') {
      expect(decision.href).not.toContain('(admin)');
      expect(decision.href).toContain('(customer)');
    }
  });

  it('drops a leftover notification after account switch', () => {
    expect(
      decideNotificationOpen({
        status: 'authenticated',
        user: { id: 'B' },
        surface: 'admin',
        intent,
      }),
    ).toEqual({ action: 'drop', reason: 'wrong_user' });
  });

  it('opens the assigned task for worker cold-start task.ready', () => {
    const decision = decideNotificationOpen({
      status: 'authenticated',
      user: { id: 'worker-1' },
      surface: 'employee',
      intent: {
        userId: 'worker-1',
        linkUrl: '/tasks/t-uph',
        topic: 'task.ready',
        entityId: 't-uph',
      },
    });
    expect(decision.action).toBe('navigate');
    if (decision.action === 'navigate') {
      expect(decision.href).toBe('/(app)/(employee)/tasks/t-uph');
      expect(decision.href).not.toContain('(admin)');
    }
  });
});

function canonicalLink(entity: string, id: string): string {
  switch (entity) {
    case 'request':
      return `/requests/${id}`;
    case 'quotation':
      return `/quotations/${id}`;
    case 'salesOrder':
      return `/sales-orders/${id}`;
    case 'productionOrder':
      return `/production/${id}`;
    case 'task':
      return `/tasks/${id}`;
    case 'qualityInspection':
      return `/quality-inspections/${id}`;
    case 'delivery':
      return `/deliveries/${id}`;
    case 'returnRequest':
      return `/returns/${id}`;
    case 'invoice':
      return `/invoices/${id}`;
    case 'payment':
      return `/payments/${id}`;
    case 'purchaseRequest':
      return `/purchase-requests/${id}`;
    case 'purchaseOrder':
      return `/purchase-orders/${id}`;
    case 'inventoryItem':
      return `/inventory/items/${id}`;
    case 'fabricJob':
      return `/purchasing/fabric/${id}`;
    case 'schedule':
      return `/scheduling`;
    case 'aiIntake':
      return `/ai-intake/${id}`;
    case 'user':
      return `/users`;
    case 'wip':
      return `/tasks/${id}/take-in`;
    case 'blocker':
      return `/production/problems`;
    case 'goodsReceipt':
      return `/inventory/receive/${id}`;
    default:
      return `/sales-orders/${id}`;
  }
}
