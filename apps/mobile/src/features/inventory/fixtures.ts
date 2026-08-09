/**
 * Sample warehouse transfers + stock counts for unit tests / Storybook.
 * Live Inventory tabs use GET /inventory/transfers and GET /inventory/counts.
 */

export type MockWarehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};

export type MockTransferLine = {
  id: string;
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  quantity: number;
  unit: string;
};

export type MockTransfer = {
  id: string;
  number: string;
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED';
  notes: string | null;
  createdAt: string;
  fromWarehouse: MockWarehouse;
  toWarehouse: MockWarehouse;
  lines: MockTransferLine[];
};

export type MockCountLine = {
  id: string;
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  systemQty: number;
  countedQty: number | null;
  unit: string;
};

export type MockStockCount = {
  id: string;
  number: string;
  status: 'DRAFT' | 'POSTED';
  kind: 'PERIODIC' | 'SURPRISE';
  createdAt: string;
  warehouse: MockWarehouse;
  lines: MockCountLine[];
};

const WH_MAIN: MockWarehouse = {
  id: 'wh-main',
  code: 'MAIN',
  nameEn: 'Main warehouse',
  nameAr: 'المستودع الرئيسي',
};

const WH_SHOP: MockWarehouse = {
  id: 'wh-shop',
  code: 'SHOP',
  nameEn: 'Shop floor',
  nameAr: 'صالة الإنتاج',
};

const WH_SHOW: MockWarehouse = {
  id: 'wh-show',
  code: 'SHOW',
  nameEn: 'Showroom',
  nameAr: 'صالة العرض',
};

export const inventoryTransfersFixture: MockTransfer[] = [
  {
    id: 'trf-1',
    number: 'TRF-2026-0042',
    status: 'IN_TRANSIT',
    notes: 'Foam for lobby sofa run',
    createdAt: '2026-08-05T09:20:00.000Z',
    fromWarehouse: WH_MAIN,
    toWarehouse: WH_SHOP,
    lines: [
      {
        id: 'trl-1',
        inventoryItemId: 'inv-foam-01',
        sku: 'FOAM-HR-50',
        nameEn: 'HR foam 50mm',
        nameAr: 'إسفنج HR 50مم',
        quantity: 24,
        unit: 'pcs',
      },
      {
        id: 'trl-2',
        inventoryItemId: 'inv-foam-02',
        sku: 'FOAM-HR-30',
        nameEn: 'HR foam 30mm',
        nameAr: 'إسفنج HR 30مم',
        quantity: 12,
        unit: 'pcs',
      },
    ],
  },
  {
    id: 'trf-2',
    number: 'TRF-2026-0041',
    status: 'DRAFT',
    notes: null,
    createdAt: '2026-08-04T14:05:00.000Z',
    fromWarehouse: WH_MAIN,
    toWarehouse: WH_SHOW,
    lines: [
      {
        id: 'trl-3',
        inventoryItemId: 'inv-fab-01',
        sku: 'FAB-VEL-IVORY',
        nameEn: 'Velvet ivory',
        nameAr: 'قطيفة عاجي',
        quantity: 40,
        unit: 'm',
      },
    ],
  },
  {
    id: 'trf-3',
    number: 'TRF-2026-0038',
    status: 'COMPLETED',
    notes: 'Accessories restock',
    createdAt: '2026-08-02T11:40:00.000Z',
    fromWarehouse: WH_MAIN,
    toWarehouse: WH_SHOP,
    lines: [
      {
        id: 'trl-4',
        inventoryItemId: 'inv-acc-01',
        sku: 'ACC-LEG-BRASS',
        nameEn: 'Brass sofa legs',
        nameAr: 'أرجل نحاسية',
        quantity: 80,
        unit: 'pcs',
      },
      {
        id: 'trl-5',
        inventoryItemId: 'inv-acc-02',
        sku: 'ACC-ZIP-YKK',
        nameEn: 'YKK zippers',
        nameAr: 'سحابات YKK',
        quantity: 200,
        unit: 'pcs',
      },
      {
        id: 'trl-6',
        inventoryItemId: 'inv-wood-01',
        sku: 'WOOD-BEECH-2x4',
        nameEn: 'Beech 2×4',
        nameAr: 'زان 2×4',
        quantity: 30,
        unit: 'pcs',
      },
    ],
  },
  {
    id: 'trf-4',
    number: 'TRF-2026-0035',
    status: 'COMPLETED',
    notes: 'Showroom sample fabrics',
    createdAt: '2026-07-28T08:15:00.000Z',
    fromWarehouse: WH_SHOP,
    toWarehouse: WH_SHOW,
    lines: [
      {
        id: 'trl-7',
        inventoryItemId: 'inv-fab-02',
        sku: 'FAB-LINEN-SAGE',
        nameEn: 'Linen sage',
        nameAr: 'كتان مريمي',
        quantity: 15,
        unit: 'm',
      },
    ],
  },
  {
    id: 'trf-5',
    number: 'TRF-2026-0031',
    status: 'DRAFT',
    notes: 'Wood for dining set frames',
    createdAt: '2026-07-25T16:30:00.000Z',
    fromWarehouse: WH_MAIN,
    toWarehouse: WH_SHOP,
    lines: [
      {
        id: 'trl-8',
        inventoryItemId: 'inv-wood-02',
        sku: 'WOOD-OAK-PLY',
        nameEn: 'Oak plywood 18mm',
        nameAr: 'خشب سنديان 18مم',
        quantity: 18,
        unit: 'sht',
      },
      {
        id: 'trl-9',
        inventoryItemId: 'inv-wood-03',
        sku: 'WOOD-MDF-18',
        nameEn: 'MDF 18mm',
        nameAr: 'MDF 18مم',
        quantity: 25,
        unit: 'sht',
      },
    ],
  },
];

export const inventoryStockCountsFixture: MockStockCount[] = [
  {
    id: 'cnt-1',
    number: 'CNT-2026-0019',
    status: 'DRAFT',
    kind: 'PERIODIC',
    createdAt: '2026-08-05T07:50:00.000Z',
    warehouse: WH_MAIN,
    lines: [
      {
        id: 'cl-1',
        inventoryItemId: 'inv-fab-01',
        sku: 'FAB-VEL-IVORY',
        nameEn: 'Velvet ivory',
        nameAr: 'قطيفة عاجي',
        systemQty: 120,
        countedQty: 118,
        unit: 'm',
      },
      {
        id: 'cl-2',
        inventoryItemId: 'inv-fab-02',
        sku: 'FAB-LINEN-SAGE',
        nameEn: 'Linen sage',
        nameAr: 'كتان مريمي',
        systemQty: 64,
        countedQty: null,
        unit: 'm',
      },
      {
        id: 'cl-3',
        inventoryItemId: 'inv-foam-01',
        sku: 'FOAM-HR-50',
        nameEn: 'HR foam 50mm',
        nameAr: 'إسفنج HR 50مم',
        systemQty: 48,
        countedQty: 48,
        unit: 'pcs',
      },
    ],
  },
  {
    id: 'cnt-2',
    number: 'CNT-2026-0018',
    status: 'POSTED',
    kind: 'SURPRISE',
    createdAt: '2026-08-01T13:10:00.000Z',
    warehouse: WH_SHOP,
    lines: [
      {
        id: 'cl-4',
        inventoryItemId: 'inv-acc-01',
        sku: 'ACC-LEG-BRASS',
        nameEn: 'Brass sofa legs',
        nameAr: 'أرجل نحاسية',
        systemQty: 160,
        countedQty: 152,
        unit: 'pcs',
      },
      {
        id: 'cl-5',
        inventoryItemId: 'inv-acc-02',
        sku: 'ACC-ZIP-YKK',
        nameEn: 'YKK zippers',
        nameAr: 'سحابات YKK',
        systemQty: 500,
        countedQty: 500,
        unit: 'pcs',
      },
    ],
  },
  {
    id: 'cnt-3',
    number: 'CNT-2026-0015',
    status: 'POSTED',
    kind: 'PERIODIC',
    createdAt: '2026-07-20T10:00:00.000Z',
    warehouse: WH_SHOW,
    lines: [
      {
        id: 'cl-6',
        inventoryItemId: 'inv-fab-02',
        sku: 'FAB-LINEN-SAGE',
        nameEn: 'Linen sage',
        nameAr: 'كتان مريمي',
        systemQty: 22,
        countedQty: 22,
        unit: 'm',
      },
    ],
  },
  {
    id: 'cnt-4',
    number: 'CNT-2026-0012',
    status: 'DRAFT',
    kind: 'SURPRISE',
    createdAt: '2026-07-15T09:25:00.000Z',
    warehouse: WH_MAIN,
    lines: [
      {
        id: 'cl-7',
        inventoryItemId: 'inv-wood-01',
        sku: 'WOOD-BEECH-2x4',
        nameEn: 'Beech 2×4',
        nameAr: 'زان 2×4',
        systemQty: 90,
        countedQty: 88,
        unit: 'pcs',
      },
      {
        id: 'cl-8',
        inventoryItemId: 'inv-wood-02',
        sku: 'WOOD-OAK-PLY',
        nameEn: 'Oak plywood 18mm',
        nameAr: 'خشب سنديان 18مم',
        systemQty: 40,
        countedQty: null,
        unit: 'sht',
      },
    ],
  },
];

export function filterMockTransfers(rows: MockTransfer[], q: string): MockTransfer[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = [
      row.number,
      row.status,
      row.notes ?? '',
      row.fromWarehouse.code,
      row.fromWarehouse.nameEn,
      row.fromWarehouse.nameAr,
      row.toWarehouse.code,
      row.toWarehouse.nameEn,
      row.toWarehouse.nameAr,
      ...row.lines.flatMap((l) => [l.sku, l.nameEn, l.nameAr]),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function filterMockStockCounts(rows: MockStockCount[], q: string): MockStockCount[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = [
      row.number,
      row.status,
      row.kind,
      row.warehouse.code,
      row.warehouse.nameEn,
      row.warehouse.nameAr,
      ...row.lines.flatMap((l) => [l.sku, l.nameEn, l.nameAr]),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}
