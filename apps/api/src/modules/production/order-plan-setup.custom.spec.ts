import { ManufacturingComplexity } from '@maher/database';
import { OrderPlanSetupService } from './order-plan-setup.service';

describe('Custom production plan GET', () => {
  const staff = { id: 'admin-1', customerId: null } as never;

  function customPo() {
    return {
      id: 'po-custom',
      salesOrderId: 'so-custom',
      salesOrderLineId: 'line-custom',
      productId: null,
      product: null,
      releasedToFactoryAt: null,
      actualStartDate: null,
      status: 'PLANNED',
      plannedStartDate: null,
      requiredDeliveryDate: null,
      committedDeliveryDate: null,
      workflowSnapshot: null,
      tasks: [],
      salesOrder: {
        id: 'so-custom',
        number: 'SO-C1',
        requiredDeliveryDate: null,
        committedDeliveryDate: null,
        customer: {
          id: 'c1',
          name: 'Dealer',
          nameEn: 'Dealer',
          nameAr: null,
          nameHe: null,
        },
      },
      salesOrderLine: {
        manufacturingComplexity: ManufacturingComplexity.CUSTOM,
        quantity: 1,
        orderSpec: {},
        productionSetup: {
          manufacturingComplexity: ManufacturingComplexity.CUSTOM,
          requestedFabricLabel: null,
          catalogDimensions: null,
          orderDimensions: null,
          measurements: null,
          materialsReviewedAt: null,
          materialRequirements: [],
          workflow: null,
        },
      },
    };
  }

  it('returns a manual plan when productId and workflowId are null', async () => {
    const po = customPo();
    const productFindUnique = jest.fn();
    const prisma = {
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue(po),
      },
      warehouse: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findUnique: productFindUnique },
    };
    const service = new OrderPlanSetupService(prisma as never);
    const plan = await service.getPlanSetup('po-custom', staff);

    expect(plan.productionOrderId).toBe('po-custom');
    expect(plan.salesOrderLineId).toBe('line-custom');
    expect(plan.manufacturingComplexity).toBe('CUSTOM');
    expect(plan.product).toBeNull();
    expect(plan.workflow).toBeNull();
    expect(plan.stages).toEqual([]);
    expect(plan.bomLines).toEqual([]);
    expect(plan.tasks).toEqual([]);
    expect(plan.readiness.hasWorkflow).toBe(false);
    expect(plan.readiness.hasMaterials).toBe(false);
    expect(plan.readiness.canConfirm).toBe(false);
    expect(plan.catalogTemplate.showBoard).toBe(true);
    expect(plan.catalogTemplate.actionAvailable).toBe(false);
    expect(plan.catalogTemplate.manufacturingComplexity).toBe('CUSTOM');
    expect(plan.planEditable).toBe(true);
    expect(productFindUnique).not.toHaveBeenCalled();
  });
});
