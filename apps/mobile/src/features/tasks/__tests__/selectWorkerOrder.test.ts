import {
  isLaneTaskOpenable,
  lockReasonText,
  selectWorkerOrderCard,
  workerOrderMatchesQuery,
} from '../selectWorkerOrder';
import type { WorkerMyOrder, WorkerOrderLaneNode } from '../api';

const order: WorkerMyOrder = {
  id: 'po-1',
  number: 'PO-1',
  salesOrderNumber: 'ORD-9',
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
    expect(card.productTitle).toBe('Dining table');
    expect(card.blockedCount).toBe(1);
  });

  it('localizes the product title', () => {
    expect(selectWorkerOrderCard(order, 'ar').productTitle).toBe('طاولة طعام');
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
