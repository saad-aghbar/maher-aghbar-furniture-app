import { readFileSync } from 'fs';
import { join } from 'path';

const MOBILE_SRC = join(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(join(MOBILE_SRC, rel), 'utf8');
}

describe('Desk split fills the side pane instead of pushing a page', () => {
  it('production hub embeds the sales-order line chooser', () => {
    const host = read('features/production/ProductionDeskHost.tsx');
    expect(host).toContain('OrderProductionPlanScreen');
    expect(host).toContain('embedded');
    expect(host).toContain('productionDeskSelectedId');
    expect(host).not.toContain('factoryOrderId');
  });

  it('inventory hub embeds finished, semi, and factory sub-orders', () => {
    const host = read('features/inventory/InventoryHubHost.tsx');
    expect(host).toContain('InventoryFinishedOrderScreen');
    expect(host).toContain('InventorySemiOrderScreen');
    expect(host).toContain('ProductionDetailScreen');
    expect(host).toContain('fg:');
    expect(host).toContain('semi:');
  });

  it('worker completed tab embeds the items picker', () => {
    const host = read('features/tasks/WorkerCompletedDeskHost.tsx');
    const route = readFileSync(
      join(__dirname, '../../../app/(app)/(employee)/(tabs)/completed.tsx'),
      'utf8',
    );
    expect(route).toContain('WorkerCompletedDeskHost');
    expect(host).toContain('WorkerCompletedSalesOrderItemsScreen');
    expect(host).toContain('embedded');
  });

  it('dealer orders, invoices, returns, quotations, and receipts use desk hosts', () => {
    expect(
      readFileSync(join(__dirname, '../../../app/(app)/(customer)/(tabs)/orders.tsx'), 'utf8'),
    ).toContain('OrdersDeskHost');
    expect(
      readFileSync(join(__dirname, '../../../app/(app)/(customer)/invoices/index.tsx'), 'utf8'),
    ).toContain('InvoicesDeskHost');
    expect(
      readFileSync(join(__dirname, '../../../app/(app)/(customer)/returns/index.tsx'), 'utf8'),
    ).toContain('ReturnsDeskHost');
    expect(
      readFileSync(join(__dirname, '../../../app/(app)/(customer)/quotations/index.tsx'), 'utf8'),
    ).toContain('DealerQuotationsDeskHost');
    expect(
      readFileSync(join(__dirname, '../../../app/(app)/(customer)/deliveries/index.tsx'), 'utf8'),
    ).toContain('DealerReceiptsDeskHost');
  });

  it('cost and performance desks split with embedded dossiers', () => {
    const host = read('features/reports/ReportsDeskHost.tsx');
    expect(host).toContain('reports-money-desk-split');
    expect(host).toContain('CostOrderDossierScreen');
    expect(host).toContain('CostProductProfileScreen');
    expect(host).toContain('CostInventoryItemScreen');
    expect(host).toContain('CostReturnDossierScreen');
    expect(host).toContain('CostCoverageIssuesScreen');
    expect(read('features/reports/ReportsScreen.tsx')).toContain('ReportsMoneyDeskHost');
  });

  it('purchasing fabric sub-orders embed factory detail', () => {
    const host = read('features/purchasing/PurchasingDeskHost.tsx');
    expect(host).toContain('onSelectProductionOrder');
    expect(host).toContain('ProductionDetailScreen');
    expect(host).toContain('prod:');
  });
});
