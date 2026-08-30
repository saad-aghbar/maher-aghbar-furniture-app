import {
  enforceDealerStageStrip,
  nextStageAfter,
  selectProductionFlow,
  selectProductionFlowStatusBadge,
  type ProductionFlowStage,
} from '../selectProductionFlow';
import type { SalesOrderDetail } from '@/api/modules/sales-orders';
import type { ProductionOrderDetail } from '@/api/modules/production';

const salesOrder: SalesOrderDetail = {
  id: 'so-1',
  number: 'ORD-1',
  status: 'IN_PRODUCTION',
  priority: 'HIGH',
  title: 'Sofa',
  imageUrl: null,
  notes: null,
  externalOrderNumber: null,
  deliveryAddress: null,
  requiredDeliveryDate: '2026-09-01T00:00:00.000Z',
  progressPercent: 45,
  productionOrders: [
    {
      id: 'po-1',
      number: 'PO-1',
      status: 'IN_PROGRESS',
      progressPercent: 45,
      stages: [
        {
          code: 'CUT',
          nameEn: 'Cutting',
          nameAr: 'قص',
          sortOrder: 1,
          dependsOnCodes: [],
          status: 'COMPLETED',
          progressPercent: 100,
          assignees: [{ id: 'w1', name: 'Ali Hassan' }],
          blockers: [{ id: 'b1', category: 'MATERIAL', reason: 'Wood' }],
          notes: 'secret',
          isOverdue: false,
          actualStart: '2026-01-01T00:00:00.000Z',
          actualEnd: '2026-01-02T00:00:00.000Z',
        },
        {
          code: 'UPHOLSTERY',
          nameEn: 'Upholstery',
          nameAr: 'تنجيد',
          sortOrder: 2,
          dependsOnCodes: ['CUT'],
          status: 'IN_PROGRESS',
          progressPercent: 40,
        },
      ],
    },
  ],
};

describe('selectProductionFlow', () => {
  it('strips admin fields for dealer even when API leaks them', () => {
    const flow = selectProductionFlow(
      { kind: 'sales-order', order: salesOrder },
      'dealer',
      'en',
    );
    expect(flow.stages).toHaveLength(2);
    expect(flow.stages[0]?.name).toBe('Cutting');
    expect(flow.stages[0]?.assignees).toEqual([]);
    expect(flow.stages[0]?.blockers).toEqual([]);
    expect(flow.stages[0]?.notes).toBeNull();
    expect(flow.stages[0]?.actualStart).toBeNull();
    expect(flow.estimatedDelivery).toContain('2026-09-01');
  });

  it('keeps admin enrichments', () => {
    const flow = selectProductionFlow(
      { kind: 'sales-order', order: salesOrder },
      'admin',
      'en',
    );
    expect(flow.stages[0]?.assignees).toEqual([{ id: 'w1', name: 'Ali Hassan' }]);
    expect(flow.stages[0]?.blockers).toHaveLength(1);
    expect(flow.stages[0]?.notes).toBe('secret');
  });

  it('maps nested production stages for admin', () => {
    const order: ProductionOrderDetail = {
      id: 'po-1',
      number: 'PO-1',
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      progressPercent: 20,
      requiredDeliveryDate: null,
      stages: [
        {
          status: 'READY',
          progressPercent: 0,
          stageDefinition: {
            code: 'CUT',
            nameEn: 'Cutting',
            nameAr: 'قص',
            sortOrder: 1,
            dependsOnCodes: [],
          },
          tasks: [
            {
              id: 't1',
              number: 'T1',
              name: 'Cut',
              status: 'READY',
              assignedEmployee: { id: 'w1', firstName: 'Sam', lastName: 'Lee' },
              blockers: [],
            },
          ],
        },
      ],
    };
    const flow = selectProductionFlow(
      { kind: 'production-order', order },
      'admin',
      'en',
    );
    expect(flow.stages[0]?.code).toBe('CUT');
    expect(flow.stages[0]?.assignees[0]?.name).toBe('Sam Lee');
  });

  it('enforceDealerStageStrip clears admin-only keys', () => {
    const stage: ProductionFlowStage = {
      code: 'CUT',
      name: 'Cutting',
      status: 'IN_PROGRESS',
      progressPercent: 10,
      dependsOnCodes: [],
      sortOrder: 1,
      assignees: [{ id: '1', name: 'X' }],
      blockers: [{ id: 'b', category: 'X', reason: 'Y' }],
      actualStart: 'x',
      actualEnd: 'y',
      plannedEnd: 'z',
      isOverdue: true,
      notes: 'n',
      attachmentCount: 3,
      photos: [{ id: 'p1', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
    };
    const stripped = enforceDealerStageStrip(stage);
    expect(stripped.assignees).toEqual([]);
    expect(stripped.blockers).toEqual([]);
    expect(stripped.notes).toBeNull();
    expect(stripped.isOverdue).toBe(false);
    expect(stripped.attachmentCount).toBe(0);
    expect(stripped.photos).toHaveLength(1);
  });

  it('nextStageAfter returns the next incomplete stage', () => {
    const stages: ProductionFlowStage[] = [
      {
        code: 'A',
        name: 'A',
        status: 'COMPLETED',
        progressPercent: 100,
        dependsOnCodes: [],
        sortOrder: 1,
        assignees: [],
        blockers: [],
        actualStart: null,
        actualEnd: null,
        plannedEnd: null,
        isOverdue: false,
        notes: null,
        attachmentCount: 0,
        photos: [],
      },
      {
        code: 'B',
        name: 'B',
        status: 'READY',
        progressPercent: 0,
        dependsOnCodes: ['A'],
        sortOrder: 2,
        assignees: [],
        blockers: [],
        actualStart: null,
        actualEnd: null,
        plannedEnd: null,
        isOverdue: false,
        notes: null,
        attachmentCount: 0,
        photos: [],
      },
    ];
    expect(nextStageAfter(stages, 'A')?.code).toBe('B');
    expect(nextStageAfter(stages, 'B')).toBeNull();
  });
});

describe('selectProductionFlowStatusBadge', () => {
  it('does not show order READY while times are still awaiting approval', () => {
    const badge = selectProductionFlowStatusBadge({
      awaitingTimeApproval: true,
      role: 'admin',
      status: 'READY',
      promiseState: null,
    });
    expect(badge.status).toBe('AWAITING_APPROVAL');
    expect(badge.labelKey).toBe('mobile.production.workflow.awaitingTimeApprovalBadge');
  });

  it('keeps the order status once times are approved', () => {
    const badge = selectProductionFlowStatusBadge({
      awaitingTimeApproval: false,
      role: 'admin',
      status: 'READY',
      promiseState: null,
    });
    expect(badge).toEqual({ status: 'READY' });
  });

  it('still prefers dealer promise state when times are not awaiting approval', () => {
    const badge = selectProductionFlowStatusBadge({
      awaitingTimeApproval: false,
      role: 'dealer',
      status: 'READY',
      promiseState: 'ESTIMATED',
    });
    expect(badge).toEqual({ status: 'ESTIMATED' });
  });
});
