import {
  isLaneTaskOpenable,
  lockReasonText,
  mySalesOrdersFromResponse,
  selectWorkerOrderCard,
  selectWorkerSalesOrderCard,
  workerItemWorkState,
  workerOrderMatchesQuery,
  workerSalesOrderHref,
} from '../selectWorkerOrder';
import type { WorkerMyOrder, WorkerMySalesOrder, WorkerOrderLaneNode } from '../api';

const order: WorkerMyOrder = {
  id: 'po-1',
  number: 'SO-DEMO-0009.A',
  salesOrderId: 'so-1',
  salesOrderLineId: 'line-1',
  salesOrderNumber: 'SO-DEMO-0009',
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
    expect(card.number).toBe('SO-DEMO-0009');
    expect(card.factoryOrderNumber).toBe('SO-DEMO-0009.A');
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
    number: 'SO-DEMO-0009.B',
    salesOrderLineId: 'line-2',
    variantLabel: 'Ukrainian',
    myTaskCount: 1,
    actionableCount: 1,
    blockedCount: 0,
  };
  const classic: WorkerMyOrder = {
    ...order,
    id: 'po-3',
    number: 'SO-DEMO-0009.C',
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
    expect(card.items).toHaveLength(3);
    expect(card.items.map((item) => item.id)).toEqual(['po-1', 'po-2', 'po-3']);
    expect(card.items[1]?.variantLabel).toBe('Ukrainian');
    expect(card.items[1]?.productTitle).toBe('Dining table · Ukrainian');
    expect(card.productTitle).toBe('Dining table · Standard · Ukrainian · Classic');
    expect(card.number).toBe('SO-DEMO-0009');
    expect(card.factoryOrderNumber).toBeNull();
    expect(workerSalesOrderHref(card)).toBe('/(app)/(employee)/orders/so-1');
  });

  it('always opens the items list, including a single production order', () => {
    const grouped: WorkerMySalesOrder[] = mySalesOrdersFromResponse({
      orders: [
        {
          salesOrderId: 'so-1',
          salesOrderNumber: 'SO-DEMO-0009',
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
    expect(card.factoryOrderNumber).toBe('SO-DEMO-0009.A');
    expect(workerSalesOrderHref(card)).toBe('/(app)/(employee)/orders/so-1');
  });

  it('marks sibling production orders as view-only', () => {
    const card = selectWorkerOrderCard({ ...order, assignedToMe: false }, 'en');
    expect(card.assignedToMe).toBe(false);
  });
});

describe('workerItemWorkState', () => {
  it('is done when assigned with no remaining stages', () => {
    expect(
      workerItemWorkState({
        assignedToMe: true,
        myTaskCount: 0,
        actionableCount: 0,
        blockedCount: 0,
      }),
    ).toBe('done');
  });

  it('is locked when blockedCount > 0 (same as Locked)', () => {
    expect(
      workerItemWorkState({
        assignedToMe: true,
        myTaskCount: 2,
        actionableCount: 0,
        blockedCount: 2,
      }),
    ).toBe('locked');
  });

  it('stays open when some stages are actionable even if others are blocked', () => {
    expect(
      workerItemWorkState({
        assignedToMe: true,
        myTaskCount: 2,
        actionableCount: 1,
        blockedCount: 1,
      }),
    ).toBe('open');
  });

  it('is locked when remaining work exists but nothing is actionable', () => {
    expect(
      workerItemWorkState({
        assignedToMe: true,
        myTaskCount: 2,
        actionableCount: 0,
        blockedCount: 0,
      }),
    ).toBe('locked');
  });

  it('is open when there is actionable work', () => {
    expect(
      workerItemWorkState({
        assignedToMe: true,
        myTaskCount: 2,
        actionableCount: 2,
        blockedCount: 0,
      }),
    ).toBe('open');
  });

  it('does not treat view-only alone as locked', () => {
    expect(
      workerItemWorkState({
        assignedToMe: false,
        myTaskCount: 0,
        actionableCount: 0,
        blockedCount: 0,
      }),
    ).toBe('open');
  });

  it('locks view-only siblings that still report blocked remaining work', () => {
    expect(
      workerItemWorkState({
        assignedToMe: false,
        myTaskCount: 1,
        actionableCount: 0,
        blockedCount: 1,
      }),
    ).toBe('locked');
  });
});

describe('workerOrderMatchesQuery', () => {
  it('matches an empty query', () => {
    expect(workerOrderMatchesQuery(order, '  ')).toBe(true);
  });

  it('matches sales-order number, PO number, and product names in any locale', () => {
    expect(workerOrderMatchesQuery(order, 'so-demo-0009')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'SO-DEMO-0009.A')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'demo0009')).toBe(true);
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
    expect(workerOrderMatchesQuery(order, 'demo dining')).toBe(true);
    expect(workerOrderMatchesQuery(order, 'demo sofa')).toBe(false);
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
