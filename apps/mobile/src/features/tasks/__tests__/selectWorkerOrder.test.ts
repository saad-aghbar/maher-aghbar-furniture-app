import {
  isLaneTaskOpenable,
  lockReasonText,
  mySalesOrdersFromResponse,
  selectWorkerOrderCard,
  selectWorkerSalesOrderCard,
  workerOrderMatchesQuery,
  workerSalesOrderHref,
} from '../selectWorkerOrder';
import type { WorkerMyOrder, WorkerMySalesOrder, WorkerOrderLaneNode } from '../api';

const order: WorkerMyOrder = {
  id: 'po-1',
  number: 'PO-1',
  salesOrderId: 'so-1',
  salesOrderLineId: 'line-1',
  salesOrderNumber: 'ORD-9',
  variantLabel: null,
  variantSku: null,
  status: 'IN_PROGRESS',
  quantity: 2,
  productDescription: 'Dining table',
  product: { id: 'p1', nameEn: 'Dining table', nameAr: 'طاولة طعام', nameHe: 'שולחן אוכל', imageUrl: null },
  productImageUrl: null,
  priority: 'HIGH',
  deadline: '2026-09-10T12:00:00.000Z',
  myTaskCount: 2,
  actionableCount: 1,
  blockedCount: 1,
};

describe('selectWorkerOrderCard', () => {
  it('drops stage names and keeps order identity', () => {
    const card = selectWorkerOrderCard(order, 'en');
    expect(card).not.toHaveProperty('department');
    expect(card).not.toHaveProperty('stageName');
    expect(card.number).toBe('ORD-9');
    expect(card.factoryOrderNumber).toBe('PO-1');
    expect(card.productTitle).toBe('Dining table');
    expect(card.blockedCount).toBe(1);
  });

  it('localizes the product title', () => {
    expect(selectWorkerOrderCard(order, 'ar').productTitle).toBe('طاولة طعام');
  });

  it('shows the variant label on the product title', () => {
    const card = selectWorkerOrderCard({ ...order, variantLabel: 'Ukrainian' }, 'en');
    expect(card.productTitle).toBe('Dining table · Ukrainian');
    expect(card.variantLabel).toBe('Ukrainian');
  });
});

describe('worker list sales-order grouping', () => {
  const ukrainian: WorkerMyOrder = {
    ...order,
    id: 'po-2',
    number: 'PO-2',
    salesOrderLineId: 'line-2',
    variantLabel: 'Ukrainian',
    myTaskCount: 1,
    actionableCount: 1,
    blockedCount: 0,
  };
  const classic: WorkerMyOrder = {
    ...order,
    id: 'po-3',
    number: 'PO-3',
    salesOrderLineId: 'line-3',
    variantLabel: 'Classic',
    myTaskCount: 1,
    actionableCount: 0,
    blockedCount: 1,
  };

  it('groups three production orders into one sales-order card with variant labels', () => {
    const grouped = mySalesOrdersFromResponse({
      data: [{ ...order, variantLabel: 'Standard' }, ukrainian, classic],
    });
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.items).toHaveLength(3);
    const card = selectWorkerSalesOrderCard(grouped[0]!, 'en');
    expect(card.itemCount).toBe(3);
    expect(card.productTitle).toBe('Dining table · Standard · Ukrainian · Classic');
    expect(card.number).toBe('ORD-9');
    expect(card.factoryOrderNumber).toBeNull();
    expect(workerSalesOrderHref(card)).toBe('/(app)/(employee)/orders/so-1');
  });

  it('always opens the items list, including a single production order', () => {
    const grouped: WorkerMySalesOrder[] = mySalesOrdersFromResponse({
      orders: [
        {
          salesOrderId: 'so-1',
          salesOrderNumber: 'ORD-9',
          deadline: order.deadline,
          priority: 'HIGH',
          myTaskCount: 2,
          actionableCount: 1,
          blockedCount: 1,
          items: [order],
        },
      ],
      data: [],
    });
    const card = selectWorkerSalesOrderCard(grouped[0]!, 'en');
    expect(card.itemCount).toBe(1);
    expect(card.factoryOrderNumber).toBe('PO-1');
    expect(workerSalesOrderHref(card)).toBe('/(app)/(employee)/orders/so-1');
  });

  it('marks sibling production orders as view-only', () => {
    const card = selectWorkerOrderCard({ ...order, assignedToMe: false }, 'en');
    expect(card.assignedToMe).toBe(false);
  });
});

describe('workerOrderMatchesQuery', () => {
  it('matches an empty query', () => {
    expect(workerOrderMatchesQuery(order, '  ')).toBe(true);
  });

  it('matches sales-order number, PO number, and product names in any locale', () => {
    expect(workerOrderMatchesQuery(order, 'ord-9')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'PO-1')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'ord9')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'dining')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'طاولة')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'שולחן')).toBe(true);
  });

  it('matches variant labels so same-order rows stay distinguishable', () => {
    expect(workerOrderMatchesQuery({ ...order, variantLabel: 'Ukrainian' }, 'ukrainian')).toBe(
      true,
    );
  });

  it('matches dealer name, external number, and assigned stage', () => {
    const assigned: WorkerMyOrder = {
      ...order,
      externalOrderNumber: 'EXT-441',
      dealer: { nameEn: 'Al Noor', nameAr: 'النور', nameHe: null, code: 'D-12' },
      assignedStages: [{ code: 'CARPENTRY', nameEn: 'Carpentry', nameAr: 'نجارة', nameHe: null }],
    };
    expect(workerOrderMatchesQuery(assigned, 'carpentry')).toBe(true);
    expect(workerOrderMatchesQuery(assigned, 'نجارة')).toBe(true);
    expect(workerOrderMatchesQuery(assigned, 'ext-441')).toBe(true);
    expect(workerOrderMatchesQuery(assigned, 'noor')).toBe(true);
  });

  it('requires every token to hit the haystack', () => {
    expect(workerOrderMatchesQuery(order, 'ord dining')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'ord sofa')).toBe(false);
    expect(workerOrderMatchesQuery(order, 'wardrobe')).toBe(false);
  });
});

describe('lane lock visibility', () => {
  const locked: WorkerOrderLaneNode = {
    id: 'n-asm',
    kind: 'task',
    taskId: 't2',
    assignedToMe: true,
    stageCode: 'ASSEMBLY',
    stageName: 'Assembly',
    nameEn: 'Assembly',
    nameAr: null,
    nameHe: null,
    status: 'NOT_STARTED',
    sortOrder: 4,
    dependsOnIds: ['n-paint'],
    dependsOnCodes: ['PAINTING'],
    dependsOnNames: ['Painting'],
    plannedStart: null,
    plannedCompletion: null,
    lockState: { kind: 'locked', reason: 'PREDECESSOR_NOT_COMPLETE', waitingOnStageName: 'Painting' },
  };

  it('does not open locked rows and explains the wait', () => {
    expect(isLaneTaskOpenable(locked)).toBe(false);
    expect(
      lockReasonText(locked.lockState, (key, vars) =>
        key === 'mobile.tasks.lockWaitingOn' ? `Waiting on ${vars?.stage}` : key,
      ),
    ).toBe('Waiting on Painting');
  });

  it('opens receive and open rows', () => {
    expect(
      isLaneTaskOpenable({
        ...locked,
        lockState: { kind: 'needs_receive', fromStageName: 'Carpentry' },
      }),
    ).toBe(true);
    expect(
      isLaneTaskOpenable({
        ...locked,
        lockState: { kind: 'open' },
      }),
    ).toBe(true);
  });

  it('does not open completed rows', () => {
    expect(
      isLaneTaskOpenable({
        ...locked,
        status: 'COMPLETED',
        lockState: { kind: 'done' },
      }),
    ).toBe(false);
  });
});
