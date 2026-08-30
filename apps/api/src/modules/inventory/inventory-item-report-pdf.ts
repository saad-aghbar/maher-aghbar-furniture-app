import type { InventoryItemReportPdfInput } from '../../common/helpers/pdf.util';
import { companyContact, type PdfTheme } from '../../common/helpers/pdf.util';
import { pdfMessages } from '../../common/helpers/pdf-i18n';
import type { InventoryItemReportDto, InventoryItemReportMovementType } from './inventory-item-report';
import type { PdfLocale } from '../../common/helpers/pdf.util';

function fmtQty(n: number, unit: string): string {
  const v = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
  return `${v} ${unit}`.trim();
}

function fmtDate(iso: string | null | undefined, locale: PdfLocale): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB',
      { timeZone: 'Asia/Amman', year: 'numeric', month: 'short', day: 'numeric' },
    ).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDateTime(iso: string, locale: PdfLocale): string {
  try {
    return new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB',
      {
        timeZone: 'Asia/Amman',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

function movementLabel(
  type: InventoryItemReportMovementType,
  m: ReturnType<typeof pdfMessages>,
): string {
  switch (type) {
    case 'RECEIPT':
      return m.received;
    case 'ISSUE':
      return m.issued;
    case 'TRANSFER':
      return m.transferred;
    case 'ADJUSTMENT':
      return m.adjusted;
    case 'COUNT':
      return m.stockCounts;
    case 'RETURN':
      return m.returns;
    default:
      return m.reference;
  }
}

function stockStatusLabel(
  status: InventoryItemReportDto['stock']['status'],
  m: ReturnType<typeof pdfMessages>,
): string {
  switch (status) {
    case 'IN_STOCK':
      return m.statusInStock;
    case 'LOW_STOCK':
      return m.statusLowStock;
    case 'OUT_OF_STOCK':
      return m.statusOutOfStock;
    case 'INACTIVE':
      return m.statusInactive;
    default:
      return status;
  }
}

export function mapInventoryItemReportToPdfSpec(args: {
  report: InventoryItemReportDto;
  image?: Buffer | null;
  theme?: PdfTheme;
}): InventoryItemReportPdfInput {
  const report = args.report;
  const locale = report.locale;
  const m = pdfMessages(locale);
  const contact = companyContact(locale);
  const unit = report.identity.unit;
  const name =
    locale === 'ar'
      ? report.identity.nameAr || report.identity.nameEn
      : locale === 'he'
        ? report.identity.nameHe || report.identity.nameEn
        : report.identity.nameEn || report.identity.nameAr;

  const identityRows: Array<[string, string]> = [
    [m.sku, report.identity.sku],
    [m.qr, report.identity.scanCode],
    [m.unit, unit],
    [m.status, report.identity.isActive ? m.active : m.inactive],
  ];
  if (report.identity.category) identityRows.push([m.category, report.identity.category]);
  if (report.identity.materialType) {
    identityRows.push([m.materialType, report.identity.materialType]);
  }
  if (report.identity.color) identityRows.push([m.color, report.identity.color]);
  if (report.identity.size) identityRows.push([m.size, report.identity.size]);
  if (report.identity.barcode) identityRows.push([m.supplierBarcode, report.identity.barcode]);
  identityRows.push([m.date, fmtDate(report.identity.createdAt, locale)]);

  const sections: InventoryItemReportPdfInput['sections'] = [];

  sections.push({
    title: m.currentStock,
    pairs: [
      [m.onHand, fmtQty(report.stock.onHand, unit)],
      [m.reserved, fmtQty(report.stock.reserved, unit)],
      [m.available, fmtQty(report.stock.available, unit)],
      [m.minStock, fmtQty(report.stock.minStock, unit)],
      ...(report.stock.maxStock != null
        ? ([[m.maxStock, fmtQty(report.stock.maxStock, unit)]] as Array<[string, string]>)
        : []),
      ...(report.permissions.canViewIncoming
        ? ([[m.incomingSupply, fmtQty(report.stock.incoming, unit)]] as Array<[string, string]>)
        : []),
    ],
  });

  if (report.warehouses.length) {
    sections.push({
      title: m.warehouseBalances,
      pairs: report.warehouses.map((w) => [
        `${w.code} · ${w.name}`,
        `${m.onHand} ${fmtQty(w.onHand, unit)} · ${m.reserved} ${fmtQty(w.reserved, unit)} · ${m.available} ${fmtQty(w.available, unit)}`,
      ]),
    });
  }

  sections.push({
    title: m.stockStatus,
    pairs: [[m.status, stockStatusLabel(report.stock.status, m)]],
  });

  if (report.permissions.canViewIncoming && report.incoming?.length) {
    sections.push({
      title: m.incomingSupply,
      columns: [m.purchaseOrder, m.supplier, m.ordered, m.received, m.remaining, m.eta, m.status],
      rows: report.incoming.map((row) => [
        row.purchaseOrderNumber,
        row.supplierName,
        fmtQty(row.orderedQty, row.unit || unit),
        fmtQty(row.receivedQty, row.unit || unit),
        fmtQty(row.remainingQty, row.unit || unit),
        fmtDate(row.expectedDeliveryDate, locale),
        row.status,
      ]),
    });
  }

  const summary = report.movements.summary30d;
  sections.push({
    title: m.movementSummary30d,
    pairs: [
      [m.received, fmtQty(summary.received, unit)],
      [m.issued, fmtQty(summary.issued, unit)],
      [m.transferred, fmtQty(summary.transferred, unit)],
      [m.adjusted, fmtQty(summary.adjusted, unit)],
      [m.netChange, fmtQty(summary.net, unit)],
    ],
  });

  if (report.movements.recent.length) {
    sections.push({
      title: `${m.recentMovements} (${m.showingLatest} ${report.movements.shownCount}/${report.movements.totalCount})`,
      columns: [m.date, m.status, m.qty, m.warehouse, m.ref, m.notes],
      rows: report.movements.recent.map((row) => [
        fmtDate(row.date, locale),
        movementLabel(row.type, m),
        fmtQty(row.quantity, unit),
        row.warehouseCode ?? row.warehouseName ?? '—',
        row.number || row.referenceId || '—',
        row.notes?.trim() || '—',
      ]),
    });
  }

  const adjustments = report.movements.recent.filter((r) => r.type === 'ADJUSTMENT');
  if (adjustments.length) {
    sections.push({
      title: m.adjusted,
      columns: [m.date, m.qty, m.warehouse, m.notes, m.ref],
      rows: adjustments.map((row) => [
        fmtDate(row.date, locale),
        fmtQty(row.quantity, unit),
        row.warehouseCode ?? '—',
        row.notes?.trim() || '—',
        row.number,
      ]),
    });
  }

  if (report.counts?.length) {
    sections.push({
      title: m.stockCounts,
      columns: [m.ref, m.date, m.systemQty, m.countedQty, m.variance, m.warehouse, m.status],
      rows: report.counts.map((c) => [
        c.number,
        fmtDate(c.date, locale),
        fmtQty(c.systemQty, unit),
        c.countedQty != null ? fmtQty(c.countedQty, unit) : '—',
        c.varianceQty != null ? fmtQty(c.varianceQty, unit) : '—',
        c.warehouseCode ?? '—',
        c.status,
      ]),
    });
  }

  if (report.productionUsage?.length) {
    sections.push({
      title: m.productionUsage,
      columns: [
        m.ref,
        m.salesOrder,
        m.expectedQty,
        m.actualQty,
        m.returnedQty,
        m.scrapQty,
        m.variance,
        m.notes,
      ],
      rows: report.productionUsage.map((u) => [
        u.taskNumber,
        u.productionOrderNumber,
        fmtQty(u.expectedQty, unit),
        u.actualQty != null ? fmtQty(u.actualQty, unit) : '—',
        fmtQty(u.returnedQty, unit),
        fmtQty(u.scrapQty, unit),
        u.varianceQty != null ? fmtQty(u.varianceQty, unit) : '—',
        [u.scrapReason, u.reasonNotes].filter(Boolean).join(' · ') || '—',
      ]),
    });
  }

  sections.push({
    title: m.reserved,
    pairs: [[m.reserved, fmtQty(report.stock.reserved, unit)]],
    lines:
      report.stock.reserved > 0
        ? undefined
        : undefined,
  });

  if (report.permissions.canViewDemand && report.demand) {
    const d = report.demand;
    const demandPairs: Array<[string, string]> = [
      [m.status, d.status],
      [m.qty, fmtQty(d.requiredQty, unit)],
      [m.available, fmtQty(d.freeQty, unit)],
      [m.incomingSupply, fmtQty(d.incomingQty, unit)],
    ];
    if (d.nextRequiredBy) demandPairs.push([m.nextRequiredBy, fmtDate(d.nextRequiredBy, locale)]);
    if (d.nextEta) demandPairs.push([m.nextEta, fmtDate(d.nextEta, locale)]);
    sections.push({ title: m.productionDemand, pairs: demandPairs });
    if (d.affected.length) {
      sections.push({
        title: m.productionDemand,
        columns: [m.salesOrder, m.status, m.qty, m.nextRequiredBy],
        rows: d.affected.map((a) => [
          a.productionOrderNumber,
          a.stageCode,
          fmtQty(a.qty, unit),
          fmtDate(a.requiredBy, locale),
        ]),
      });
    }
  }

  if (report.products?.length) {
    const shown = report.products.slice(0, 10);
    const more = report.products.length - shown.length;
    sections.push({
      title: m.usedByProducts,
      columns: [m.description, m.sku, m.status, m.qty],
      rows: shown.map((p) => [
        p.productName,
        p.productSku ?? '—',
        p.stageCode ?? '—',
        p.qtyPerUnit != null ? fmtQty(p.qtyPerUnit, unit) : p.quantityMode ?? '—',
      ]),
      lines: more > 0 ? [`${m.andMore}: ${more}`] : undefined,
    });
  }

  if (report.supplier) {
    sections.push({
      title: m.preferredSupplier,
      pairs: [
        [m.supplier, report.supplier.name],
        ...(report.supplier.code ? ([[m.ref, report.supplier.code]] as Array<[string, string]>) : []),
      ],
    });
  }

  if (report.permissions.canViewCost && report.cost) {
    sections.push({
      title: m.costSummary,
      pairs: [
        [m.standardCost, `${report.cost.standardCost} ILS`],
        [m.stockValue, `${report.cost.stockValue} ILS`],
        [m.reservedValue, `${report.cost.reservedValue} ILS`],
        [m.availableValue, `${report.cost.availableValue} ILS`],
      ],
    });
  }

  return {
    locale,
    theme: args.theme,
    reportTitle: m.inventoryItemReport,
    companyLine: contact.name,
    generatedLabel: m.generated,
    generatedAt: fmtDateTime(report.generatedAt, locale),
    image: args.image,
    itemName: name,
    itemSku: report.identity.sku,
    identityRows,
    description: report.identity.description,
    sections,
    scanTitle: m.scanThisItem,
    scanHint: m.scanThisItemHint,
    scanCode: report.identity.scanCode,
    scanName: name,
    scanSku: report.identity.sku,
  };
}
