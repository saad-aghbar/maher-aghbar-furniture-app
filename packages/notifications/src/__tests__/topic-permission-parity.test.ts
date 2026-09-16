import { PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_STAFF_PRESETS } from '@maher/permissions';
import { TOPICS } from '../topics';
import {
  canPauseAllDevices,
  eligibleTopicsForUser,
  isEligibleForTopic,
} from '../eligibility';
import type { RecipientUser } from '../types';

const KNOWN = new Set<string>(PERMISSIONS);

function asUser(
  id: string,
  roles: string[],
  permissions: readonly string[],
  customerId?: string,
  stageSkillCodes?: string[],
): RecipientUser {
  return { id, roles, permissions: [...permissions], customerId, stageSkillCodes };
}

describe('notification topic / permission parity', () => {
  it('every topic permission is a live catalog code', () => {
    const unknown: string[] = [];
    for (const topic of TOPICS) {
      const required = topic.permission
        ? Array.isArray(topic.permission)
          ? topic.permission
          : [topic.permission]
        : [];
      for (const code of required) {
        if (!KNOWN.has(code)) unknown.push(`${topic.code}:${code}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('keeps operational topics on the matching feature permission', () => {
    const byCode = Object.fromEntries(TOPICS.map((t) => [t.code, t]));
    expect(byCode['po.late']?.permission).toBe('purchase-order.read');
    expect(byCode['quality.queued']?.permission).toEqual([
      'quality-inspection.perform',
      'quality-inspection.read',
    ]);
    expect(byCode['invoice.overdue']?.permission).toBe('invoice.read');
    expect(byCode['schedule.conflict']?.permission).toBe('schedule.manage');
    expect(byCode['inventory.lowStock']?.permission).toEqual([
      'inventory.read',
      'purchase-request.read',
    ]);
    expect(byCode['user.invited']?.permission).toBe('user.manage');
    expect(byCode['user.deactivated']?.permission).toBe('user.manage');
    expect(byCode['user.roleChanged']?.permission).toBe('user.manage');
  });

  it('Warehouse → Finance changes eligible topic groups (stored prefs do not grant access)', () => {
    const warehouse = asUser('wh', ['WAREHOUSE_MANAGEMENT'], SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes);
    const finance = asUser('fin', ['FINANCE'], SYSTEM_STAFF_PRESETS.FINANCE.permissionCodes);
    const whTopics = eligibleTopicsForUser(warehouse, TOPICS).map((t) => t.code);
    const finTopics = eligibleTopicsForUser(finance, TOPICS).map((t) => t.code);
    expect(whTopics).toContain('inventory.lowStock');
    expect(whTopics).toContain('grn.posted');
    expect(whTopics).not.toContain('invoice.overdue');
    expect(finTopics).toContain('invoice.overdue');
    expect(finTopics).toContain('payment.received');
    expect(finTopics).not.toContain('inventory.lowStock');
    expect(finTopics).not.toContain('grn.posted');
    const lowStock = TOPICS.find((t) => t.code === 'inventory.lowStock')!;
    expect(isEligibleForTopic(finance, lowStock)).toBe(false);
    expect(canPauseAllDevices(warehouse)).toBe(false);
    expect(canPauseAllDevices(finance)).toBe(false);
  });

  it('dealer never sees factory purchasing/QC/schedule/IAM topics', () => {
    const dealer = asUser('d', ['CUSTOMER'], ROLE_PERMISSIONS.CUSTOMER, 'cust-1');
    const codes = eligibleTopicsForUser(dealer, TOPICS).map((t) => t.code);
    expect(codes).not.toContain('po.late');
    expect(codes).not.toContain('quality.failed');
    expect(codes).not.toContain('schedule.conflict');
    expect(codes).not.toContain('user.invited');
    expect(codes).not.toContain('fabric.unavailable');
    expect(codes).toContain('invoice.overdue');
  });

  it('worker is not eligible for purchasing, IAM, or finance topics by permission', () => {
    const worker = asUser(
      'w',
      ['PRODUCTION_WORKER'],
      ROLE_PERMISSIONS.PRODUCTION_WORKER,
      undefined,
      ['CARPENTRY'],
    );
    const codes = eligibleTopicsForUser(worker, TOPICS).map((t) => t.code);
    expect(codes).not.toContain('po.late');
    expect(codes).not.toContain('invoice.overdue');
    expect(codes).not.toContain('user.roleChanged');
    expect(codes).toContain('task.ready');
  });

  it('pause-on-every-device is system administrator only', () => {
    expect(
      canPauseAllDevices(asUser('a', ['SYSTEM_ADMINISTRATOR'], ['notification.read'])),
    ).toBe(true);
    expect(
      canPauseAllDevices(
        asUser('wh', ['WAREHOUSE_MANAGEMENT'], SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes),
      ),
    ).toBe(false);
    expect(
      canPauseAllDevices(
        asUser('w', ['PRODUCTION_WORKER'], ROLE_PERMISSIONS.PRODUCTION_WORKER, undefined, ['CARPENTRY']),
      ),
    ).toBe(false);
    expect(
      canPauseAllDevices(asUser('d', ['CUSTOMER'], ROLE_PERMISSIONS.CUSTOMER, 'cust-1')),
    ).toBe(false);
  });
});
