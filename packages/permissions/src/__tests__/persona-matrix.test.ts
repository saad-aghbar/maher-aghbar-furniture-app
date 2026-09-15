import { PERMISSIONS, ROLE_PERMISSIONS } from '../catalog';
import { SYSTEM_STAFF_PRESETS, generateStaffTypeCode } from '../staff';
import { hasPermission } from '../check';
import type { Permission } from '../catalog';

type Persona = {
  id: string;
  permissions: readonly string[];
};

const PERSONAS = {
  SYSTEM_ADMIN: { id: 'admin', permissions: ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR },
  PRODUCTION_MANAGER: {
    id: 'pm',
    permissions: SYSTEM_STAFF_PRESETS.PRODUCTION_MANAGEMENT.permissionCodes,
  },
  SCHEDULER: { id: 'sch', permissions: SYSTEM_STAFF_PRESETS.SCHEDULING.permissionCodes },
  WAREHOUSE: { id: 'wh', permissions: SYSTEM_STAFF_PRESETS.WAREHOUSE_MANAGEMENT.permissionCodes },
  PURCHASING: { id: 'buy', permissions: SYSTEM_STAFF_PRESETS.PURCHASING.permissionCodes },
  QC: { id: 'qc', permissions: SYSTEM_STAFF_PRESETS.QUALITY_CONTROL.permissionCodes },
  DELIVERY: { id: 'del', permissions: SYSTEM_STAFF_PRESETS.DELIVERY_OPERATIONS.permissionCodes },
  FINANCE: { id: 'fin', permissions: SYSTEM_STAFF_PRESETS.FINANCE.permissionCodes },
  SALES: { id: 'sales', permissions: SYSTEM_STAFF_PRESETS.SALES.permissionCodes },
  PRODUCTION_WORKER: { id: 'worker', permissions: ROLE_PERMISSIONS.PRODUCTION_WORKER },
  DEALER: { id: 'dealer', permissions: ROLE_PERMISSIONS.CUSTOMER },
};

function holds(persona: Persona, code: Permission) {
  return hasPermission([...persona.permissions], code);
}

describe('persona permission matrix', () => {
  it('SYSTEM ADMINISTRATOR has every live code except dealer quotation.accept', () => {
    const extra = PERMISSIONS.filter(
      (code) => code !== 'quotation.accept' && !holds(PERSONAS.SYSTEM_ADMIN, code),
    );
    expect(extra).toEqual([]);
    expect(holds(PERSONAS.SYSTEM_ADMIN, 'quotation.accept')).toBe(false);
    expect(holds(PERSONAS.SYSTEM_ADMIN, 'user.manage')).toBe(true);
    expect(holds(PERSONAS.SYSTEM_ADMIN, 'inventory.cost.read')).toBe(true);
  });

  it('PRODUCTION MANAGEMENT can run production, problems, workflow, and schedule risk — not PO create or finance invoices', () => {
    const p = PERSONAS.PRODUCTION_MANAGER;
    expect(holds(p, 'production-order.read')).toBe(true);
    expect(holds(p, 'production-task.update-any')).toBe(true);
    expect(holds(p, 'production.workflow.read')).toBe(true);
    expect(holds(p, 'schedule.manage')).toBe(true);
    expect(holds(p, 'fabric.procurement.read')).toBe(true);
    expect(holds(p, 'fabric.procurement.manage')).toBe(false);
    expect(holds(p, 'purchase-order.create')).toBe(false);
    expect(holds(p, 'invoice.read')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
  });

  it('SCHEDULING owns calendar read/manage/settings and not warehouse or finance', () => {
    const p = PERSONAS.SCHEDULER;
    expect(holds(p, 'schedule.read')).toBe(true);
    expect(holds(p, 'schedule.manage')).toBe(true);
    expect(holds(p, 'schedule.settings.manage')).toBe(true);
    expect(holds(p, 'inventory.receive')).toBe(false);
    expect(holds(p, 'invoice.read')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
  });

  it('WAREHOUSE can receive stock and fabric, not cost or user admin', () => {
    const p = PERSONAS.WAREHOUSE;
    expect(holds(p, 'inventory.read')).toBe(true);
    expect(holds(p, 'inventory.receive')).toBe(true);
    expect(holds(p, 'fabric.procurement.read')).toBe(true);
    expect(holds(p, 'inventory.cost.read')).toBe(false);
    expect(holds(p, 'invoice.read')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
    expect(holds(p, 'schedule.manage')).toBe(false);
  });

  it('PURCHASING can run PO/supplier/fabric procurement, not invoices or user admin', () => {
    const p = PERSONAS.PURCHASING;
    expect(holds(p, 'purchase-order.read')).toBe(true);
    expect(holds(p, 'supplier.read')).toBe(true);
    expect(holds(p, 'fabric.procurement.manage')).toBe(true);
    expect(holds(p, 'inventory.receive')).toBe(true);
    expect(holds(p, 'invoice.create')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
  });

  it('QC can inspect and not touch finance or purchasing', () => {
    const p = PERSONAS.QC;
    expect(holds(p, 'quality-inspection.read')).toBe(true);
    expect(holds(p, 'quality-inspection.perform')).toBe(true);
    expect(holds(p, 'production-task.read')).toBe(true);
    expect(holds(p, 'invoice.read')).toBe(false);
    expect(holds(p, 'purchase-order.read')).toBe(false);
    expect(holds(p, 'inventory.cost.read')).toBe(false);
  });

  it('DELIVERY can load/update deliveries and not cost or production admin', () => {
    const p = PERSONAS.DELIVERY;
    expect(holds(p, 'delivery.read')).toBe(true);
    expect(holds(p, 'delivery.update')).toBe(true);
    expect(holds(p, 'inventory.cost.read')).toBe(false);
    expect(holds(p, 'production.workflow.manage')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
  });

  it('FINANCE can invoice/pay/statement and not warehouse ops or staff admin', () => {
    const p = PERSONAS.FINANCE;
    expect(holds(p, 'invoice.read')).toBe(true);
    expect(holds(p, 'payment.read')).toBe(true);
    expect(holds(p, 'statement.read')).toBe(true);
    expect(holds(p, 'inventory.receive')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
  });

  it('SALES can run dealers/orders/returns and not purchasing or cost', () => {
    const p = PERSONAS.SALES;
    expect(holds(p, 'customer.read')).toBe(true);
    expect(holds(p, 'sales-order.read')).toBe(true);
    expect(holds(p, 'return.read')).toBe(true);
    expect(holds(p, 'catalog.read')).toBe(true);
    expect(holds(p, 'purchase-order.read')).toBe(false);
    expect(holds(p, 'inventory.cost.read')).toBe(false);
  });

  it('PRODUCTION WORKER stays on own work — no purchasing, cost, users, or schedule admin', () => {
    const p = PERSONAS.PRODUCTION_WORKER;
    expect(holds(p, 'production-task.read')).toBe(true);
    expect(holds(p, 'production-task.update-own')).toBe(true);
    expect(holds(p, 'purchase-order.read')).toBe(false);
    expect(holds(p, 'inventory.cost.read')).toBe(false);
    expect(holds(p, 'invoice.read')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
    expect(holds(p, 'catalog.manage')).toBe(false);
    expect(holds(p, 'schedule.manage')).toBe(false);
    expect(holds(p, 'schedule.settings.manage')).toBe(false);
  });

  it('DEALER is hard-bounded away from factory internals', () => {
    const p = PERSONAS.DEALER;
    expect(holds(p, 'sales-order.read')).toBe(true);
    expect(holds(p, 'invoice.read')).toBe(true);
    expect(holds(p, 'inventory.cost.read')).toBe(false);
    expect(holds(p, 'purchase-order.read')).toBe(false);
    expect(holds(p, 'supplier.read')).toBe(false);
    expect(holds(p, 'inventory.read')).toBe(false);
    expect(holds(p, 'user.manage')).toBe(false);
    expect(holds(p, 'quality-inspection.read')).toBe(false);
    expect(holds(p, 'schedule.manage')).toBe(false);
    expect(holds(p, 'fabric.procurement.read')).toBe(false);
    expect(holds(p, 'report.financial.read')).toBe(false);
  });

  it('does not treat generated custom staff codes as system presets', () => {
    const custom = generateStaffTypeCode('Night Shift Lead');
    expect(Object.keys(SYSTEM_STAFF_PRESETS)).not.toContain(custom);
  });
});
