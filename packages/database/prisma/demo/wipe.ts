import type { PrismaClient } from '@prisma/client';

/**
 * Operational + leftover config wipe for launch seed and demo:reset.
 * Preserves permissions, roles, branches, warehouses RAW/SEMI/FIN, departments,
 * stage library, QC templates, notification templates, system_settings.
 */
export const DEMO_WIPE_TABLES = [
  'ai_chat_messages',
  'ai_chat_conversations',
  'ai_extraction_fields',
  'ai_extraction_jobs',
  'audit_events',
  'idempotency_records',
  'device_push_tokens',
  'communication_logs',
  'notifications',
  'documents',
  'scheduling_replan_runs',
  'return_requests',
  'supplier_payments',
  'supplier_invoice_lines',
  'supplier_invoices',
  'statement_entries',
  'payment_allocations',
  'payments',
  'invoice_lines',
  'invoices',
  'delivery_items',
  'deliveries',
  'quality_defects',
  'quality_inspection_items',
  'rework_requests',
  'quality_inspections',
  'task_blockers',
  'task_time_entries',
  'schedule_allocations',
  'production_schedules',
  'scheduling_estimate_proposals',
  'stage_estimate_stats',
  'product_stage_estimates',
  'product_production_profiles',
  'product_stage_inventory_inputs',
  'product_stage_inventory_outputs',
  'product_workflow_stage_overrides',
  'product_workflow_configurations',
  'production_order_workflow_snapshot_edges',
  'production_order_workflow_snapshot_nodes',
  'production_order_workflow_snapshots',
  'production_tasks',
  'production_stage_instances',
  'production_orders',
  'production_workflow_edges',
  'production_workflow_nodes',
  'production_workflow_versions',
  'production_workflows',
  'factory_calendar_exceptions',
  'factory_calendars',
  'contracts',
  'fabric_procurement_events',
  'fabric_procurements',
  'sales_order_line_material_requirements',
  'sales_order_line_setups',
  'sales_order_production_setups',
  'sales_order_lines',
  'sales_orders',
  'quotation_approvals',
  'quotation_lines',
  'quotations',
  'request_items',
  'requests_for_quotation',
  'warehouse_transfer_lines',
  'warehouse_transfers',
  'inventory_count_lines',
  'inventory_counts',
  'inventory_transactions',
  'inventory_balances',
  'inventory_lots',
  'goods_receipt_lines',
  'goods_receipts',
  'purchase_order_lines',
  'purchase_orders',
  'supplier_quote_offers',
  'purchase_request_lines',
  'purchase_requests',
  'inventory_items',
  'warehouse_locations',
  'dealer_prices',
  'products',
  'product_categories',
  'materials',
  'fabrics',
  'color_references',
  'supplier_contacts',
  'suppliers',
  'customer_addresses',
  'customer_contacts',
  'customers',
  'sessions',
  'user_roles',
  'worker_skills',
  'users',
  'sequence_counters',
] as const;

const CANONICAL_WAREHOUSE_CODES = ['RAW', 'SEMI', 'FIN'] as const;
const LEFTOVER_WAREHOUSE_CODES = ['RAW-2', 'SEMI-2', 'FIN-2', 'TEST', 'TEST-2', 'SA'];
const LEFTOVER_WAREHOUSE_NAME = /\b(TEST|UAT|DRUAT|SAMPLE|MOCK)\b/i;

export async function wipeOperationalData(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${DEMO_WIPE_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );

  const leftovers = await prisma.warehouse.findMany({
    where: {
      code: { notIn: [...CANONICAL_WAREHOUSE_CODES] },
    },
  });
  for (const wh of leftovers) {
    const leftover =
      LEFTOVER_WAREHOUSE_CODES.includes(wh.code) ||
      LEFTOVER_WAREHOUSE_NAME.test(`${wh.code} ${wh.nameEn} ${wh.nameAr} ${wh.nameHe ?? ''}`);
    if (!leftover) continue;
    try {
      await prisma.warehouse.delete({ where: { id: wh.id } });
    } catch {
      await prisma.warehouse.update({ where: { id: wh.id }, data: { isActive: false } });
    }
  }
}
