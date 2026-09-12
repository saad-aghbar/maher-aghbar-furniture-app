import type { SalesOrderDetail } from '@/api/modules/sales-orders';
import { selectOrderFlowItems, shouldSkipOrderFlowList } from '../selectOrderFlowItems';

function stage(
  code: string,
  nameEn: string,
  status: string,
  progressPercent: number,
): NonNullable<NonNullable<SalesOrderDetail['productionOrders']>[number]['stages']>[number] {
  return {
    code,
    nameEn,
    nameAr: nameEn,
    sortOrder: 1,
    status,
    progressPercent,
  };
}

function threeItemOrder(): SalesOrderDetail {
  return {
    id: 'so-1',
    number: 'ORD-9',
    status: 'IN_PRODUCTION',
    priority: 'NORMAL',
    title: 'Mixed set',
    imageUrl: null,
    notes: null,
    externalOrderNumber: null,
    deliveryAddress: null,
    requiredDeliveryDate: null,
    progressPercent: 90,
    lines: [
      { id: 'line-a', variantLabel: '2-seat linen', quantity: 1 },
      { id: 'line-b', variantLabel: 'Armchair oak', quantity: 2 },
      { id: 'line-c', variantLabel: 'Coffee table', quantity: 1 },
    ],
    productionOrders: [
      {
        id: 'po-a',
        number: 'PO-A',
        status: 'IN_PROGRESS',
        salesOrderLineId: 'line-a',
        variantLabel: '2-seat linen',
        quantity: 1,
        progressPercent: 20,
        workflow: { code: 'SOFA', nameEn: 'Sofa path', nameAr: 'مسار أريكة' },
        stages: [stage('CUT', 'Cutting', 'IN_PROGRESS', 20)],
      },
      {
        id: 'po-b',
        number: 'PO-B',
        status: 'IN_PROGRESS',
        salesOrderLineId: 'line-b',
        variantLabel: 'Armchair oak',
        quantity: 2,
        progressPercent: 90,
        workflow: { code: 'CHAIR', nameEn: 'Chair path', nameAr: 'مسار كرسي' },
        stages: [stage('UPHOLSTERY', 'Upholstery', 'IN_PROGRESS', 90)],
      },
      {
        id: 'po-c',
        number: 'PO-C',
        status: 'READY',
        salesOrderLineId: 'line-c',
        variantLabel: 'Coffee table',
        quantity: 1,
        progressPercent: 0,
        workflow: { code: 'TABLE', nameEn: 'Table path', nameAr: 'مسار طاولة' },
        stages: [stage('ASSEMBLY', 'Assembly', 'READY', 0)],
      },
    ],
  };
}

describe('selectOrderFlowItems', () => {
  it('lists every production item with its own workflow and progress', () => {
    const items = selectOrderFlowItems(threeItemOrder(), 'en');
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.productionOrderId)).toEqual(['po-a', 'po-b', 'po-c']);
    expect(items.map((i) => i.variantLabel)).toEqual([
      '2-seat linen',
      'Armchair oak',
      'Coffee table',
    ]);
    expect(items.map((i) => i.quantity)).toEqual([1, 2, 1]);
    expect(items.map((i) => i.workflowName)).toEqual(['Sofa path', 'Chair path', 'Table path']);
    expect(items.map((i) => i.progressPercent)).toEqual([20, 90, 0]);
    expect(items.map((i) => i.currentStageName)).toEqual(['Cutting', 'Upholstery', 'Assembly']);
  });

  it('does not collapse a multi-item order onto the highest-progress PO', () => {
    const items = selectOrderFlowItems(threeItemOrder(), 'en');
    const highest = items.reduce((a, b) => (b.progressPercent > a.progressPercent ? b : a));
    expect(highest.productionOrderId).toBe('po-b');
    expect(items[0]?.productionOrderId).toBe('po-a');
    expect(shouldSkipOrderFlowList(items)).toBe(false);
  });

  it('skips the list when the order has a single production item', () => {
    const order = threeItemOrder();
    order.productionOrders = [order.productionOrders![0]!];
    const items = selectOrderFlowItems(order, 'en');
    expect(items).toHaveLength(1);
    expect(shouldSkipOrderFlowList(items)).toBe(true);
  });
});
