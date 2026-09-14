import {
  planItemIsReady,
  selectPlanItemFloor,
  selectPlanItemsFloor,
  type PlanItemLineSource,
} from '../selectPlanItemsFloor';

function line(partial: Partial<PlanItemLineSource> = {}): PlanItemLineSource {
  return {
    id: 'l1',
    salesOrderLineId: 'sol-1',
    manufacturingName: 'طاولة سفرة لستة',
    description: null,
    manufacturingComplexity: 'STANDARD',
    quantity: 1,
    imageUrl: null,
    product: {
      id: 'p1',
      sku: 'TABLE-DIN-6',
      nameEn: 'Dining table for six',
      nameAr: 'طاولة سفرة لستة',
      imageUrl: 'https://img.example/din6.jpg',
    },
    requestedFabricLabel: null,
    workflowId: 'wf-std',
    sectionProgress: {
      spec: true,
      materials: true,
      workflow: true,
    },
    issues: [],
    ...partial,
  };
}

describe('selectPlanItemsFloor', () => {
  it('maps a standard line onto the plan-item floor model', () => {
    const item = selectPlanItemFloor(line(), 'ar');
    expect(item.title).toBe('طاولة سفرة لستة');
    expect(item.sku).toBe('TABLE-DIN-6');
    expect(item.complexity).toBe('standard');
    expect(item.imageUrl).toBe('https://img.example/din6.jpg');
    expect(item.attention).toBe(false);
    expect(item.needsWorkflow).toBe(false);
    expect(item.sections.map((row) => [row.key, row.done, row.alert])).toEqual([
      ['spec', true, false],
      ['materials', true, false],
      ['workflow', true, false],
    ]);
    expect(planItemIsReady(item)).toBe(true);
  });

  it('flags custom lines that still need a workflow', () => {
    const item = selectPlanItemFloor(
      line({
        id: 'l2',
        salesOrderLineId: 'sol-2',
        manufacturingName: 'طاولة جانبية',
        manufacturingComplexity: 'CUSTOM',
        workflowId: null,
        product: {
          id: 'p2',
          sku: 'TABLE-SIDE',
          nameEn: 'Side table',
          nameAr: 'طاولة جانبية',
          imageUrl: 'https://img.example/side.jpg',
        },
        sectionProgress: { spec: true, materials: true, workflow: false },
      }),
      'ar',
    );
    expect(item.complexity).toBe('custom');
    expect(item.needsWorkflow).toBe(true);
    expect(item.attention).toBe(true);
    expect(item.sections.find((row) => row.key === 'workflow')).toEqual({
      key: 'workflow',
      done: false,
      alert: true,
    });
    expect(planItemIsReady(item)).toBe(false);
  });

  it('rolls the parent board from sibling lines and setup progress', () => {
    const floor = selectPlanItemsFloor({
      locale: 'en',
      orderNumber: 'SO-2026-00026',
      dealer: { nameEn: 'Nile Interiors', nameAr: 'النيل للديكور', code: 'CUS-0101' },
      progress: { readyLines: 1, totalLines: 2, percent: 50 },
      lines: [
        line(),
        line({
          id: 'l2',
          salesOrderLineId: 'sol-2',
          manufacturingComplexity: 'CUSTOM',
          workflowId: null,
          sectionProgress: { spec: true, materials: false, workflow: false },
        }),
      ],
    });
    expect(floor.orderNumber).toBe('SO-2026-00026');
    expect(floor.dealerName).toBe('Nile Interiors');
    expect(floor.itemCount).toBe(2);
    expect(floor.readyCount).toBe(1);
    expect(floor.progressPercent).toBe(50);
    expect(floor.items).toHaveLength(2);
  });

  it('computes ready count when setup progress is missing', () => {
    const floor = selectPlanItemsFloor({
      locale: 'en',
      lines: [
        line(),
        line({
          id: 'l2',
          salesOrderLineId: 'sol-2',
          manufacturingComplexity: 'MODIFIED',
          sectionProgress: { spec: true, materials: true, workflow: true },
        }),
      ],
    });
    expect(floor.items[1]?.complexity).toBe('modified');
    expect(floor.readyCount).toBe(2);
    expect(floor.progressPercent).toBe(100);
  });
});
