import { companyContact, createReportDoc, type PdfTheme } from '../../common/helpers/pdf.util';
import { pdfMessages } from '../../common/helpers/pdf-i18n';
import type { CategoryGroupKey, RawMaterialsReportPayload } from './raw-materials-report';

function fmtMoney(value: number | null | undefined, currency: string): string {
  if (value == null) return '—';
  return `${Number(value).toFixed(2)} ${currency}`;
}

function fmtQty(value: number, unit?: string | null): string {
  const n = Number(value);
  const v = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
  return unit ? `${v} ${unit}` : v;
}

function fmtDate(iso: string | null | undefined, timezone: string, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDateTime(iso: string, timezone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function categoryLabel(group: CategoryGroupKey, rm: ReturnType<typeof pdfMessages>['rawMaterials']): string {
  if (group === 'fabric') return rm.fabric;
  if (group === 'foam') return rm.foam;
  if (group === 'wood') return rm.wood;
  return rm.accessories;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

function dashQty(unit: string | null, qty: number): string {
  return unit ? fmtQty(qty, unit) : '—';
}

export async function buildRawMaterialsReportPdf(
  payload: RawMaterialsReportPayload,
  theme?: PdfTheme,
): Promise<Buffer> {
  const locale = payload.locale;
  const m = pdfMessages(locale);
  const rm = m.rawMaterials;
  const currency = payload.currency;
  const tz = payload.timezone;
  const contact = companyContact(locale);
  const report = createReportDoc({ locale, theme, initialLayout: 'portrait' });

  const periodLabel = `${payload.period.fromYmd} → ${payload.period.toYmd}`;
  const s = payload.summary;

  report.drawHeading(rm.title, 16);
  report.drawLine(contact.name, { bold: true, size: 10 });
  report.drawPairs([
    [rm.period, periodLabel],
    [rm.generatedAt, fmtDateTime(payload.generatedAt, tz, locale)],
    [rm.generatedBy, payload.generatedBy],
    [rm.timezone, tz],
    [m.currency, currency],
    [rm.costBasis, payload.costBasisLabel],
  ]);

  report.drawHeading(rm.executiveSummary);
  report.drawPairs([
    [rm.skuCount, String(s.skuCount)],
    [rm.lowStockCount, String(s.lowStockCount)],
    [rm.outOfStockCount, String(s.outOfStockCount)],
    [rm.receiptLines, String(s.receiptLineCount)],
    [rm.issueLines, String(s.issueLineCount)],
    [rm.corrections, String(s.correctionCount)],
    [rm.countDocuments, String(s.countDocumentCount)],
    [rm.purchasesValue, fmtMoney(s.purchasesValue, currency)],
    [rm.consumptionValue, fmtMoney(s.consumptionValue, currency)],
    [rm.returnValue, fmtMoney(s.returnValue, currency)],
    [rm.auditedMovement, fmtMoney(s.purchasesValue, currency)],
    [rm.stockValueCurrentCost, fmtMoney(s.closingValueAtCurrentCost, currency)],
    [rm.openingValue, fmtMoney(s.openingValueAtCurrentCost, currency)],
    [rm.closingValue, fmtMoney(s.closingValueAtCurrentCost, currency)],
    [
      rm.valuationIncomplete,
      `${s.incompleteValuationSkuCount} SKUs · ${s.incompleteValuationMovementCount}`,
    ],
  ]);
  report.drawLine(rm.currentNote, { muted: true, size: 8 });

  report.drawHeading(rm.categorySummary);
  report.drawTable(
    [m.category, rm.skuCount, rm.lowStockCount, rm.openingValue, rm.purchasesValue, rm.consumptionValue, rm.closingValue],
    payload.categories.map((c) => [
      categoryLabel(c.group, rm),
      String(c.skuCount),
      String(c.lowStockCount),
      fmtMoney(c.openingValue, currency),
      fmtMoney(c.purchasesValue, currency),
      fmtMoney(c.consumptionValue, currency),
      fmtMoney(c.closingValue, currency),
    ]),
  );

  report.drawHeading(rm.warehouseSummary);
  if (!payload.warehouses.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.warehouse, rm.inbound, rm.outbound, m.onHand, rm.reservedCurrent, rm.freeCurrent],
      payload.warehouses.map((w) => {
        const unit = w.primaryUnit;
        return [
          `${w.code} · ${w.name}${unit ? '' : ` · ${rm.mixedUnits}`}`,
          dashQty(unit, w.inboundQty),
          dashQty(unit, w.outboundQty),
          dashQty(unit, w.closingOnHand),
          dashQty(unit, w.reserved),
          dashQty(unit, w.free),
        ];
      }),
    );
  }

  report.drawHeading(rm.purchases);
  if (!payload.purchases.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, rm.grnPo, m.supplier, rm.material, m.qty, rm.value],
      payload.purchases.slice(0, 80).map((p) => [
        fmtDate(p.date, tz, locale),
        [p.grnNumber, p.poNumber].filter(Boolean).join(' · ') || '—',
        p.supplierName ?? '—',
        `${p.sku} · ${p.material}`,
        fmtQty(p.qty, p.unit),
        fmtMoney(p.value, currency),
      ]),
    );
  }
  if (payload.suppliers.length) {
    report.drawHeading(rm.topSuppliers);
    report.drawTable(
      [m.supplier, rm.receipts, rm.value, rm.supplierCount],
      payload.suppliers.slice(0, 10).map((srow) => [
        srow.name,
        String(srow.receipts),
        fmtMoney(srow.value, currency),
        srow.materials.slice(0, 4).join(', '),
      ]),
    );
  }

  report.drawHeading(rm.productionConsumption);
  if (!payload.consumption.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, rm.material, m.qty, m.salesOrder, rm.stage, rm.worker, rm.value],
      payload.consumption.slice(0, 80).map((c) => [
        fmtDate(c.date, tz, locale),
        `${c.sku} · ${c.material}`,
        fmtQty(c.qty, c.unit),
        c.salesOrderNumber ?? c.productionOrderNumber ?? '—',
        c.stage ?? '—',
        c.worker ?? '—',
        fmtMoney(c.value, currency),
      ]),
    );
  }
  if (payload.topConsumed.length) {
    report.drawHeading(rm.topMaterials);
    report.drawTable(
      [m.sku, rm.material, m.qty, rm.value],
      payload.topConsumed.map((t) => [
        t.sku,
        t.material,
        fmtQty(t.qty, t.unit),
        fmtMoney(t.value, currency),
      ]),
    );
  }
  if (payload.variance.length) {
    report.drawHeading(rm.plannedVsActual);
    report.drawTable(
      [m.sku, rm.material, rm.planned, rm.actual, rm.difference],
      payload.variance.slice(0, 40).map((v) => [
        v.sku,
        v.material,
        fmtQty(v.planned, v.unit),
        fmtQty(v.actual, v.unit),
        `${fmtQty(v.difference, v.unit)}${v.differencePct != null ? ` (${v.differencePct}%)` : ''}`,
      ]),
    );
  }

  report.drawHeading(m.returns);
  if (!payload.returns.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, rm.material, m.qty, rm.task, rm.value],
      payload.returns.slice(0, 40).map((r) => [
        fmtDate(r.date, tz, locale),
        `${r.sku} · ${r.material}`,
        fmtQty(r.qty, r.unit),
        r.taskNumber ?? r.productionOrderNumber ?? '—',
        fmtMoney(r.value, currency),
      ]),
    );
  }

  report.drawHeading(rm.scrapBreakdown);
  report.drawLine(rm.scrapIncluded, { muted: true, size: 8 });
  if (!payload.scrap.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, rm.material, m.qty, rm.reason, rm.worker],
      payload.scrap.slice(0, 40).map((sc) => [
        fmtDate(sc.date, tz, locale),
        `${sc.sku} · ${sc.material}`,
        fmtQty(sc.qty, sc.unit),
        sc.reason ?? '—',
        sc.recordedBy ?? '—',
      ]),
    );
  }

  report.drawHeading(rm.adjustments);
  if (!payload.adjustments.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, rm.material, m.qty, rm.type, m.warehouse],
      payload.adjustments.slice(0, 40).map((a) => [
        fmtDate(a.date, tz, locale),
        `${a.sku} · ${a.material}`,
        fmtQty(a.qty, a.unit),
        a.kind === 'countCorrection' ? rm.countCorrection : rm.otherAdjustment,
        a.warehouseCode,
      ]),
    );
  }

  report.drawHeading(m.stockCounts);
  if (!payload.counts.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, m.warehouse, rm.skuCount, rm.difference, rm.value],
      payload.counts.map((c) => [
        fmtDate(c.date, tz, locale),
        `${c.warehouseCode} · ${c.warehouseName}`,
        String(c.itemsCounted),
        String(c.differences),
        fmtMoney(c.netValueVariance, currency),
      ]),
    );
    const significant = payload.counts.flatMap((c) =>
      c.lines
        .filter((l) => (l.varianceQty ?? 0) !== 0)
        .map((l) => ({ ...l, count: c.number })),
    );
    if (significant.length) {
      report.drawHeading(rm.significantVariances);
      report.drawTable(
        [m.sku, rm.material, m.systemQty, m.countedQty, m.variance],
        significant.slice(0, 40).map((l) => [
          l.sku,
          l.material,
          String(l.systemQty),
          l.countedQty == null ? '—' : String(l.countedQty),
          l.varianceQty == null ? '—' : String(l.varianceQty),
        ]),
      );
    }
  }

  report.drawHeading(rm.managementAttention);
  if (!payload.attention.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    for (const a of payload.attention) {
      report.drawLine(a.title, { bold: true });
      report.drawLine(a.why, { muted: true, size: 8 });
    }
  }
  if (payload.lowStock.length) {
    report.drawTable(
      [m.sku, rm.material, m.onHand, m.minStock],
      payload.lowStock.slice(0, 20).map((r) => [
        r.sku,
        r.material,
        fmtQty(r.onHand, r.unit),
        fmtQty(r.minStock, r.unit),
      ]),
    );
  }
  if (payload.incompleteValuation.length) {
    report.drawHeading(rm.incompleteList);
    report.drawTable(
      [m.sku, rm.material, rm.reason],
      payload.incompleteValuation.map((r) => [r.sku, r.material, r.reason]),
    );
  }
  if (payload.demand.length) {
    report.drawHeading(rm.demand);
    report.drawTable(
      [m.sku, rm.material, rm.required, rm.freeCurrent, rm.incoming],
      payload.demand.slice(0, 20).map((d) => [
        d.sku,
        d.material,
        String(d.requiredQty),
        String(d.freeQty),
        String(d.incomingQty),
      ]),
    );
  }

  report.addPage('landscape');
  report.drawHeading(rm.perSkuAppendix);
  report.drawLine(rm.quantityIdentity, { muted: true, size: 8 });
  const residualBad = payload.items.filter((i) => i.residual !== 0);
  report.drawLine(
    residualBad.length ? rm.residualMismatch : rm.residualOk,
    { bold: true, size: 9 },
  );
  if (payload.items.length) {
    report.drawTable(
      [m.sku, rm.material, m.unit, rm.opening, m.received, m.issued, m.closing, rm.residual, rm.value],
      payload.items.map((i) => [
        i.sku,
        i.material,
        i.unit,
        fmtQty(i.openingQty),
        fmtQty(i.received),
        fmtQty(i.issued),
        fmtQty(i.closingQty),
        fmtQty(i.residual),
        fmtMoney(i.closingValue, currency),
      ]),
    );
  } else {
    report.drawLine(rm.none, { muted: true });
  }

  report.addPage('landscape');
  report.drawHeading(rm.movementLedger);
  report.drawLine(
    fill(rm.showingOf, { shown: payload.ledger.shown, total: payload.ledger.total }),
    { muted: true, size: 8 },
  );
  if (!payload.ledger.rows.length) {
    report.drawLine(rm.none, { muted: true });
  } else {
    report.drawTable(
      [m.date, rm.type, m.reference, m.sku, rm.material, m.warehouse, m.qty, rm.value, rm.user],
      payload.ledger.rows.map((r) => [
        fmtDateTime(r.date, tz, locale),
        r.typeLabel,
        r.reference ?? '—',
        r.sku,
        r.material,
        r.warehouseCode,
        fmtQty(r.qty, r.unit),
        fmtMoney(r.value, currency),
        r.userName ?? '—',
      ]),
    );
  }

  report.paintPageNumbers((page, total) => fill(rm.page, { page, total }));
  return report.finish();
}
