import { inflateSync } from 'node:zlib';
import { buildRawMaterialsReportPdf } from './raw-materials-report-pdf';
import {
  RAW_MATERIALS_COST_BASIS_ID,
  type RawMaterialsReportPayload,
} from './raw-materials-report';

jest.retryTimes(1);
jest.setTimeout(120_000);

function pageCount(buf: Buffer): number {
  const text = buf.toString('latin1');
  return text.match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
}

function inflatePdfStrings(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const chunks: string[] = [raw];
  const re =
    /<<\r?\n\/Length (\d+)\r?\n\/Filter \/FlateDecode\r?\n>>\r?\nstream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const len = Number(m[1]);
    const start = m.index + m[0].length;
    try {
      const bytes = Buffer.from(raw.slice(start, start + len), 'latin1');
      chunks.push(inflateSync(bytes).toString('utf16le'));
      chunks.push(inflateSync(bytes).toString('utf8'));
      chunks.push(inflateSync(bytes).toString('latin1'));
    } catch {
      /* not flate */
    }
  }
  return chunks.join('\n');
}

function decodeWinAnsi(buf: Buffer): string {
  const inflated = inflatePdfStrings(buf);
  return [...inflated.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((m) => {
      try {
        return Buffer.from(m[1]!, 'hex').toString('latin1');
      } catch {
        return '';
      }
    })
    .join('');
}

function pdfHasLatin(buf: Buffer, needle: string): boolean {
  return decodeWinAnsi(buf).includes(needle);
}

function pdfHasOutlines(buf: Buffer): boolean {
  const inflated = inflatePdfStrings(buf);
  return /\s[mv]\s/.test(inflated) && inflated.includes(' cm\n');
}

function mediaBoxes(buf: Buffer): number[][] {
  return [...buf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*([^\]]+)\]/g)].map((m) =>
    (m[1] ?? '')
      .trim()
      .split(/\s+/)
      .map(Number),
  );
}

function samplePayload(locale: 'en' | 'ar' | 'he'): RawMaterialsReportPayload {
  return {
    generatedAt: '2026-09-03T09:00:00.000Z',
    generatedBy: 'Ada Min',
    locale,
    timezone: 'Asia/Amman',
    currency: 'ILS',
    costBasisId: RAW_MATERIALS_COST_BASIS_ID,
    costBasisLabel: 'Standard cost + latest purchase receipt',
    period: { preset: 'month', fromYmd: '2026-08-01', toYmd: '2026-08-31' },
    summary: {
      skuCount: 2,
      lowStockCount: 1,
      outOfStockCount: 0,
      receiptLineCount: 1,
      issueLineCount: 1,
      correctionCount: 0,
      countDocumentCount: 0,
      purchasesValue: 120,
      consumptionValue: 40,
      returnValue: 0,
      openingValueAtCurrentCost: 200,
      closingValueAtCurrentCost: 280,
      incompleteValuationSkuCount: 1,
      incompleteValuationMovementCount: 2,
    },
    categories: [
      {
        group: 'fabric',
        skuCount: 1,
        lowStockCount: 1,
        openingValue: 100,
        purchasesValue: 120,
        consumptionValue: 40,
        closingValue: 180,
        primaryUnit: 'm',
      },
      {
        group: 'foam',
        skuCount: 0,
        lowStockCount: 0,
        openingValue: 0,
        purchasesValue: 0,
        consumptionValue: 0,
        closingValue: 0,
        primaryUnit: null,
      },
      {
        group: 'wood',
        skuCount: 0,
        lowStockCount: 0,
        openingValue: 0,
        purchasesValue: 0,
        consumptionValue: 0,
        closingValue: 0,
        primaryUnit: null,
      },
      {
        group: 'accessories',
        skuCount: 1,
        lowStockCount: 0,
        openingValue: null,
        purchasesValue: 0,
        consumptionValue: 0,
        closingValue: null,
        primaryUnit: 'pcs',
      },
    ],
    warehouses: [
      {
        warehouseId: 'wh-a',
        code: 'RAW-A',
        name: 'Raw A',
        openingQtyKnown: true,
        primaryUnit: 'm',
        inboundQty: 12,
        outboundQty: 4,
        closingOnHand: 18,
        reserved: 2,
        free: 16,
        openingValue: null,
        inboundValue: 120,
        outboundValue: 40,
        closingValue: null,
      },
    ],
    purchases: [
      {
        date: '2026-08-10T08:00:00.000Z',
        grnNumber: 'GRN-1',
        poNumber: 'PORD-1',
        supplierName: 'Fabric Co',
        sku: 'FAB-1',
        material: locale === 'ar' ? 'مخمل إيطالي FAB-0042' : 'Italian velvet FAB-0042',
        category: 'fabric',
        warehouseCode: 'RAW-A',
        qty: 12,
        unit: 'm',
        unitCost: 10,
        value: 120,
      },
    ],
    suppliers: [{ name: 'Fabric Co', receipts: 1, value: 120, materials: ['Italian velvet'] }],
    consumption: [
      {
        date: '2026-08-12T08:00:00.000Z',
        sku: 'FAB-1',
        material: 'Italian velvet',
        qty: 4,
        unit: 'm',
        salesOrderNumber: 'SO-1',
        productionOrderNumber: 'PO-1',
        stage: 'Upholstery',
        taskNumber: 'T-1',
        worker: '—',
        value: 40,
      },
    ],
    returns: [],
    scrap: [
      {
        date: '2026-08-12T08:00:00.000Z',
        sku: 'FAB-1',
        material: 'Italian velvet',
        qty: 0.2,
        unit: 'm',
        reason: locale === 'ar' ? 'هدر قص' : 'Cutting waste',
        productionOrderNumber: 'PO-1',
        taskNumber: 'T-1',
        recordedBy: 'Lina',
        value: 2,
      },
    ],
    adjustments: [],
    counts: [],
    transfers: [],
    variance: [
      {
        sku: 'FAB-1',
        material: 'Italian velvet',
        unit: 'm',
        planned: 3.5,
        actual: 4,
        difference: 0.5,
        differencePct: 14.3,
      },
    ],
    topConsumed: [
      { sku: 'FAB-1', material: 'Italian velvet', category: 'fabric', qty: 4, unit: 'm', value: 40 },
    ],
    topPurchased: [
      { sku: 'FAB-1', material: 'Italian velvet', supplier: 'Fabric Co', qty: 12, value: 120 },
    ],
    byProductionOrder: [],
    lowStock: [
      {
        sku: 'FAB-1',
        material: 'Italian velvet',
        category: 'fabric',
        onHand: 3,
        reserved: 0,
        free: 3,
        minStock: 5,
        unit: 'm',
      },
    ],
    outOfStock: [],
    demand: [],
    incompleteValuation: [{ sku: 'ACC-1', material: 'Nail strip', reason: 'Cost unavailable' }],
    attention: [
      {
        kind: 'lowStock',
        title: '1 low-stock materials',
        why: 'Current on-hand is at or below the reorder threshold.',
      },
    ],
    items: [
      {
        sku: 'FAB-1',
        material: 'Italian velvet',
        category: 'fabric',
        unit: 'm',
        openingQty: 10,
        received: 12,
        issued: 4,
        returned: 0,
        scrap: 0.2,
        adjustments: 0,
        transfersIn: 0,
        transfersOut: 0,
        closingQty: 18,
        reserved: 2,
        free: 16,
        unitCost: 10,
        closingValue: 180,
        residual: 0,
        stockStatus: 'LOW_STOCK',
      },
    ],
    ledger: {
      shown: 2,
      total: 2,
      rows: [
        {
          date: '2026-08-10T08:00:00.000Z',
          type: 'PURCHASE_RECEIPT',
          typeLabel: 'Purchase receipt',
          reference: 'TX-1',
          sku: 'FAB-1',
          material: 'Italian velvet',
          warehouseCode: 'RAW-A',
          qty: 12,
          unit: 'm',
          value: 120,
          userName: 'Ada',
        },
        {
          date: '2026-08-12T08:00:00.000Z',
          type: 'PRODUCTION_ISSUE',
          typeLabel: 'Issued to production',
          reference: 'TX-2',
          sku: 'FAB-1',
          material: 'Italian velvet',
          warehouseCode: 'RAW-A',
          qty: -4,
          unit: 'm',
          value: 40,
          userName: null,
        },
      ],
    },
  };
}

describe('buildRawMaterialsReportPdf', () => {
  it('builds an English PDF with mixed orientation and continuous page numbers', async () => {
    const buf = await buildRawMaterialsReportPdf(samplePayload('en'), 'white');
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(buf)).toBeGreaterThanOrEqual(3);
    expect(pdfHasLatin(buf, 'Raw Materials')).toBe(true);
    expect(pdfHasLatin(buf, 'Valuation incomplete') || pdfHasLatin(buf, 'incomplete')).toBe(true);
    const boxes = mediaBoxes(buf);
    const portrait = boxes.filter((b) => (b[2] ?? 0) < (b[3] ?? 0));
    const landscape = boxes.filter((b) => (b[2] ?? 0) > (b[3] ?? 0));
    expect(portrait.length).toBeGreaterThan(0);
    expect(landscape.length).toBeGreaterThan(0);
    expect(pdfHasLatin(buf, 'Page 1 of') || pdfHasLatin(buf, 'Page 1 of ')).toBe(true);
  });

  it.each(['ar', 'he'] as const)('paints %s with vector outlines', async (locale) => {
    const buf = await buildRawMaterialsReportPdf(samplePayload(locale), 'white');
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(pdfHasOutlines(buf)).toBe(true);
    expect(pageCount(buf)).toBeGreaterThanOrEqual(3);
  });
});
