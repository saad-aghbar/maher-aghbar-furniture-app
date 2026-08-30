import {
  assertDealerDetailSafe,
  selectOrderDetail,
} from '../selectOrderDetail';
import {
  adminDraftOrderDetailFixture,
  adminOrderDetailFixture,
  dealerOrderDetailFixture,
} from '../detailFixtures';

describe('selectOrderDetail', () => {
  it('keeps admin costs, stages, worker, and end-customer', () => {
    const vm = selectOrderDetail(adminOrderDetailFixture, 'admin');
    expect(vm.showCosts).toBe(true);
    expect(vm.showStages).toBe(true);
    expect(vm.manufacturingCost).toBe(7800);
    expect(vm.profit).toBe(4200);
    expect(vm.stages.length).toBeGreaterThan(0);
    expect(vm.progressLabel).toBe('Upholstery');
    expect(vm.assignedWorkerName).toBe('Ali Hassan');
    expect(vm.endCustomerName).toBe('Grand Hotel');
    expect(vm.phone).toBe('+962 7 9000 0000');
    expect(vm.projectName).toBe('Grand Hotel Lobby');
    expect(vm.items[0]?.dimensions).toContain('220');
    expect(vm.costMaterials.find((m) => m.key === 'fabric')?.qty).toBe(12);
    expect(vm.deliveries).toHaveLength(1);
    expect(vm.productionOrders[0]?.stages[0]?.dependsOnCodes).toEqual([]);
    expect(vm.canEdit).toBe(false);
  });

  it('derives progressLabel from IN_PROGRESS stage when currentStage is missing', () => {
    const { currentStage: _omit, ...withoutTopStage } = adminOrderDetailFixture;
    const vm = selectOrderDetail(withoutTopStage, 'admin');
    expect(vm.progressLabel).toBe('Painting');
  });

  it('marks draft admin orders editable', () => {
    const vm = selectOrderDetail(adminDraftOrderDetailFixture, 'admin');
    expect(vm.isDraft).toBe(true);
    expect(vm.canEdit).toBe(true);
    expect(vm.productionOrders).toEqual([]);
    expect(vm.needsProductionSetup).toBe(true);
    expect(vm.setupProductId).toBe('prod-sofa');
  });

  it('does not flag production setup on in-production admin orders', () => {
    const vm = selectOrderDetail(adminOrderDetailFixture, 'admin');
    expect(vm.needsProductionSetup).toBe(false);
  });

  it('does not flag production setup for dealer drafts', () => {
    const vm = selectOrderDetail(adminDraftOrderDetailFixture, 'dealer');
    expect(vm.needsProductionSetup).toBe(false);
    expect(vm.setupProductId).toBeNull();
  });

  it('keeps dealer-safe stages and omits costs, worker, and end-customer', () => {
    const vm = selectOrderDetail(dealerOrderDetailFixture, 'dealer');
    expect(vm.sellerPrice).toBe(12000);
    expect(vm.customerRef).toBe('PO-441');
    expect(vm.fabricSummary).toContain('Linen');
    assertDealerDetailSafe(vm);
    expect(vm.stages.length).toBeGreaterThan(0);
    expect(vm.showStages).toBe(true);
    expect(vm.manufacturingCost).toBeNull();
    expect(vm.profit).toBeNull();
    expect(vm.assignedWorkerName).toBeNull();
  });

  it('strips costs/worker when admin-shaped payload is mapped as dealer', () => {
    const vm = selectOrderDetail(adminOrderDetailFixture, 'dealer');
    assertDealerDetailSafe(vm);
    expect(vm.stages.length).toBeGreaterThan(0);
    expect(vm.assignedWorkerName).toBeNull();
    expect(vm.endCustomerName).toBeNull();
    expect(vm.deliveries).toEqual([]);
  });
});
