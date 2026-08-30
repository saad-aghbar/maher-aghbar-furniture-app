import {
  productionFloorStatusLabel,
  selectProductionCard,
  selectProductionDetail,
  workersForStage,
} from '../selectProduction';
import type { ProductionOrderDetail, ProductionOrderListItem } from '../api';
import { selectOrderDetail } from '@/features/sales-orders/selectOrderDetail';
import {
  adminOrderDetailFixture,
  dealerOrderDetailFixture,
} from '@/features/sales-orders/detailFixtures';

const listItem: ProductionOrderListItem = {
  id: 'po-1',
  number: 'PO-100',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  progressPercent: 55,
  productDescription: 'Modern Sofa',
  requiredDeliveryDate: '2026-01-01T00:00:00.000Z',
  isLate: true,
  imageUrl: 'https://example.com/sofa.jpg',
  customer: { id: 'c1', nameEn: 'Ahmed Traders', nameAr: 'أحمد' },
  product: {
    id: 'p1',
    nameEn: 'Modern Sofa',
    nameAr: 'كنبة',
    imageUrl: 'https://example.com/sofa.jpg',
  },
};

const detail: ProductionOrderDetail = {
  ...listItem,
  stages: [{ id: 'stage-should-not-surface', code: 'CUT' }],
  tasks: [
    {
      id: 't1',
      number: 'T-1',
      name: 'Cutting',
      status: 'READY',
      priority: 'URGENT',
      progressPercent: 0,
      notes: 'Need sharp blades',
      assignedEmployee: null,
      blockers: [],
      stageDefinition: {
        code: 'CUT',
        nameEn: 'Cutting',
        nameAr: 'قص',
        responsibleDepartment: 'CUTTING',
      },
    },
    {
      id: 't2',
      number: 'T-2',
      name: 'Assembly',
      status: 'COMPLETED',
      priority: 'NORMAL',
      progressPercent: 100,
      assignedEmployee: { id: 'w1', firstName: 'Sam', lastName: 'Worker' },
      blockers: [],
      stageDefinition: {
        code: 'ASM',
        nameEn: 'Assembly',
        responsibleDepartment: 'ASSEMBLY',
      },
    },
    {
      id: 't3',
      number: 'T-3',
      name: 'Upholstery',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progressPercent: 57,
      assignedEmployeeId: 'w2',
      assignedEmployee: { id: 'w2', firstName: 'Lina', lastName: 'Awad' },
      blockers: [],
      stageDefinition: {
        code: 'UPH',
        nameEn: 'Upholstery',
        responsibleDepartment: 'UPHOLSTERY',
      },
    },
  ],
  openBlockers: [],
};

describe('productionFloorStatusLabel', () => {
  it('uses In production for IN_PROGRESS and IN_PRODUCTION', () => {
    expect(productionFloorStatusLabel('IN_PROGRESS', 'In production')).toBe(
      'In production',
    );
    expect(productionFloorStatusLabel('in progress', 'In production')).toBe(
      'In production',
    );
    expect(productionFloorStatusLabel('IN_PRODUCTION', 'In production')).toBe(
      'In production',
    );
  });

  it('leaves other production-order statuses to the status map', () => {
    expect(productionFloorStatusLabel('PLANNED', 'In production')).toBeUndefined();
    expect(productionFloorStatusLabel('COMPLETED', 'In production')).toBeUndefined();
    expect(productionFloorStatusLabel('ON_HOLD', 'In production')).toBeUndefined();
  });
});

describe('selectProduction', () => {
  it('maps dealer, model image, priority, and progress without stages', () => {
    const card = selectProductionCard(listItem, 'en');
    expect(card.dealerName).toBe('Ahmed Traders');
    expect(card.imageUrl).toContain('sofa');
    expect(card.priority).toBe('HIGH');
    expect(card.progressPercent).toBe(55);
    expect(card.isLate).toBe(true);
    expect(card.showStages).toBe(false);
  });

  it('keeps showStages false even when API includes stages', () => {
    const vm = selectProductionDetail(detail, 'en');
    expect(vm.showStages).toBe(false);
    expect(vm.tasks).toHaveLength(3);
    expect(vm.tasks[0]?.canAssign).toBe(true);
    expect(vm.tasks[1]?.canAssign).toBe(false);
    expect(vm.tasks[2]?.canAssign).toBe(false);
    expect(vm.tasks[2]?.canHold).toBe(true);
    expect(vm.tasks[0]?.responsibleDepartment).toBe('CUTTING');
    expect(vm.tasks[0]?.departmentLabel).toBe('Cutting');
    expect(vm.tasks[0]?.name).toBe('Cutting');
    expect(vm.tasks[0]?.notes).toBe('Need sharp blades');
    expect(vm).not.toHaveProperty('stages');
    expect(vm.estimatedManufacturingCost).toBeNull();
    expect(vm.actualManufacturingCost).toBeNull();
  });

  it('reads catalog estimate and never fakes actual or zero', () => {
    const withCost = selectProductionDetail(
      {
        ...detail,
        product: { ...detail.product!, manufacturingCost: '380.50' },
      },
      'en',
    );
    expect(withCost.estimatedManufacturingCost).toBe(380.5);
    expect(withCost.actualManufacturingCost).toBeNull();

    const zero = selectProductionDetail(
      {
        ...detail,
        product: { ...detail.product!, manufacturingCost: 0 },
      },
      'en',
    );
    expect(zero.estimatedManufacturingCost).toBeNull();
    expect(zero.actualManufacturingCost).toBeNull();
  });

  it('filters workers to the stage department', () => {
    const workers = [
      {
        id: 'a',
        firstName: 'A',
        lastName: 'Cut',
        department: { id: '1', code: 'CUTTING', nameEn: 'Cutting', nameAr: 'قص' },
      },
      {
        id: 'b',
        firstName: 'B',
        lastName: 'Asm',
        department: { id: '2', code: 'ASSEMBLY', nameEn: 'Assembly', nameAr: 'تجميع' },
      },
    ];
    expect(workersForStage(workers, 'CUTTING')).toHaveLength(1);
    expect(workersForStage(workers, 'CUTTING')[0]?.id).toBe('a');
    expect(workersForStage(workers, null)).toHaveLength(2);
  });
});

describe('dealer order detail keeps safe workflow stages', () => {
  it('maps dealer-safe stages without factory costs', () => {
    const dealer = selectOrderDetail(dealerOrderDetailFixture, 'dealer');
    expect(dealer.showStages).toBe(true);
    expect(dealer.stages.length).toBeGreaterThan(0);
    expect(dealer.progressPercent).toBeGreaterThanOrEqual(0);
    expect(dealer.manufacturingCost).toBeNull();
  });

  it('keeps stages when admin payload is mapped as dealer but strips worker', () => {
    const dealer = selectOrderDetail(adminOrderDetailFixture, 'dealer');
    expect(dealer.stages.length).toBeGreaterThan(0);
    expect(dealer.assignedWorkerName).toBeNull();
  });
});
