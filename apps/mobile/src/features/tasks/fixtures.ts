import type { TaskDetail, TaskListItem } from './api';

export const openTasksFixture: TaskListItem[] = [
  {
    id: 'task-urgent-1',
    number: 'PT-1001',
    name: 'Cutting — Table Top',
    description: 'Cut table top to drawing dimensions.',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    plannedCompletion: '2026-08-05T14:00:00.000Z',
    productImageUrl: null,
    factoryOrderNumber: 'PO-220',
    salesOrderNumber: 'ORD-1256',
    productionOrder: {
      id: 'po-220',
      number: 'PO-220',
      productDescription: 'Dining Table',
      product: {
        nameEn: 'Dining Table',
        nameAr: 'طاولة طعام',
        imageUrl: null,
      },
      salesOrder: { id: 'so-1', number: 'ORD-1256' },
    },
    stageDefinition: {
      code: 'CUT',
      nameEn: 'Cutting',
      nameAr: 'القص',
      requiresPhotos: false,
    },
  },
  {
    id: 'task-ready-2',
    number: 'PT-1002',
    name: 'Assembly — Dining Chair',
    description: 'Assemble frame and seat.',
    status: 'READY',
    priority: 'NORMAL',
    plannedCompletion: '2026-08-05T17:00:00.000Z',
    productImageUrl: null,
    factoryOrderNumber: 'PO-221',
    salesOrderNumber: 'ORD-1258',
    productionOrder: {
      id: 'po-221',
      number: 'PO-221',
      productDescription: 'Dining Chair',
      product: { nameEn: 'Dining Chair', imageUrl: null },
      salesOrder: { id: 'so-2', number: 'ORD-1258' },
    },
    stageDefinition: { code: 'ASM', nameEn: 'Assembly', requiresPhotos: true },
  },
];

const urgent = openTasksFixture[0]!;

export const completedTasksFixture: TaskListItem[] = [
  {
    id: 'task-done-1',
    number: 'PT-0990',
    name: 'Finishing — Sideboard',
    status: 'COMPLETED',
    priority: 'HIGH',
    plannedCompletion: '2026-08-04T16:00:00.000Z',
    productImageUrl: null,
    factoryOrderNumber: 'PO-210',
    salesOrderNumber: 'ORD-1240',
    productionOrder: {
      id: 'po-210',
      number: 'PO-210',
      productDescription: 'Sideboard',
      product: { nameEn: 'Sideboard', imageUrl: null },
      salesOrder: { id: 'so-3', number: 'ORD-1240' },
    },
    stageDefinition: { code: 'FIN', nameEn: 'Finishing' },
  },
];

export const taskDetailFixture: TaskDetail = {
  id: urgent.id,
  number: urgent.number,
  name: urgent.name,
  description: urgent.description,
  status: urgent.status,
  priority: urgent.priority,
  plannedCompletion: urgent.plannedCompletion,
  productImageUrl: urgent.productImageUrl,
  factoryOrderNumber: urgent.factoryOrderNumber,
  salesOrderNumber: urgent.salesOrderNumber,
  notes: null,
  photos: [],
  attachments: [
    {
      id: 'doc-1',
      fileName: 'frame-drawing.pdf',
      mimeType: 'application/pdf',
      category: 'DRAWING',
      createdAt: '2026-08-05T08:00:00.000Z',
      downloadPath: '/api/v1/uploads/download?token=demo',
    },
  ],
  productionOrder: {
    id: 'po-220',
    number: 'PO-220',
    productDescription: 'Dining Table',
    product: {
      nameEn: 'Dining Table',
      nameAr: 'طاولة طعام',
      imageUrl: null,
    },
    salesOrder: { id: 'so-1', number: 'ORD-1256' },
    quantity: 4,
    specifications: 'Please assemble the pieces according to the dimensions in the drawing.',
  },
  stageDefinition: {
    code: 'CUT',
    nameEn: 'Cutting',
    nameAr: 'القص',
    requiresPhotos: false,
    dependsOnCodes: [],
  },
  blockers: [],
  timing: {
    status: 'running',
    actualMinutes: 12,
    actualSeconds: 12 * 60,
    openStartedAt: '2026-08-09T11:50:00.000Z',
    estimatedMinutes: 90,
    plannedCompletion: urgent.plannedCompletion ?? null,
    elapsedMinutes: 12,
  },
};
