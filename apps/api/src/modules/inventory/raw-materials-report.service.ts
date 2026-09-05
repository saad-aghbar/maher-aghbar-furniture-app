import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryTxType, Prisma, WarehouseType } from '@maher/database';
import { DEFAULT_CURRENCY } from '@maher/types';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { localizedName } from '../../common/helpers/pdf-i18n';
import type { PdfLocale } from '../../common/helpers/pdf.util';
import { buildMaterialCostMap } from '../../common/helpers/order-costing.util';
import { DEFAULT_FACTORY_TIMEZONE } from '../scheduling/domain/dealer-request-lead';
import { ymdInTimezone } from '../scheduling/domain/factory-replan';
import { factoryCalendarForTimezone } from '../production/production-day-lens';
import { PurchasingService } from '../purchasing/purchasing.service';
import {
  RAW_LEDGER_ROW_CAP,
  RAW_MATERIALS_COST_BASIS_ID,
  ReportRangeError,
  addToBucket,
  backComputeQuantities,
  bucketForMovement,
  categoryGroupFromInventoryCategory,
  classifyRawStockStatus,
  emptyQtyBuckets,
  humanScrapReason,
  humanTxType,
  moneyOrNull,
  periodNetFromBuckets,
  reconcileItem,
  resolveReportPeriod,
  roundQty,
  valueAtCurrentCost,
  type CategoryGroupKey,
  type ItemQtyBuckets,
  type RawMaterialsReportPayload,
} from './raw-materials-report';

function n(value: unknown): number {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function personName(row: { firstName?: string | null; lastName?: string | null } | null | undefined) {
  if (!row) return null;
  const s = `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
  return s || null;
}

function addMoney(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return Number(((a ?? 0) + (b ?? 0)).toFixed(3));
}

function costBasisLabel(locale: PdfLocale): string {
  if (locale === 'ar') return 'التكلفة المعيارية + آخر سعر شراء';
  if (locale === 'he') return 'עלות תקן + רכישה אחרונה';
  return 'Standard cost + latest purchase receipt';
}

type MoneyAggRow = {
  inventoryItemId: string;
  type: string;
  warehouseId: string;
  referenceType: string | null;
  qty: unknown;
  valued: unknown;
  rows: unknown;
  uncosted: unknown;
};

@Injectable()
export class RawMaterialsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchasing: PurchasingService,
  ) {}

  async build(args: {
    period?: string | null;
    from?: string | null;
    to?: string | null;
    locale: PdfLocale;
    user: AuthUser;
  }): Promise<RawMaterialsReportPayload> {
    const locale = args.locale;
    const tzRow = await this.prisma.factoryCalendar.findFirst({
      where: { isDefault: true },
      select: { timezone: true },
    });
    const timezone = tzRow?.timezone?.trim() || DEFAULT_FACTORY_TIMEZONE;
    const todayYmd = ymdInTimezone(new Date(), timezone);
    let resolved;
    try {
      resolved = resolveReportPeriod({
        preset: args.period,
        from: args.from,
        to: args.to,
        todayYmd,
      });
    } catch (err) {
      if (err instanceof ReportRangeError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
    const cal = factoryCalendarForTimezone(timezone);
    const { start, endExclusive } = cal.localRangeBounds(resolved.fromYmd, resolved.toYmd);

    const warehouses = await this.prisma.warehouse.findMany({
      where: { type: WarehouseType.RAW_MATERIALS, isActive: true },
      select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
    });
    const rawWarehouseIds = warehouses.map((w) => w.id);
    const whById = new Map(warehouses.map((w) => [w.id, w]));

    const items = await this.prisma.inventoryItem.findMany({
      where: { itemClass: 'RAW_MATERIAL', archivedAt: null },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        nameAr: true,
        nameHe: true,
        category: true,
        unit: true,
        minStock: true,
        standardCost: true,
        isActive: true,
      },
    });
    const itemById = new Map(items.map((it) => [it.id, it]));
    const itemIds = items.map((it) => it.id);
    const nameOf = (row: { nameEn: string; nameAr: string; nameHe: string | null }) =>
      localizedName(locale, row);

    const emptyWhIds = rawWarehouseIds.length === 0;
    const emptyItems = itemIds.length === 0;

    const [balances, postPeriod, moneyRows, costItems, costTxs, demand] = await Promise.all([
      emptyWhIds
        ? Promise.resolve([])
        : this.prisma.inventoryBalance.groupBy({
            by: ['inventoryItemId', 'warehouseId'],
            where: { warehouseId: { in: rawWarehouseIds } },
            _sum: { availableQty: true, reservedQty: true },
          }),
      emptyWhIds || emptyItems
        ? Promise.resolve([])
        : this.prisma.inventoryTransaction.groupBy({
            by: ['inventoryItemId'],
            where: {
              createdAt: { gte: endExclusive },
              warehouseId: { in: rawWarehouseIds },
              inventoryItemId: { in: itemIds },
            },
            _sum: { quantity: true },
          }),
      emptyWhIds ? Promise.resolve([] as MoneyAggRow[]) : this.moneyAgg(start, endExclusive, rawWarehouseIds),
      this.prisma.inventoryItem.findMany({
        where: { itemClass: 'RAW_MATERIAL', archivedAt: null },
        select: { sku: true, standardCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: { itemClass: 'RAW_MATERIAL' },
          unitCost: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 800,
        select: { unitCost: true, type: true, inventoryItem: { select: { sku: true } } },
      }),
      this.purchasing.materialDemand().catch(() => [] as Awaited<ReturnType<PurchasingService['materialDemand']>>),
    ]);

    const costs = buildMaterialCostMap({
      standardCosts: costItems,
      transactions: costTxs.map((t) => ({
        sku: t.inventoryItem.sku,
        unitCost: t.unitCost,
        type: t.type,
      })),
    });

    const onHandNow = new Map<string, number>();
    const reservedNow = new Map<string, number>();
    const onHandByWh = new Map<string, number>();
    const reservedByWh = new Map<string, number>();
    const unitsByWh = new Map<string, Set<string>>();
    const purchaseAuditedByCat = new Map<CategoryGroupKey, number | null>();
    const consumptionAuditedByCat = new Map<CategoryGroupKey, number | null>();
    const catOpeningIncomplete = new Set<CategoryGroupKey>();
    const catClosingIncomplete = new Set<CategoryGroupKey>();
    for (const row of balances) {
      const onHand = n(row._sum.availableQty);
      const reserved = n(row._sum.reservedQty);
      onHandNow.set(row.inventoryItemId, (onHandNow.get(row.inventoryItemId) ?? 0) + onHand);
      reservedNow.set(row.inventoryItemId, (reservedNow.get(row.inventoryItemId) ?? 0) + reserved);
      onHandByWh.set(row.warehouseId, (onHandByWh.get(row.warehouseId) ?? 0) + onHand);
      reservedByWh.set(row.warehouseId, (reservedByWh.get(row.warehouseId) ?? 0) + reserved);
      const item = itemById.get(row.inventoryItemId);
      if (item) {
        const units = unitsByWh.get(row.warehouseId) ?? new Set<string>();
        units.add(item.unit);
        unitsByWh.set(row.warehouseId, units);
      }
    }

    const postNet = new Map<string, number>();
    for (const row of postPeriod) {
      postNet.set(row.inventoryItemId, n(row._sum.quantity));
    }

    const bucketsByItem = new Map<string, ItemQtyBuckets>();
    const bucketsByWh = new Map<string, ItemQtyBuckets>();
    const periodNetByItem = new Map<string, number>();
    const valuedByType = new Map<string, number>();
    const uncostedByItem = new Map<string, number>();
    let uncostedMovementCount = 0;
    let receiptLineCount = 0;
    let issueLineCount = 0;
    let returnLineCount = 0;
    let correctionCount = 0;
    const inboundQtyByWh = new Map<string, number>();
    const outboundQtyByWh = new Map<string, number>();
    const inboundValueByWh = new Map<string, number | null>();
    const outboundValueByWh = new Map<string, number | null>();
    const periodNetByWh = new Map<string, number>();
    const postNetByWh = new Map<string, number>();

    for (const row of moneyRows) {
      const qty = n(row.qty);
      const valuedRaw = row.valued == null ? null : n(row.valued);
      const uncosted = n(row.uncosted);
      const rows = n(row.rows);
      const bucket = bucketForMovement({
        type: row.type,
        quantity: qty,
        referenceType: row.referenceType,
      });
      const itemBuckets = bucketsByItem.get(row.inventoryItemId) ?? emptyQtyBuckets();
      addToBucket(itemBuckets, bucket, qty);
      bucketsByItem.set(row.inventoryItemId, itemBuckets);
      const whBuckets = bucketsByWh.get(row.warehouseId) ?? emptyQtyBuckets();
      addToBucket(whBuckets, bucket, qty);
      bucketsByWh.set(row.warehouseId, whBuckets);

      periodNetByItem.set(row.inventoryItemId, (periodNetByItem.get(row.inventoryItemId) ?? 0) + qty);
      periodNetByWh.set(row.warehouseId, (periodNetByWh.get(row.warehouseId) ?? 0) + qty);

      if (uncosted > 0) {
        uncostedByItem.set(row.inventoryItemId, (uncostedByItem.get(row.inventoryItemId) ?? 0) + uncosted);
        uncostedMovementCount += uncosted;
      }
      if (row.type === InventoryTxType.PURCHASE_RECEIPT) receiptLineCount += rows;
      if (row.type === InventoryTxType.PRODUCTION_ISSUE) issueLineCount += rows;
      if (row.type === InventoryTxType.PRODUCTION_RETURN) returnLineCount += rows;
      if (bucket === 'countCorrection' || bucket === 'adjustment') correctionCount += rows;

      if (valuedRaw != null && uncosted < rows) {
        valuedByType.set(bucket, (valuedByType.get(bucket) ?? 0) + valuedRaw);
        const item = itemById.get(row.inventoryItemId);
        if (item) {
          const group = categoryGroupFromInventoryCategory(item.category);
          if (bucket === 'purchaseReceipt') {
            purchaseAuditedByCat.set(group, addMoney(purchaseAuditedByCat.get(group) ?? null, Math.abs(valuedRaw)));
          }
          if (bucket === 'productionIssue') {
            consumptionAuditedByCat.set(group, addMoney(consumptionAuditedByCat.get(group) ?? null, Math.abs(valuedRaw)));
          }
        }
      }

      if (qty >= 0) {
        inboundQtyByWh.set(row.warehouseId, (inboundQtyByWh.get(row.warehouseId) ?? 0) + qty);
        if (valuedRaw != null && uncosted < rows) {
          inboundValueByWh.set(row.warehouseId, addMoney(inboundValueByWh.get(row.warehouseId) ?? null, valuedRaw));
        }
      } else {
        outboundQtyByWh.set(row.warehouseId, (outboundQtyByWh.get(row.warehouseId) ?? 0) + Math.abs(qty));
        if (valuedRaw != null && uncosted < rows) {
          outboundValueByWh.set(row.warehouseId, addMoney(outboundValueByWh.get(row.warehouseId) ?? null, Math.abs(valuedRaw)));
        }
      }
    }

    // Post-period net per warehouse for warehouse opening/closing.
    if (!emptyWhIds && !emptyItems) {
      const postWh = await this.prisma.inventoryTransaction.groupBy({
        by: ['warehouseId'],
        where: {
          createdAt: { gte: endExclusive },
          warehouseId: { in: rawWarehouseIds },
          inventoryItemId: { in: itemIds },
        },
        _sum: { quantity: true },
      });
      for (const row of postWh) postNetByWh.set(row.warehouseId, n(row._sum.quantity));
    }

    const purchasesValue = this.moneyTotal(valuedByType.get('purchaseReceipt'), receiptLineCount);
    const consumptionValue = this.moneyTotal(valuedByType.get('productionIssue'), issueLineCount);
    const returnValue = this.moneyTotal(valuedByType.get('productionReturn'), returnLineCount);

    const itemRows: RawMaterialsReportPayload['items'] = [];
    let openingValueAtCurrentCost: number | null = 0;
    let closingValueAtCurrentCost: number | null = 0;
    let openingValueIncomplete = false;
    let closingValueIncomplete = false;
    const incompleteValuation: RawMaterialsReportPayload['incompleteValuation'] = [];
    const catAcc = new Map<
      CategoryGroupKey,
      {
        skuCount: number;
        lowStockCount: number;
        openingValue: number | null;
        purchasesValue: number | null;
        consumptionValue: number | null;
        closingValue: number | null;
        units: Set<string>;
      }
    >();
    for (const g of ['fabric', 'foam', 'wood', 'accessories'] as const) {
      catAcc.set(g, {
        skuCount: 0,
        lowStockCount: 0,
        openingValue: 0,
        purchasesValue: 0,
        consumptionValue: 0,
        closingValue: 0,
        units: new Set(),
      });
    }

    for (const item of items) {
      const buckets = bucketsByItem.get(item.id) ?? emptyQtyBuckets();
      const periodNet = periodNetByItem.get(item.id) ?? periodNetFromBuckets(buckets);
      const { openingQty, closingQty } = backComputeQuantities({
        currentOnHand: onHandNow.get(item.id) ?? 0,
        postPeriodNet: postNet.get(item.id) ?? 0,
        periodNet,
      });
      const reserved = reservedNow.get(item.id) ?? 0;
      const onHand = onHandNow.get(item.id) ?? 0;
      const free = onHand - reserved;
      const { residual } = reconcileItem({ openingQty, buckets, closingQty });
      const group = categoryGroupFromInventoryCategory(item.category);
      const status = classifyRawStockStatus({
        isActive: item.isActive,
        onHand,
        minStock: n(item.minStock),
      });
      const unitCost = costs.get(item.sku) ?? null;
      const closingValue = valueAtCurrentCost(closingQty, item.sku, costs);
      const openingValue = valueAtCurrentCost(openingQty, item.sku, costs);
      if (closingQty !== 0 && closingValue == null) {
        closingValueIncomplete = true;
        incompleteValuation.push({
          sku: item.sku,
          material: nameOf(item),
          reason: locale === 'ar' ? 'لا توجد تكلفة' : locale === 'he' ? 'אין בסיס עלות' : 'Cost unavailable',
        });
      } else if (closingValue != null) {
        closingValueAtCurrentCost = (closingValueAtCurrentCost ?? 0) + closingValue;
      }
      if (openingQty !== 0 && openingValue == null) openingValueIncomplete = true;
      else if (openingValue != null) openingValueAtCurrentCost = (openingValueAtCurrentCost ?? 0) + openingValue;

      const uncosted = uncostedByItem.get(item.id) ?? 0;
      if (uncosted > 0 && !incompleteValuation.some((r) => r.sku === item.sku)) {
        incompleteValuation.push({
          sku: item.sku,
          material: nameOf(item),
          reason:
            locale === 'ar'
              ? `${uncosted} حركات بلا تكلفة`
              : locale === 'he'
                ? `${uncosted} תנועות ללא עלות`
                : `${uncosted} movements without cost`,
        });
      }

      const cat = catAcc.get(group)!;
      cat.skuCount += 1;
      if (status === 'LOW_STOCK') cat.lowStockCount += 1;
      cat.units.add(item.unit);
      if (openingQty !== 0 && openingValue == null) catOpeningIncomplete.add(group);
      else cat.openingValue = addMoney(cat.openingValue, openingValue);
      if (closingQty !== 0 && closingValue == null) catClosingIncomplete.add(group);
      else cat.closingValue = addMoney(cat.closingValue, closingValue);

      const hadActivity =
        periodNet !== 0 ||
        openingQty !== 0 ||
        closingQty !== 0 ||
        reserved !== 0 ||
        status === 'LOW_STOCK' ||
        status === 'OUT_OF_STOCK';
      if (!hadActivity) continue;

      itemRows.push({
        sku: item.sku,
        material: nameOf(item),
        category: group,
        unit: item.unit,
        openingQty: roundQty(openingQty),
        received: roundQty(buckets.purchaseReceipt),
        issued: roundQty(buckets.productionIssue),
        returned: roundQty(buckets.productionReturn),
        scrap: roundQty(buckets.scrap),
        adjustments: roundQty(buckets.adjustment + buckets.countCorrection),
        transfersIn: roundQty(buckets.transferIn),
        transfersOut: roundQty(buckets.transferOut),
        closingQty: roundQty(closingQty),
        reserved: roundQty(reserved),
        free: roundQty(free),
        unitCost: unitCost != null && unitCost > 0 ? Number(unitCost.toFixed(3)) : null,
        closingValue,
        residual,
        stockStatus: status,
      });
    }

    const lowStockFixed = items
      .filter((it) => {
        const onHand = onHandNow.get(it.id) ?? 0;
        return classifyRawStockStatus({ isActive: it.isActive, onHand, minStock: n(it.minStock) }) === 'LOW_STOCK';
      })
      .map((it) => {
        const onHand = onHandNow.get(it.id) ?? 0;
        const reserved = reservedNow.get(it.id) ?? 0;
        return {
          sku: it.sku,
          material: nameOf(it),
          category: categoryGroupFromInventoryCategory(it.category),
          onHand: roundQty(onHand),
          reserved: roundQty(reserved),
          free: roundQty(onHand - reserved),
          minStock: n(it.minStock),
          unit: it.unit,
        };
      });
    const outOfStock = items
      .filter((it) => {
        const onHand = onHandNow.get(it.id) ?? 0;
        return classifyRawStockStatus({ isActive: it.isActive, onHand, minStock: n(it.minStock) }) === 'OUT_OF_STOCK';
      })
      .map((it) => ({
        sku: it.sku,
        material: nameOf(it),
        category: categoryGroupFromInventoryCategory(it.category),
        reserved: roundQty(reservedNow.get(it.id) ?? 0),
        minStock: n(it.minStock),
        unit: it.unit,
      }));

    const details = emptyWhIds
      ? {
          purchases: [] as RawMaterialsReportPayload['purchases'],
          consumption: [] as RawMaterialsReportPayload['consumption'],
          returns: [] as RawMaterialsReportPayload['returns'],
          scrap: [] as RawMaterialsReportPayload['scrap'],
          adjustments: [] as RawMaterialsReportPayload['adjustments'],
          counts: [] as RawMaterialsReportPayload['counts'],
          transfers: [] as RawMaterialsReportPayload['transfers'],
          variance: [] as RawMaterialsReportPayload['variance'],
          byProductionOrder: [] as RawMaterialsReportPayload['byProductionOrder'],
          ledger: {
            shown: 0,
            total: 0,
            rows: [] as RawMaterialsReportPayload['ledger']['rows'],
          },
          countDocumentCount: 0,
        }
      : await this.loadDetails({
          start,
          endExclusive,
          rawWarehouseIds,
          locale,
          itemById,
          nameOf,
          costs,
          whById,
        });

    const scrapBySku = new Map<string, number>();
    for (const s of details.scrap) {
      scrapBySku.set(s.sku, (scrapBySku.get(s.sku) ?? 0) + s.qty);
    }
    for (const row of itemRows) {
      row.scrap = roundQty(scrapBySku.get(row.sku) ?? 0);
    }

    const suppliersMap = new Map<string, { name: string; receipts: number; value: number | null; materials: Set<string> }>();
    for (const p of details.purchases) {
      const key = p.supplierName ?? '—';
      const cur = suppliersMap.get(key) ?? { name: key, receipts: 0, value: null, materials: new Set<string>() };
      cur.receipts += 1;
      cur.value = addMoney(cur.value, p.value);
      cur.materials.add(p.material);
      suppliersMap.set(key, cur);
    }
    const suppliers = [...suppliersMap.values()]
      .map((s) => ({ name: s.name, receipts: s.receipts, value: s.value, materials: [...s.materials].slice(0, 6) }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const consumedBySku = new Map<string, { qty: number; value: number | null; unit: string; material: string; category: CategoryGroupKey }>();
    for (const c of details.consumption) {
      const item = [...itemById.values()].find((i) => i.sku === c.sku);
      const cur = consumedBySku.get(c.sku) ?? {
        qty: 0,
        value: null,
        unit: c.unit,
        material: c.material,
        category: item ? categoryGroupFromInventoryCategory(item.category) : 'accessories',
      };
      cur.qty += c.qty;
      cur.value = addMoney(cur.value, c.value);
      consumedBySku.set(c.sku, cur);
    }
    const topConsumedFixed = [...consumedBySku.entries()]
      .map(([sku, r]) => ({ sku, material: r.material, category: r.category, qty: roundQty(r.qty), unit: r.unit, value: r.value }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      .slice(0, 10);

    const purchasedBySku = new Map<string, { qty: number; value: number | null; material: string; supplier: string | null }>();
    for (const p of details.purchases) {
      const cur = purchasedBySku.get(p.sku) ?? { qty: 0, value: null, material: p.material, supplier: p.supplierName };
      cur.qty += p.qty;
      cur.value = addMoney(cur.value, p.value);
      if (!cur.supplier) cur.supplier = p.supplierName;
      purchasedBySku.set(p.sku, cur);
    }
    const topPurchased = [...purchasedBySku.entries()]
      .map(([sku, r]) => ({ sku, material: r.material, supplier: r.supplier, qty: roundQty(r.qty), value: r.value }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      .slice(0, 10);

    const demandRows: RawMaterialsReportPayload['demand'] = demand
      .filter((d) => d.status === 'SHORTAGE' || d.status === 'NO_ETA' || d.status === 'AT_RISK')
      .slice(0, 40)
      .map((d) => ({
        sku: d.sku,
        material: localizedName(locale, d),
        requiredQty: n(d.requiredQty),
        freeQty: n(d.freeQty),
        incomingQty: n(d.incomingQty),
        status: d.status,
        orders: d.affected.map((a) => a.productionOrderNumber).slice(0, 8),
      }));

    const attention: RawMaterialsReportPayload['attention'] = [];
    if (lowStockFixed.length) {
      attention.push({
        kind: 'lowStock',
        title:
          locale === 'ar'
            ? `${lowStockFixed.length} أصناف منخفضة`
            : locale === 'he'
              ? `${lowStockFixed.length} פריטים במלאי נמוך`
              : `${lowStockFixed.length} low-stock materials`,
        why:
          locale === 'ar'
            ? 'الرصيد الحالي عند أو تحت حد إعادة الطلب.'
            : locale === 'he'
              ? 'המלאי הנוכחי בסף או מתחתיו.'
              : 'Current on-hand is at or below the reorder threshold.',
      });
    }
    if (outOfStock.length) {
      attention.push({
        kind: 'outOfStock',
        title:
          locale === 'ar'
            ? `${outOfStock.length} أصناف نافدة`
            : locale === 'he'
              ? `${outOfStock.length} פריטים שאזלו`
              : `${outOfStock.length} materials out of stock`,
        why:
          locale === 'ar' ? 'لا يوجد رصيد فعلي.' : locale === 'he' ? 'אין מלאי פיזי.' : 'Physical on-hand is zero.',
      });
    }
    if (incompleteValuation.length) {
      attention.push({
        kind: 'valuation',
        title:
          locale === 'ar'
            ? `${incompleteValuation.length} أصناف بلا تكلفة`
            : locale === 'he'
              ? `${incompleteValuation.length} פריטים ללא עלות`
              : `${incompleteValuation.length} SKUs missing valuation`,
        why:
          locale === 'ar'
            ? 'لا تُحوَّل التكلفة الناقصة إلى صفر.'
            : locale === 'he'
              ? 'עלות חסרה אינה מוצגת כאפס.'
              : 'Missing cost is not treated as zero.',
      });
    }
    const significantCounts = details.counts.filter((c) => c.differences > 0);
    if (significantCounts.length) {
      attention.push({
        kind: 'countVariance',
        title:
          locale === 'ar'
            ? `${significantCounts.length} فروقات جرد`
            : locale === 'he'
              ? `${significantCounts.length} סטיות ספירה`
              : `${significantCounts.length} stock-count variances`,
        why:
          locale === 'ar'
            ? 'الجرد الفعلي لا يطابق رصيد النظام.'
            : locale === 'he'
              ? 'הספירה אינה תואמת את המערכת.'
              : 'Physical count did not match system quantity.',
      });
    }
    const highVar = details.variance.filter((v) => v.differencePct != null && Math.abs(v.differencePct) >= 10);
    if (highVar.length) {
      attention.push({
        kind: 'materialVariance',
        title:
          locale === 'ar'
            ? `${highVar.length} فروقات استهلاك عالية`
            : locale === 'he'
              ? `${highVar.length} סטיות צריכה גבוהות`
              : `${highVar.length} high material variances`,
        why:
          locale === 'ar'
            ? 'الفعلي يختلف عن المخطط بـ 10% أو أكثر.'
            : locale === 'he'
              ? 'הצריכה בפועל חורגת ב־10% או יותר מהתכנון.'
              : 'Actual use differs from planned by 10% or more.',
      });
    }
    if (demandRows.length) {
      attention.push({
        kind: 'waitingMaterial',
        title:
          locale === 'ar'
            ? `${demandRows.length} أوامر تنتظر مادة`
            : locale === 'he'
              ? `${demandRows.length} הזמנות ממתינות לחומר`
              : `${demandRows.length} production orders waiting for material`,
        why:
          locale === 'ar'
            ? 'الطلب الحر غير كافٍ أو بلا موعد توريد.'
            : locale === 'he'
              ? 'אין מלאי פנוי מספיק או אין מועד אספקה.'
              : 'Free stock does not cover required qty, or incoming supply has no ETA.',
      });
    }

    const warehouseSummary: RawMaterialsReportPayload['warehouses'] = warehouses.map((w) => {
      const closingOnHand = onHandByWh.get(w.id) ?? 0;
      const reserved = reservedByWh.get(w.id) ?? 0;
      const post = postNetByWh.get(w.id) ?? 0;
      const periodNet = periodNetByWh.get(w.id) ?? 0;
      const { closingQty } = backComputeQuantities({
        currentOnHand: closingOnHand,
        postPeriodNet: post,
        periodNet,
      });
      const units = unitsByWh.get(w.id);
      return {
        warehouseId: w.id,
        code: w.code,
        name: localizedName(locale, w),
        openingQtyKnown: true,
        primaryUnit: units && units.size === 1 ? [...units][0]! : null,
        inboundQty: roundQty(inboundQtyByWh.get(w.id) ?? 0),
        outboundQty: roundQty(outboundQtyByWh.get(w.id) ?? 0),
        closingOnHand: roundQty(closingQty),
        reserved: roundQty(reserved),
        free: roundQty(closingOnHand - reserved),
        openingValue: null,
        inboundValue: inboundValueByWh.get(w.id) ?? null,
        outboundValue: outboundValueByWh.get(w.id) ?? null,
        closingValue: null,
      };
    });

    const generatedBy =
      personName({ firstName: args.user.firstName, lastName: args.user.lastName }) ||
      args.user.name ||
      args.user.username ||
      '—';

    return {
      generatedAt: new Date().toISOString(),
      generatedBy,
      locale,
      timezone,
      currency: DEFAULT_CURRENCY,
      costBasisId: RAW_MATERIALS_COST_BASIS_ID,
      costBasisLabel: costBasisLabel(locale),
      period: resolved,
      summary: {
        skuCount: items.length,
        lowStockCount: lowStockFixed.length,
        outOfStockCount: outOfStock.length,
        receiptLineCount,
        issueLineCount,
        correctionCount,
        countDocumentCount: details.countDocumentCount,
        purchasesValue,
        consumptionValue,
        returnValue,
        openingValueAtCurrentCost: openingValueIncomplete ? null : Number((openingValueAtCurrentCost ?? 0).toFixed(3)),
        closingValueAtCurrentCost: closingValueIncomplete ? null : Number((closingValueAtCurrentCost ?? 0).toFixed(3)),
        incompleteValuationSkuCount: incompleteValuation.length,
        incompleteValuationMovementCount: uncostedMovementCount,
      },
      categories: (['fabric', 'foam', 'wood', 'accessories'] as const).map((group) => {
        const c = catAcc.get(group)!;
        return {
          group,
          skuCount: c.skuCount,
          lowStockCount: c.lowStockCount,
          openingValue: catOpeningIncomplete.has(group) ? null : c.openingValue,
          purchasesValue: purchaseAuditedByCat.get(group) ?? (c.skuCount ? 0 : null),
          consumptionValue: consumptionAuditedByCat.get(group) ?? (c.skuCount ? 0 : null),
          closingValue: catClosingIncomplete.has(group) ? null : c.closingValue,
          primaryUnit: c.units.size === 1 ? [...c.units][0]! : null,
        };
      }),
      warehouses: warehouseSummary,
      purchases: details.purchases,
      suppliers,
      consumption: details.consumption,
      returns: details.returns,
      scrap: details.scrap,
      adjustments: details.adjustments,
      counts: details.counts,
      transfers: details.transfers,
      variance: details.variance,
      topConsumed: topConsumedFixed,
      topPurchased,
      byProductionOrder: details.byProductionOrder,
      lowStock: lowStockFixed,
      outOfStock,
      demand: demandRows,
      incompleteValuation,
      attention,
      items: itemRows.sort((a, b) => a.sku.localeCompare(b.sku)),
      ledger: details.ledger,
    };
  }

  private moneyTotal(v: number | undefined, rowCount: number | null): number | null {
    if (rowCount === 0) return 0;
    if (v == null) return null;
    return Number(Math.abs(v).toFixed(3));
  }

  private async moneyAgg(start: Date, endExclusive: Date, warehouseIds: string[]): Promise<MoneyAggRow[]> {
    return this.prisma.$queryRaw<MoneyAggRow[]>(Prisma.sql`
      SELECT it."inventoryItemId", it."type", it."warehouseId", it."referenceType",
             SUM(it."quantity") AS qty,
             SUM(CASE WHEN it."unitCost" IS NULL THEN NULL
                      ELSE it."quantity" * it."unitCost" END) AS valued,
             COUNT(*)::int AS rows,
             COUNT(*) FILTER (WHERE it."unitCost" IS NULL)::int AS uncosted
      FROM inventory_transactions it
      JOIN inventory_items ii ON ii.id = it."inventoryItemId"
      WHERE it."createdAt" >= ${start}
        AND it."createdAt" < ${endExclusive}
        AND ii."itemClass" = 'RAW_MATERIAL'
        AND it."warehouseId" IN (${Prisma.join(warehouseIds)})
      GROUP BY 1, 2, 3, 4,
               CASE WHEN it."quantity" < 0 THEN -1 ELSE 1 END
    `);
  }

  private async loadDetails(args: {
    start: Date;
    endExclusive: Date;
    rawWarehouseIds: string[];
    locale: PdfLocale;
    itemById: Map<string, { id: string; sku: string; nameEn: string; nameAr: string; nameHe: string | null; category: string; unit: string }>;
    nameOf: (item: { nameEn: string; nameAr: string; nameHe: string | null }) => string;
    costs: Map<string, number>;
    whById: Map<string, { id: string; code: string; nameEn: string; nameAr: string; nameHe: string | null }>;
  }) {
    const { start, endExclusive, rawWarehouseIds, locale, itemById, nameOf, costs, whById } = args;
    const txWhere: Prisma.InventoryTransactionWhereInput = {
      createdAt: { gte: start, lt: endExclusive },
      warehouseId: { in: rawWarehouseIds },
      inventoryItem: { itemClass: 'RAW_MATERIAL' },
    };

    const [periodTxs, ledgerTotal] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: txWhere,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          number: true,
          type: true,
          quantity: true,
          unitCost: true,
          createdAt: true,
          createdById: true,
          referenceType: true,
          referenceId: true,
          notes: true,
          inventoryItemId: true,
          warehouseId: true,
        },
      }),
      this.prisma.inventoryTransaction.count({ where: txWhere }),
    ]);

    const userIds = [...new Set(periodTxs.map((t) => t.createdById).filter((id): id is string => Boolean(id)))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, personName(u)]));

    const grnIds = [
      ...new Set(
        periodTxs
          .filter((t) => t.type === InventoryTxType.PURCHASE_RECEIPT && t.referenceType === 'GoodsReceipt' && t.referenceId)
          .map((t) => t.referenceId!),
      ),
    ];
    const grns = grnIds.length
      ? await this.prisma.goodsReceipt.findMany({
          where: { id: { in: grnIds } },
          select: {
            id: true,
            number: true,
            purchaseOrder: {
              select: {
                number: true,
                supplier: { select: { name: true, nameEn: true, nameAr: true, nameHe: true } },
              },
            },
          },
        })
      : [];
    const grnById = new Map(grns.map((g) => [g.id, g]));

    const taskIds = [
      ...new Set(
        periodTxs
          .filter((t) => t.referenceType === 'ProductionTask' && t.referenceId)
          .map((t) => t.referenceId!),
      ),
    ];
    const poIds = [
      ...new Set(
        periodTxs
          .filter((t) => t.referenceType === 'ProductionOrder' && t.referenceId)
          .map((t) => t.referenceId!),
      ),
    ];
    const [tasks, pos] = await Promise.all([
      taskIds.length
        ? this.prisma.productionTask.findMany({
            where: { id: { in: taskIds } },
            select: {
              id: true,
              number: true,
              name: true,
              assignedEmployee: { select: { firstName: true, lastName: true } },
              stageDefinition: { select: { nameEn: true, nameAr: true, nameHe: true, code: true } },
              productionOrder: {
                select: {
                  id: true,
                  number: true,
                  productDescription: true,
                  product: { select: { nameEn: true, nameAr: true, nameHe: true } },
                  salesOrder: { select: { number: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      poIds.length
        ? this.prisma.productionOrder.findMany({
            where: { id: { in: poIds } },
            select: {
              id: true,
              number: true,
              productDescription: true,
              product: { select: { nameEn: true, nameAr: true, nameHe: true } },
              salesOrder: { select: { number: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const poById = new Map(pos.map((p) => [p.id, p]));

    const usages = await this.prisma.productionTaskMaterialUsage.findMany({
      where: {
        inventoryItem: { itemClass: 'RAW_MATERIAL' },
        finalizedAt: { gte: start, lt: endExclusive },
      },
      select: {
        taskId: true,
        inventoryItemId: true,
        sku: true,
        expectedQty: true,
        actualQty: true,
        scrapQty: true,
        scrapReason: true,
        reasonNotes: true,
        returnedQty: true,
        unitCost: true,
        extendedCost: true,
        finalizedAt: true,
        productionOrder: { select: { number: true } },
        task: { select: { number: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
        inventoryItem: { select: { nameEn: true, nameAr: true, nameHe: true, unit: true, category: true } },
      },
    });

    const transferIds = [
      ...new Set(
        periodTxs
          .filter((t) => t.type === InventoryTxType.WAREHOUSE_TRANSFER && t.referenceType === 'WarehouseTransfer' && t.referenceId)
          .map((t) => t.referenceId!),
      ),
    ];
    const transfersDocs = transferIds.length
      ? await this.prisma.warehouseTransfer.findMany({
          where: { id: { in: transferIds } },
          select: {
            id: true,
            number: true,
            fromWarehouse: { select: { code: true } },
            toWarehouse: { select: { code: true } },
          },
        })
      : [];
    const transferById = new Map(transfersDocs.map((t) => [t.id, t]));

    const countIds = [
      ...new Set(
        periodTxs
          .filter((t) => t.referenceType === 'InventoryCount' && t.referenceId)
          .map((t) => t.referenceId!),
      ),
    ];
    const counts = countIds.length
      ? await this.prisma.inventoryCount.findMany({
          where: { id: { in: countIds } },
          include: {
            lines: {
              include: { inventoryItem: { select: { sku: true, nameEn: true, nameAr: true, nameHe: true, unit: true } } },
            },
          },
        })
      : [];

    const extraCountUserIds = [
      ...new Set(
        counts
          .map((c) => c.createdById)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ].filter((id) => !userById.has(id));
    if (extraCountUserIds.length) {
      const extraUsers = await this.prisma.user.findMany({
        where: { id: { in: extraCountUserIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const u of extraUsers) userById.set(u.id, personName(u));
    }

    const purchases: RawMaterialsReportPayload['purchases'] = [];
    const consumption: RawMaterialsReportPayload['consumption'] = [];
    const returns: RawMaterialsReportPayload['returns'] = [];
    const adjustments: RawMaterialsReportPayload['adjustments'] = [];
    const transferPairs = new Map<string, { date: string; transferNumber: string | null; sku: string; material: string; qty: number; fromWarehouse: string; toWarehouse: string }>();

    for (const tx of periodTxs) {
      const item = itemById.get(tx.inventoryItemId);
      if (!item) continue;
      const qty = n(tx.quantity);
      const unitCost = tx.unitCost != null ? n(tx.unitCost) : null;
      const value = moneyOrNull(unitCost, qty);
      const wh = whById.get(tx.warehouseId);

      if (tx.type === InventoryTxType.PURCHASE_RECEIPT) {
        const grn = tx.referenceId ? grnById.get(tx.referenceId) : null;
        purchases.push({
          date: tx.createdAt.toISOString(),
          grnNumber: grn?.number ?? null,
          poNumber: grn?.purchaseOrder.number ?? null,
          supplierName: grn?.purchaseOrder.supplier
            ? localizedName(locale, grn.purchaseOrder.supplier)
            : null,
          sku: item.sku,
          material: nameOf(item),
          category: categoryGroupFromInventoryCategory(item.category),
          warehouseCode: wh?.code ?? '—',
          qty: roundQty(Math.abs(qty)),
          unit: item.unit,
          unitCost: unitCost != null && unitCost > 0 ? unitCost : null,
          value,
        });
      }

      if (tx.type === InventoryTxType.PRODUCTION_ISSUE) {
        const task = tx.referenceType === 'ProductionTask' && tx.referenceId ? taskById.get(tx.referenceId) : null;
        const po =
          task?.productionOrder ??
          (tx.referenceType === 'ProductionOrder' && tx.referenceId ? poById.get(tx.referenceId) : null);
        const usage = task
          ? usages.find((u) => u.taskId === task.id && u.inventoryItemId === item.id)
          : null;
        consumption.push({
          date: tx.createdAt.toISOString(),
          sku: item.sku,
          material: nameOf(item),
          qty: roundQty(Math.abs(qty)),
          unit: item.unit,
          salesOrderNumber: po?.salesOrder?.number ?? null,
          productionOrderNumber: po?.number ?? null,
          stage: task?.stageDefinition ? localizedName(locale, task.stageDefinition) : task?.name ?? null,
          taskNumber: task?.number ?? null,
          worker: personName(usage?.recordedBy) ?? null,
          value,
        });
      }

      if (tx.type === InventoryTxType.PRODUCTION_RETURN) {
        const task = tx.referenceType === 'ProductionTask' && tx.referenceId ? taskById.get(tx.referenceId) : null;
        const po =
          task?.productionOrder ??
          (tx.referenceType === 'ProductionOrder' && tx.referenceId ? poById.get(tx.referenceId) : null);
        returns.push({
          date: tx.createdAt.toISOString(),
          sku: item.sku,
          material: nameOf(item),
          qty: roundQty(Math.abs(qty)),
          unit: item.unit,
          productionOrderNumber: po?.number ?? null,
          taskNumber: task?.number ?? null,
          warehouseCode: wh?.code ?? '—',
          value,
        });
      }

      if (tx.type === InventoryTxType.INVENTORY_ADJUSTMENT) {
        adjustments.push({
          date: tx.createdAt.toISOString(),
          sku: item.sku,
          material: nameOf(item),
          qty: roundQty(qty),
          unit: item.unit,
          kind: tx.referenceType === 'InventoryCount' ? 'countCorrection' : 'adjustment',
          notes: tx.notes,
          warehouseCode: wh?.code ?? '—',
          userName: tx.createdById ? userById.get(tx.createdById) ?? null : null,
        });
      }

      if (tx.type === InventoryTxType.WAREHOUSE_TRANSFER && tx.referenceId) {
        const doc = transferById.get(tx.referenceId);
        const key = `${tx.referenceId}:${item.id}`;
        const existing = transferPairs.get(key);
        if (!existing) {
          transferPairs.set(key, {
            date: tx.createdAt.toISOString(),
            transferNumber: doc?.number ?? null,
            sku: item.sku,
            material: nameOf(item),
            qty: roundQty(Math.abs(qty)),
            fromWarehouse: doc?.fromWarehouse.code ?? (qty < 0 ? wh?.code ?? '—' : '—'),
            toWarehouse: doc?.toWarehouse.code ?? (qty > 0 ? wh?.code ?? '—' : '—'),
          });
        }
      }
    }

    const scrap: RawMaterialsReportPayload['scrap'] = usages
      .filter((u) => n(u.scrapQty) > 0)
      .map((u) => ({
        date: u.finalizedAt?.toISOString() ?? null,
        sku: u.sku,
        material: localizedName(locale, u.inventoryItem),
        qty: roundQty(n(u.scrapQty)),
        unit: u.inventoryItem.unit,
        reason: humanScrapReason(u.scrapReason, locale) ?? u.reasonNotes,
        productionOrderNumber: u.productionOrder.number,
        taskNumber: u.task.number,
        recordedBy: personName(u.recordedBy),
        value: moneyOrNull(u.unitCost != null ? n(u.unitCost) : costs.get(u.sku) ?? null, n(u.scrapQty)),
      }));

    const variance: RawMaterialsReportPayload['variance'] = usages
      .filter((u) => u.actualQty != null && n(u.expectedQty) > 0)
      .map((u) => {
        const planned = n(u.expectedQty);
        const actual = n(u.actualQty);
        const difference = roundQty(actual - planned);
        return {
          sku: u.sku,
          material: localizedName(locale, u.inventoryItem),
          unit: u.inventoryItem.unit,
          planned: roundQty(planned),
          actual: roundQty(actual),
          difference,
          differencePct: planned !== 0 ? Number(((difference / planned) * 100).toFixed(1)) : null,
        };
      })
      .filter((v) => v.difference !== 0);

    const byPo = new Map<
      string,
      {
        productionOrderNumber: string;
        salesOrderNumber: string | null;
        productName: string | null;
        lines: Map<string, { category: CategoryGroupKey; qty: number; unit: string; value: number | null }>;
      }
    >();
    for (const c of consumption) {
      if (!c.productionOrderNumber) continue;
      const item = [...itemById.values()].find((i) => i.sku === c.sku);
      const group = item ? categoryGroupFromInventoryCategory(item.category) : 'accessories';
      const cur = byPo.get(c.productionOrderNumber) ?? {
        productionOrderNumber: c.productionOrderNumber,
        salesOrderNumber: c.salesOrderNumber,
        productName: null,
        lines: new Map(),
      };
      const task = tasks.find((t) => t.number === c.taskNumber);
      if (task?.productionOrder) {
        cur.productName = task.productionOrder.product
          ? localizedName(locale, task.productionOrder.product)
          : task.productionOrder.productDescription;
        cur.salesOrderNumber = task.productionOrder.salesOrder?.number ?? cur.salesOrderNumber;
      }
      const lineKey = `${group}:${c.unit}`;
      const line = cur.lines.get(lineKey) ?? { category: group, qty: 0, unit: c.unit, value: null };
      line.qty += c.qty;
      line.value = addMoney(line.value, c.value);
      cur.lines.set(lineKey, line);
      byPo.set(c.productionOrderNumber, cur);
    }
    const byProductionOrder: RawMaterialsReportPayload['byProductionOrder'] = [...byPo.values()].map((row) => {
      const lines = [...row.lines.values()].map((l) => ({ ...l, qty: roundQty(l.qty) }));
      const totalValue = lines.reduce<number | null>((s, l) => addMoney(s, l.value), null);
      return {
        productionOrderNumber: row.productionOrderNumber,
        salesOrderNumber: row.salesOrderNumber,
        productName: row.productName,
        lines,
        totalValue,
      };
    });

    const countPayload: RawMaterialsReportPayload['counts'] = counts.map((c) => {
      const wh = whById.get(c.warehouseId);
      const diffs = c.lines.filter((l) => n(l.varianceQty) !== 0);
      const matched = c.lines.length - diffs.length;
      let pos = 0;
      let neg = 0;
      let netValue: number | null = 0;
      let valueIncomplete = false;
      const lines = diffs.map((l) => {
        const vq = n(l.varianceQty);
        if (vq > 0) pos += vq;
        if (vq < 0) neg += vq;
        const unit = costs.get(l.inventoryItem.sku);
        const valueDiff = unit != null && unit > 0 ? Number((vq * unit).toFixed(3)) : null;
        if (valueDiff == null) valueIncomplete = true;
        else netValue = (netValue ?? 0) + valueDiff;
        return {
          sku: l.inventoryItem.sku,
          material: localizedName(locale, l.inventoryItem),
          systemQty: n(l.systemQty),
          countedQty: l.countedQty != null ? n(l.countedQty) : null,
          varianceQty: l.varianceQty != null ? n(l.varianceQty) : null,
          valueDiff,
        };
      });
      return {
        number: c.number,
        date: (c.countedAt ?? c.createdAt).toISOString(),
        warehouseCode: wh?.code ?? '—',
        warehouseName: wh ? localizedName(locale, wh) : '—',
        itemsCounted: c.lines.length,
        matched,
        differences: diffs.length,
        positiveVarianceQty: roundQty(pos),
        negativeVarianceQty: roundQty(neg),
        netValueVariance: valueIncomplete ? null : Number((netValue ?? 0).toFixed(3)),
        completedBy: c.createdById ? userById.get(c.createdById) ?? null : null,
        lines,
      };
    });

    const ledgerRows: RawMaterialsReportPayload['ledger']['rows'] = periodTxs.slice(0, RAW_LEDGER_ROW_CAP).map((tx) => {
      const item = itemById.get(tx.inventoryItemId);
      const wh = whById.get(tx.warehouseId);
      const qty = n(tx.quantity);
      const unitCost = tx.unitCost != null ? n(tx.unitCost) : null;
      return {
        date: tx.createdAt.toISOString(),
        type: tx.type,
        typeLabel: humanTxType(tx.type, locale),
        reference: tx.number,
        sku: item?.sku ?? '—',
        material: item ? nameOf(item) : '—',
        warehouseCode: wh?.code ?? '—',
        qty: roundQty(qty),
        unit: item?.unit ?? '',
        value: moneyOrNull(unitCost, qty),
        userName: tx.createdById ? userById.get(tx.createdById) ?? null : null,
      };
    });

    return {
      purchases,
      consumption,
      returns,
      scrap,
      adjustments,
      counts: countPayload,
      transfers: [...transferPairs.values()],
      variance,
      byProductionOrder,
      ledger: { shown: ledgerRows.length, total: ledgerTotal, rows: ledgerRows },
      countDocumentCount: counts.length,
    };
  }
}
