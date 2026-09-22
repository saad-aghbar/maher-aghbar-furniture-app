"use client";

import { Link } from "@/i18n/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { ReactNode } from "react";
import {
  Board,
  type BoardTone,
  Button,
  DocumentActions,
  EmptyState,
  Figure,
  Ltr,
  MotionSection,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableNumericCell,
  TableRow,
} from "@maher/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { usePdfDownload } from "@/hooks/use-pdf-download";
import { localizedName } from "@maher/i18n";
import { MoneyDeskBoard } from "@/components/cost-performance/money-desk-board";
import { useReportsFilterQs } from "@/components/cost-performance/reports-chrome";

interface DashboardReport {
  newOrders?: number;
  ordersInProduction?: number;
  ordersNearingDelivery?: number;
  delayedOrders?: number;
  openInvoices?: number;
  outstandingReceivables?: number;
  lowStockItems?: number;
  activeOrders?: number;
  ordersDueSoon?: number;
  delayedProduction?: number;
  outstandingInvoices?: number;
  lowStock?: number;
  revenueInvoiced?: number;
  receivablesAmount?: number;
  openPurchases?: number;
  generatedAt?: string;
}

interface SalesReport {
  ordersByStatus: Array<{ status: string; count: number; total: number }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
    total: number;
  }>;
  topProducts?: Array<{
    productId: string | null;
    sku: string | null;
    name: string | null;
    lineCount: number;
    quantity: number;
    total: number;
  }>;
  bySalesRep?: Array<{
    salesRepId: string | null;
    name: string | null;
    quotationCount: number;
  }>;
  recentQuotes: Array<{
    id: string;
    number: string;
    status: string;
    total: string | number;
    customer: string;
    salesRep?: string | null;
    createdAt?: string;
  }>;
}

interface ProductionWorkOrder {
  id: string;
  number: string;
  status: string;
  currentStageCode?: string | null;
  progressPercent?: number | null;
  requiredDeliveryDate?: string | null;
  daysLate?: number;
  salesOrderId?: string | null;
  salesOrder?: { id?: string; number: string } | null;
  customerName?: string | null;
}

interface ProductionReport {
  ordersByStatus: Array<{ status: string; _count: number }>;
  delayedOrders: ProductionWorkOrder[];
  openOrders?: ProductionWorkOrder[];
  openCount?: number;
  delayedCount?: number;
  tasksByStatus: Array<{ status: string; _count: number }>;
  plannedVsActual?: {
    sampleSize: number;
    avgPlannedMinutes: number | null;
    avgActualMinutes: number | null;
    varianceMinutes: number | null;
    variancePercent: number | null;
  };
  onTimeRate?: {
    sampleSize: number;
    onTimeCount: number;
    onTimeRate: number | null;
  };
}

interface OrderProfitReport {
  totals: {
    sellerPrice: number;
    productionPrice: number;
    profit: number;
    orderCount: number;
  };
  orders: Array<{
    id: string;
    number: string;
    status: string;
    orderDate: string;
    customerId: string;
    customerName: string;
    sellerPrice: number;
    productionPrice: number;
    profit: number;
    marginPercent: number;
  }>;
}

interface InventoryReport {
  lowStock: Array<{
    sku: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    available: number;
    minStock: number;
  }>;
  onHand: Array<{
    sku: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    balances: Array<{ warehouse: string; availableQty: string | number }>;
  }>;
}

interface FinancialReport {
  invoicesByStatus: Array<{
    status: string;
    count: number;
    total: number;
    outstanding: number;
  }>;
  paymentsTotal: number;
  paymentCount: number;
  aging: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    older: number;
  };
  openInvoices: Array<{
    id?: string;
    number: string;
    customer: string;
    dueDate?: string | null;
    outstanding: string | number;
  }>;
}

interface PurchasingReport {
  purchaseOrdersByStatus: Array<{
    status: string;
    _count: number;
    _sum?: { total?: string | number | null };
  }>;
  purchaseRequestsByStatus: Array<{ status: string; _count: number }>;
  recentReceipts: Array<{
    id: string;
    number?: string;
    createdAt?: string;
    purchaseOrder?: { id: string; number: string } | null;
    warehouse?: { code: string } | null;
    lines?: Array<{ location?: { code: string } | null }>;
  }>;
}

function isForbidden(error: unknown) {
  return error instanceof ApiClientError && error.status === 403;
}

function money(value: string | number | undefined | null) {
  return Number(value ?? 0).toFixed(2);
}

function useReportQuery<T>(key: string, path: string) {
  return useQuery({
    queryKey: ["reports", key, path],
    queryFn: () => apiFetch<T>(path),
    retry: (failureCount, error) => {
      if (isForbidden(error)) return false;
      return failureCount < 1;
    },
  });
}

/** A figure on its own paper board (the old metric tile). */
function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: BoardTone;
}) {
  return (
    <Board tone={tone ?? "neutral"}>
      <Board.Body>
        <Figure
          size="md"
          label={label}
          value={value}
          delta={hint}
          tone={tone}
        />
      </Board.Body>
    </Board>
  );
}

export default function ReportsPage() {
  const ta = useTranslations("accounting");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const filterQs = useReportsFilterQs();
  const periodQs = filterQs;
  const { openPdf, pdfDialog } = usePdfDownload();
  const openExport = (name: string, label: string) =>
    openPdf({
      path: `/api/v1/reports/export/${name}.pdf${name === "financial" ? "" : periodQs}`,
      csvPath: `/api/v1/reports/export/${name}.csv${name === "financial" ? "" : periodQs}`,
      documentName: label,
      filename: `${name}.pdf`,
    });

  const dashboard = useReportQuery<DashboardReport>(
    "dashboard",
    "/api/v1/reports/dashboard",
  );
  const sales = useReportQuery<SalesReport>(
    "sales",
    `/api/v1/reports/sales${filterQs}`,
  );
  const production = useReportQuery<ProductionReport>(
    "production",
    `/api/v1/reports/production${periodQs}`,
  );
  const orderProfit = useReportQuery<OrderProfitReport>(
    "order-profit",
    `/api/v1/reports/order-profit${periodQs}`,
  );
  const productivity = useReportQuery<{
    totals: { workers: number; minutes: number; completedTasks: number };
    workers: Array<{
      userId: string;
      name: string;
      minutes: number;
      hours: number;
      entries: number;
      completedTasks: number;
      score: number;
    }>;
  }>("productivity", `/api/v1/reports/productivity${periodQs}`);
  const apLedger = useReportQuery<{
    aging: {
      current: number;
      d1_30: number;
      d31_60: number;
      d61_90: number;
      older: number;
    };
    totals: {
      openInvoices: number;
      outstanding: number;
      paymentsTotal: number;
      paymentCount: number;
    };
    bySupplier: Array<{
      supplierId: string;
      supplierName: string;
      count: number;
      outstanding: number;
    }>;
    openInvoices: Array<{
      id: string;
      number: string;
      supplierName: string;
      purchaseOrderId: string;
      purchaseOrderNumber: string;
      dueDate?: string | null;
      outstanding: number;
      daysPastDue: number;
      status: string;
    }>;
  }>("ap-ledger", `/api/v1/reports/ap-ledger${periodQs}`);
  const periodPl = useReportQuery<{
    laborRateJod: number;
    totals: {
      orderCount: number;
      revenueOrders: number;
      revenueInvoiced: number;
      materialCogs: number;
      reworkCost?: number;
      replacementCost?: number;
      recoveredValue?: number;
      scrapValue?: number;
      returnWriteOff?: number;
      supplierSpend: number;
      laborHours: number;
      laborCost: number;
      grossProfit: number;
      contribution: number;
    };
  }>("period-pl", `/api/v1/reports/period-pl${periodQs}`);
  const cashFlow = useReportQuery<{
    totals: { inflow: number; outflow: number; net: number };
    recentInflows: Array<{
      number: string;
      party: string;
      amount: number;
      date: string;
      method: string;
    }>;
    recentOutflows: Array<{
      number: string;
      party: string;
      amount: number;
      date: string;
      method: string;
    }>;
  }>("cash-flow", `/api/v1/reports/cash-flow${periodQs}`);
  const inventory = useReportQuery<InventoryReport>(
    "inventory",
    "/api/v1/reports/inventory",
  );
  const financial = useReportQuery<FinancialReport>(
    "financial",
    "/api/v1/reports/financial",
  );
  const purchasing = useReportQuery<PurchasingReport>(
    "purchasing",
    "/api/v1/reports/purchasing",
  );
  const laborRates = useReportQuery<
    Array<{
      id: string;
      userId?: string | null;
      hourlyRate: string | number;
      effectiveTo?: string | null;
      user?: { id: string; firstName: string; lastName: string } | null;
    }>
  >("labor-rates", "/api/v1/reports/cost/labor-rates");
  const laborActuals = useReportQuery<{
    labor: { actual: number | null; estimated: number | null } | null;
    byWorker: Array<{
      userId: string;
      name: string;
      minutes: number;
      actual: number | null;
    }>;
    byStage: Array<{
      stageDefinitionId: string;
      stageCode: string | null;
      actual: number | null;
      minutes: number;
    }>;
  }>("labor-actuals", `/api/v1/reports/cost/labor${periodQs}`);

  const anyLoading =
    dashboard.isLoading ||
    sales.isLoading ||
    production.isLoading ||
    inventory.isLoading ||
    financial.isLoading ||
    purchasing.isLoading;

  if (anyLoading && !dashboard.data && !sales.data && !financial.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const showDashboard = dashboard.isSuccess && !!dashboard.data;
  const showSales = sales.isSuccess && !!sales.data;
  const showProduction = production.isSuccess && !!production.data;
  const showOrderProfit = orderProfit.isSuccess && !!orderProfit.data;
  const showProductivity = productivity.isSuccess && !!productivity.data;
  const showApLedger = apLedger.isSuccess && !!apLedger.data;
  const showPeriodPl = periodPl.isSuccess && !!periodPl.data;
  const showCashFlow = cashFlow.isSuccess && !!cashFlow.data;
  const showInventory = inventory.isSuccess && !!inventory.data;
  const showFinancial = financial.isSuccess && !!financial.data;
  const showPurchasing = purchasing.isSuccess && !!purchasing.data;

  const dash = dashboard.data;
  const activeOrders = dash?.ordersInProduction ?? dash?.activeOrders ?? 0;
  const ordersDueSoon = dash?.ordersNearingDelivery ?? dash?.ordersDueSoon ?? 0;
  const delayedProduction = dash?.delayedOrders ?? dash?.delayedProduction ?? 0;
  const outstandingInvoices =
    dash?.openInvoices ?? dash?.outstandingInvoices ?? 0;
  const receivables =
    dash?.outstandingReceivables ?? dash?.receivablesAmount ?? 0;
  const lowStock = dash?.lowStockItems ?? dash?.lowStock ?? 0;

  return (
    <div className="maher-stagger space-y-5">
      <MoneyDeskBoard qs={filterQs} />
      <Board tone="neutral">
        <Board.Header
          title={ta("exportsTitle")}
          description={ta("exportHint")}
        />
        <Board.Body>
          <DocumentActions
            actions={[
              ...(showSales
                ? [
                    {
                      id: "sales",
                      label: ta("exportSales"),
                      onClick: () => openExport("sales", ta("exportSales")),
                    },
                  ]
                : []),
              ...(showOrderProfit
                ? [
                    {
                      id: "order-profit",
                      label: ta("exportProfit"),
                      onClick: () =>
                        openExport("order-profit", ta("exportProfit")),
                    },
                  ]
                : []),
              ...(showApLedger
                ? [
                    {
                      id: "ap-ledger",
                      label: ta("exportAp"),
                      onClick: () => openExport("ap-ledger", ta("exportAp")),
                    },
                  ]
                : []),
              ...(showPeriodPl
                ? [
                    {
                      id: "period-pl",
                      label: ta("exportPeriodPl"),
                      onClick: () =>
                        openExport("period-pl", ta("exportPeriodPl")),
                    },
                  ]
                : []),
              ...(showCashFlow
                ? [
                    {
                      id: "cash-flow",
                      label: ta("exportCashFlow"),
                      onClick: () =>
                        openExport("cash-flow", ta("exportCashFlow")),
                    },
                  ]
                : []),
              ...(showFinancial
                ? [
                    {
                      id: "financial",
                      label: ta("exportFinancial"),
                      onClick: () =>
                        openExport("financial", ta("exportFinancial")),
                    },
                  ]
                : []),
            ]}
          />
        </Board.Body>
      </Board>
      <MotionSection enter="rise" className="space-y-3">
        <h2 className="text-lg font-semibold">{ta("workerRates")}</h2>
        <p className="text-sm text-text-secondary">{ta("laborSlotHint")}</p>
        {(laborRates.data ?? []).filter((row) => row.userId && !row.effectiveTo)
          .length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta("workerRates")}</TableHeaderCell>
                <TableHeaderCell>{ta("laborCost")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(laborRates.data ?? [])
                .filter((row) => row.userId && !row.effectiveTo)
                .map((row) => {
                  const name = row.user
                    ? `${row.user.firstName} ${row.user.lastName}`.trim()
                    : row.userId;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.userId ? (
                          <Link href={`/employees?edit=${row.userId}`}>
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </TableCell>
                      <TableNumericCell>
                        <span dir="ltr">{money(Number(row.hourlyRate))}</span>
                      </TableNumericCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title={ta("noWorkerRates")} />
        )}
      </MotionSection>
      <MotionSection enter="rise" className="space-y-3">
        <h2 className="text-lg font-semibold">{ta("laborByWorker")}</h2>
        {(laborActuals.data?.byWorker ?? []).length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ta("laborByWorker")}</TableHeaderCell>
                <TableHeaderCell>{ta("factoryTime")}</TableHeaderCell>
                <TableHeaderCell>{ta("laborCost")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(laborActuals.data?.byWorker ?? []).map((row) => (
                <TableRow key={row.userId}>
                  <TableCell>
                    <Link href={`/employees?edit=${row.userId}`}>
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableNumericCell>
                    <span dir="ltr">{(row.minutes / 60).toFixed(1)} h</span>
                  </TableNumericCell>
                  <TableNumericCell>
                    <span dir="ltr">
                      {row.actual == null
                        ? ta("notConfiguredYet")
                        : money(row.actual)}
                    </span>
                  </TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title={ta("noLaborActuals")} />
        )}
      </MotionSection>

      {showDashboard ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportDashboard")}</h2>
          {dash?.generatedAt ? (
            <p className="text-sm text-text-secondary" dir="ltr">
              {ta("generatedAt")}{" "}
              {dash.generatedAt.slice(0, 19).replace("T", " ")}
            </p>
          ) : null}
          <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={tCommon("metricActiveOrders")}
              value={<span dir="ltr">{activeOrders}</span>}
            />
            <Metric
              label={tCommon("metricOrdersDueSoon")}
              value={<span dir="ltr">{ordersDueSoon}</span>}
            />
            <Metric
              label={tCommon("metricDelayedProduction")}
              value={<span dir="ltr">{delayedProduction}</span>}
            />
            <Metric
              label={tCommon("metricOutstandingInvoices")}
              value={<span dir="ltr">{outstandingInvoices}</span>}
            />
            <Metric
              label={tCommon("metricRevenueInvoiced")}
              value={<span dir="ltr">{money(dash?.revenueInvoiced)}</span>}
            />
            <Metric
              label={tCommon("metricReceivables")}
              value={<span dir="ltr">{money(receivables)}</span>}
            />
            <Metric
              label={tCommon("metricLowStock")}
              value={<span dir="ltr">{lowStock}</span>}
            />
            <Metric
              label={tCommon("metricOpenPurchases")}
              value={<span dir="ltr">{dash?.openPurchases ?? 0}</span>}
            />
          </div>
        </MotionSection>
      ) : isForbidden(dashboard.error) ? null : dashboard.isError ? (
        <ForbiddenOrError
          title={ta("reportDashboard")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showSales ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportSales")}</h2>
          <div className="maher-stagger grid gap-4 lg:grid-cols-2">
            <Board>
              <Board.Header title={ta("ordersByStatus")} />
              <Board.Body>
                <StatusCountTable
                  rows={sales.data.ordersByStatus.map((r) => ({
                    status: r.status,
                    count: r.count,
                    total: r.total,
                  }))}
                  showTotal
                  countLabel={ta("count")}
                  totalLabel={ta("total")}
                  statusLabel={tCommon("status")}
                  empty={ta("noData")}
                />
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("topCustomers")} />
              <Board.Body>
                {(sales.data.topCustomers ?? []).length === 0 ? (
                  <EmptyState title={ta("noData")} />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{ta("customer")}</TableHeaderCell>
                        <TableHeaderCell>{ta("orderCount")}</TableHeaderCell>
                        <TableHeaderCell>{ta("total")}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sales.data.topCustomers.map((c) => (
                        <TableRow key={c.customerId}>
                          <TableCell>
                            <Link
                              href={`/admin/customers/${c.customerId}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {c.customerName}
                            </Link>
                          </TableCell>
                          <TableNumericCell>{c.orderCount}</TableNumericCell>
                          <TableNumericCell>{money(c.total)}</TableNumericCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("topProducts")} />
              <Board.Body>
                {(sales.data.topProducts ?? []).length === 0 ? (
                  <EmptyState title={ta("noData")} />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{ta("filterProduct")}</TableHeaderCell>
                        <TableHeaderCell>{ta("count")}</TableHeaderCell>
                        <TableHeaderCell>{ta("total")}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(sales.data.topProducts ?? []).map((p) => (
                        <TableRow key={p.productId ?? p.name ?? "unknown"}>
                          <TableCell>
                            {p.productId ? (
                              <Link
                                href={`/admin/reports/orders${filterQs}${filterQs ? "&" : "?"}productId=${p.productId}`}
                                className="underline"
                              >
                                {p.name ?? p.sku ?? p.productId}
                              </Link>
                            ) : (
                              (p.name ?? p.sku ?? "—")
                            )}
                          </TableCell>
                          <TableNumericCell>{p.lineCount}</TableNumericCell>
                          <TableNumericCell>{money(p.total)}</TableNumericCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("bySalesRep")} />
              <Board.Body>
                {(sales.data.bySalesRep ?? []).length === 0 ? (
                  <EmptyState title={ta("noData")} />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>
                          {ta("filterSalesRep")}
                        </TableHeaderCell>
                        <TableHeaderCell>{ta("count")}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(sales.data.bySalesRep ?? []).map((r) => (
                        <TableRow key={r.salesRepId ?? r.name ?? "unknown"}>
                          <TableCell>{r.name}</TableCell>
                          <TableNumericCell>
                            {r.quotationCount}
                          </TableNumericCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Board.Body>
            </Board>
          </div>
          <Board>
            <Board.Header title={ta("recentQuotes")} />
            <Board.Body>
              {(sales.data.recentQuotes ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{tCommon("number")}</TableHeaderCell>
                      <TableHeaderCell>{ta("customer")}</TableHeaderCell>
                      <TableHeaderCell>{ta("filterSalesRep")}</TableHeaderCell>
                      <TableHeaderCell>{tCommon("status")}</TableHeaderCell>
                      <TableHeaderCell>{ta("total")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sales.data.recentQuotes.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <Link
                            href={`/admin/quotations/${q.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {q.number}
                          </Link>
                        </TableCell>
                        <TableCell>{q.customer}</TableCell>
                        <TableCell>{q.salesRep ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={q.status} />
                        </TableCell>
                        <TableNumericCell>{money(q.total)}</TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(sales.error) ? null : sales.isError ? (
        <ForbiddenOrError
          title={ta("reportSales")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showOrderProfit ||
      showPeriodPl ||
      showCashFlow ||
      showApLedger ||
      showFinancial ? (
        <div className="border-t border-border pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {ta("reportCost")}
          </p>
        </div>
      ) : null}

      {showOrderProfit ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportOrderProfit")}</h2>
          <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={ta("sellerPrice")}
              value={
                <span dir="ltr">
                  {money(orderProfit.data.totals.sellerPrice)}
                </span>
              }
            />
            <Metric
              label={ta("productionCost")}
              value={
                <span dir="ltr">
                  {money(orderProfit.data.totals.productionPrice)}
                </span>
              }
            />
            <Metric
              label={ta("profit")}
              value={
                <span dir="ltr">{money(orderProfit.data.totals.profit)}</span>
              }
            />
            <Metric
              label={ta("orderCount")}
              value={
                <span dir="ltr">{orderProfit.data.totals.orderCount}</span>
              }
            />
          </div>
          <Board>
            <Board.Header title={ta("reportOrderProfit")} />
            <Board.Body>
              {(orderProfit.data.orders ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{tCommon("number")}</TableHeaderCell>
                      <TableHeaderCell>{ta("customer")}</TableHeaderCell>
                      <TableHeaderCell>{ta("sellerPrice")}</TableHeaderCell>
                      <TableHeaderCell>{ta("productionCost")}</TableHeaderCell>
                      <TableHeaderCell>{ta("profit")}</TableHeaderCell>
                      <TableHeaderCell>{ta("marginPercent")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderProfit.data.orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link
                            href={`/admin/sales-orders/${o.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {o.number}
                          </Link>
                        </TableCell>
                        <TableCell>{o.customerName}</TableCell>
                        <TableNumericCell>
                          {money(o.sellerPrice)}
                        </TableNumericCell>
                        <TableNumericCell>
                          {money(o.productionPrice)}
                        </TableNumericCell>
                        <TableNumericCell>{money(o.profit)}</TableNumericCell>
                        <TableNumericCell>
                          {money(o.marginPercent)}
                        </TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(orderProfit.error) ? null : orderProfit.isError ? (
        <ForbiddenOrError
          title={ta("reportOrderProfit")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showPeriodPl ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportPeriodPl")}</h2>
          <p className="text-sm text-text-secondary">
            {ta("periodPlHint")} ({ta("laborRate")}:{" "}
            <span dir="ltr">{money(periodPl.data.laborRateJod)}</span>)
          </p>
          <div className="maher-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={ta("revenueOrders")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.revenueOrders)}
                </span>
              }
            />
            <Metric
              label={ta("materialCogs")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.materialCogs)}
                </span>
              }
            />
            <Metric
              label={ta("reworkCost")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.reworkCost ?? 0)}
                </span>
              }
            />
            <Metric
              label={ta("replacementCost")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.replacementCost ?? 0)}
                </span>
              }
            />
            <Metric
              label={ta("recoveredValue")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.recoveredValue ?? 0)}
                </span>
              }
            />
            <Metric
              label={ta("scrapValue")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.scrapValue ?? 0)}
                </span>
              }
            />
            <Metric
              label={ta("returnWriteOff")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.returnWriteOff ?? 0)}
                </span>
              }
            />
            <Metric
              label={ta("laborCost")}
              value={
                <span dir="ltr">{money(periodPl.data.totals.laborCost)}</span>
              }
            />
            <Metric
              label={ta("contribution")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.contribution)}
                </span>
              }
            />
            <Metric
              label={ta("grossProfit")}
              value={
                <span dir="ltr">{money(periodPl.data.totals.grossProfit)}</span>
              }
            />
            <Metric
              label={ta("revenueInvoiced")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.revenueInvoiced)}
                </span>
              }
            />
            <Metric
              label={ta("supplierSpend")}
              value={
                <span dir="ltr">
                  {money(periodPl.data.totals.supplierSpend)}
                </span>
              }
            />
            <Metric
              label={ta("hoursLogged")}
              value={
                <span dir="ltr">{money(periodPl.data.totals.laborHours)}</span>
              }
            />
          </div>
        </MotionSection>
      ) : isForbidden(periodPl.error) ? null : periodPl.isError ? (
        <ForbiddenOrError
          title={ta("reportPeriodPl")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showCashFlow ? (
        <MotionSection enter="rise" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{ta("reportCashFlow")}</h2>
          </div>
          <p className="text-sm text-text-secondary">{ta("cashFlowHint")}</p>
          <div className="maher-stagger grid gap-4 sm:grid-cols-3">
            <Metric
              label={ta("cashInflow")}
              value={
                <span dir="ltr">{money(cashFlow.data.totals.inflow)}</span>
              }
            />
            <Metric
              label={ta("cashOutflow")}
              value={
                <span dir="ltr">{money(cashFlow.data.totals.outflow)}</span>
              }
            />
            <Metric
              label={ta("cashNet")}
              value={<span dir="ltr">{money(cashFlow.data.totals.net)}</span>}
            />
          </div>
        </MotionSection>
      ) : isForbidden(cashFlow.error) ? null : cashFlow.isError ? (
        <ForbiddenOrError
          title={ta("reportCashFlow")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showApLedger ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportApLedger")}</h2>
          <div className="maher-stagger grid gap-4 lg:grid-cols-2">
            <Board>
              <Board.Header title={ta("apAging")} />
              <Board.Body>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {(
                    [
                      ["agingCurrent", apLedger.data.aging.current],
                      ["agingD1_30", apLedger.data.aging.d1_30],
                      ["agingD31_60", apLedger.data.aging.d31_60],
                      ["agingD61_90", apLedger.data.aging.d61_90],
                      ["agingOlder", apLedger.data.aging.older],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-text-secondary">{ta(key)}</dt>
                      <dd className="font-medium" dir="ltr">
                        {money(value)} {tCommon("currency")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-text-secondary">
                  {ta("outstanding")}:{" "}
                  <span dir="ltr" className="font-medium text-text-primary">
                    {money(apLedger.data.totals.outstanding)}{" "}
                    {tCommon("currency")}
                  </span>
                </p>
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("bySupplier")} />
              <Board.Body>
                {(apLedger.data.bySupplier ?? []).length === 0 ? (
                  <EmptyState title={ta("noData")} />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{ta("supplier")}</TableHeaderCell>
                        <TableHeaderCell>{ta("count")}</TableHeaderCell>
                        <TableHeaderCell>{ta("outstanding")}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apLedger.data.bySupplier.map((s) => (
                        <TableRow key={s.supplierId}>
                          <TableCell>{s.supplierName}</TableCell>
                          <TableNumericCell>{s.count}</TableNumericCell>
                          <TableNumericCell>
                            {money(s.outstanding)}
                          </TableNumericCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Board.Body>
            </Board>
          </div>
          <Board>
            <Board.Header title={ta("openSupplierInvoices")} />
            <Board.Body>
              {(apLedger.data.openInvoices ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{tCommon("number")}</TableHeaderCell>
                      <TableHeaderCell>{ta("supplier")}</TableHeaderCell>
                      <TableHeaderCell>{ta("purchaseOrder")}</TableHeaderCell>
                      <TableHeaderCell>{ta("daysLate")}</TableHeaderCell>
                      <TableHeaderCell>{ta("outstanding")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apLedger.data.openInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link
                            href={`/admin/purchasing/supplier-invoices/${inv.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {inv.number}
                          </Link>
                        </TableCell>
                        <TableCell>{inv.supplierName}</TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/purchasing/${inv.purchaseOrderId}`}
                            className="text-brand hover:underline"
                          >
                            {inv.purchaseOrderNumber}
                          </Link>
                        </TableCell>
                        <TableNumericCell>{inv.daysPastDue}</TableNumericCell>
                        <TableNumericCell>
                          {money(inv.outstanding)}
                        </TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(apLedger.error) ? null : apLedger.isError ? (
        <ForbiddenOrError
          title={ta("reportApLedger")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showProductivity ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportProductivity")}</h2>
          <div className="maher-stagger grid gap-4 sm:grid-cols-3">
            <Metric
              label={ta("worker")}
              value={<span dir="ltr">{productivity.data.totals.workers}</span>}
            />
            <Metric
              label={ta("hoursLogged")}
              value={
                <span dir="ltr">
                  {(productivity.data.totals.minutes / 60).toFixed(1)}
                </span>
              }
            />
            <Metric
              label={ta("completedTasks")}
              value={
                <span dir="ltr">{productivity.data.totals.completedTasks}</span>
              }
            />
          </div>
          <Board>
            <Board.Header title={ta("reportProductivity")} />
            <Board.Body>
              {(productivity.data.workers ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{ta("worker")}</TableHeaderCell>
                      <TableHeaderCell>{ta("hoursLogged")}</TableHeaderCell>
                      <TableHeaderCell>{ta("completedTasks")}</TableHeaderCell>
                      <TableHeaderCell>
                        {ta("productivityScore")}
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productivity.data.workers.map((w) => (
                      <TableRow key={w.userId}>
                        <TableCell>{w.name}</TableCell>
                        <TableNumericCell>{money(w.hours)}</TableNumericCell>
                        <TableNumericCell>{w.completedTasks}</TableNumericCell>
                        <TableNumericCell>{money(w.score)}</TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(productivity.error) ? null : productivity.isError ? (
        <ForbiddenOrError
          title={ta("reportProductivity")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showFinancial ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportFinancial")}</h2>
          <div className="maher-stagger grid gap-4 lg:grid-cols-2">
            <Board>
              <Board.Header title={ta("arAging")} />
              <Board.Body>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {(
                    [
                      ["agingCurrent", financial.data.aging.current],
                      ["agingD1_30", financial.data.aging.d1_30],
                      ["agingD31_60", financial.data.aging.d31_60],
                      ["agingD61_90", financial.data.aging.d61_90],
                      ["agingOlder", financial.data.aging.older],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-text-secondary">{ta(key)}</dt>
                      <dd className="font-medium" dir="ltr">
                        {money(value)} {tCommon("currency")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-text-secondary">
                  {ta("paymentsTotal")}:{" "}
                  <span dir="ltr" className="font-medium text-text-primary">
                    {money(financial.data.paymentsTotal)} {tCommon("currency")}
                  </span>
                  {" · "}
                  {ta("paymentCount")}:{" "}
                  <span dir="ltr" className="font-medium text-text-primary">
                    {financial.data.paymentCount}
                  </span>
                </p>
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("invoicesByStatus")} />
              <Board.Body>
                <StatusCountTable
                  rows={financial.data.invoicesByStatus.map((r) => ({
                    status: r.status,
                    count: r.count,
                    total: r.total,
                  }))}
                  showTotal
                  countLabel={ta("count")}
                  totalLabel={ta("total")}
                  statusLabel={tCommon("status")}
                  empty={ta("noData")}
                />
              </Board.Body>
            </Board>
          </div>
          <Board>
            <Board.Header title={ta("openInvoices")} />
            <Board.Body>
              {(financial.data.openInvoices ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{ta("invoiceNumber")}</TableHeaderCell>
                      <TableHeaderCell>{ta("customer")}</TableHeaderCell>
                      <TableHeaderCell>{ta("dueDate")}</TableHeaderCell>
                      <TableHeaderCell>{ta("outstanding")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {financial.data.openInvoices.map((inv) => (
                      <TableRow key={inv.id ?? inv.number}>
                        <TableCell>
                          {inv.id ? (
                            <Link
                              href={`/admin/invoices/${inv.id}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {inv.number}
                            </Link>
                          ) : (
                            inv.number
                          )}
                        </TableCell>
                        <TableCell>{inv.customer}</TableCell>
                        <TableNumericCell>
                          {inv.dueDate?.toString().slice(0, 10) ?? "—"}
                        </TableNumericCell>
                        <TableNumericCell>
                          {money(inv.outstanding)}
                        </TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(financial.error) ? null : financial.isError ? (
        <ForbiddenOrError
          title={ta("reportFinancial")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showProduction || showProductivity ? (
        <div className="border-t border-border pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {ta("reportProduction")}
          </p>
        </div>
      ) : null}

      <MotionSection enter="rise" className="space-y-3">
        <h2 className="text-lg font-semibold">{ta("reportQuality")}</h2>
        <Board>
          <Board.Header title={ta("reportQuality")} />
          <Board.Body>
            <p className="text-sm text-text-secondary">
              {ta("qualityReportHint")}
            </p>
            <Link
              href="/admin/quality"
              className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline"
            >
              {ta("openQualityBoard")}
            </Link>
          </Board.Body>
        </Board>
      </MotionSection>

      {showProduction ? (
        <MotionSection enter="rise" className="space-y-4">
          <h2 className="text-lg font-semibold">{ta("reportProduction")}</h2>
          <div className="maher-stagger grid gap-4 sm:grid-cols-3">
            <Metric
              label={ta("onTimeRate")}
              value={
                <span dir="ltr">
                  {production.data.onTimeRate?.onTimeRate != null
                    ? `${production.data.onTimeRate.onTimeRate}%`
                    : "—"}
                </span>
              }
            />
            <Metric
              label={ta("plannedVsActualMinutes")}
              value={
                <span dir="ltr">
                  {production.data.plannedVsActual?.avgPlannedMinutes != null
                    ? `${production.data.plannedVsActual.avgPlannedMinutes} / ${production.data.plannedVsActual.avgActualMinutes}`
                    : "—"}
                </span>
              }
            />
            <Metric
              label={ta("scheduleVariancePercent")}
              value={
                <span dir="ltr">
                  {production.data.plannedVsActual?.variancePercent != null
                    ? `${production.data.plannedVsActual.variancePercent > 0 ? "+" : ""}${production.data.plannedVsActual.variancePercent}%`
                    : "—"}
                </span>
              }
            />
          </div>
          <div className="maher-stagger grid gap-4 lg:grid-cols-2">
            <Board>
              <Board.Header title={ta("ordersByStatus")} />
              <Board.Body>
                <StatusCountTable
                  rows={production.data.ordersByStatus.map((r) => ({
                    status: r.status,
                    count: r._count,
                  }))}
                  countLabel={ta("count")}
                  totalLabel={ta("total")}
                  statusLabel={tCommon("status")}
                  empty={ta("noData")}
                />
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("tasksByStatus")} />
              <Board.Body>
                <StatusCountTable
                  rows={production.data.tasksByStatus.map((r) => ({
                    status: r.status,
                    count: r._count,
                  }))}
                  countLabel={ta("count")}
                  totalLabel={ta("total")}
                  statusLabel={tCommon("status")}
                  empty={ta("noData")}
                />
              </Board.Body>
            </Board>
          </div>
          <Board>
            <Board.Header title={ta("openWorkOrders")} />
            <Board.Body>
              {(production.data.openOrders ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{tCommon("number")}</TableHeaderCell>
                      <TableHeaderCell>{ta("customer")}</TableHeaderCell>
                      <TableHeaderCell>{ta("currentStage")}</TableHeaderCell>
                      <TableHeaderCell>{tCommon("status")}</TableHeaderCell>
                      <TableHeaderCell>{ta("dueDate")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(production.data.openOrders ?? []).map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>
                          <Link
                            href={`/admin/production/${po.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {po.number}
                          </Link>
                        </TableCell>
                        <TableCell>{po.customerName ?? "—"}</TableCell>
                        <TableNumericCell>
                          {po.currentStageCode ?? "—"}
                        </TableNumericCell>
                        <TableCell>
                          <StatusBadge status={po.status} />
                        </TableCell>
                        <TableNumericCell>
                          {po.requiredDeliveryDate?.toString().slice(0, 10) ??
                            "—"}
                        </TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
          <Board>
            <Board.Header title={ta("delayedOrders")} />
            <Board.Body>
              {(production.data.delayedOrders ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{tCommon("number")}</TableHeaderCell>
                      <TableHeaderCell>{ta("salesOrder")}</TableHeaderCell>
                      <TableHeaderCell>{ta("customer")}</TableHeaderCell>
                      <TableHeaderCell>{ta("daysLate")}</TableHeaderCell>
                      <TableHeaderCell>{tCommon("status")}</TableHeaderCell>
                      <TableHeaderCell>{ta("dueDate")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {production.data.delayedOrders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>
                          <Link
                            href={`/admin/production/${po.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {po.number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {po.salesOrder?.id || po.salesOrderId ? (
                            <Link
                              href={`/admin/sales-orders/${po.salesOrder?.id ?? po.salesOrderId}`}
                              className="text-brand hover:underline"
                            >
                              {po.salesOrder?.number ?? "—"}
                            </Link>
                          ) : (
                            (po.salesOrder?.number ?? "—")
                          )}
                        </TableCell>
                        <TableCell>{po.customerName ?? "—"}</TableCell>
                        <TableNumericCell>{po.daysLate ?? 0}</TableNumericCell>
                        <TableCell>
                          <StatusBadge status={po.status} />
                        </TableCell>
                        <TableNumericCell>
                          {po.requiredDeliveryDate?.toString().slice(0, 10) ??
                            "—"}
                        </TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(production.error) ? null : production.isError ? (
        <ForbiddenOrError
          title={ta("reportProduction")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showInventory ? (
        <MotionSection enter="rise" className="space-y-4">
          <div className="border-t border-border pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              {ta("reportInventory")}
            </p>
          </div>
          <h2 className="text-lg font-semibold">{ta("reportInventory")}</h2>
          <Board>
            <Board.Header title={ta("lowStock")} />
            <Board.Body>
              {(inventory.data.lowStock ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{ta("sku")}</TableHeaderCell>
                      <TableHeaderCell>{tCommon("details")}</TableHeaderCell>
                      <TableHeaderCell>{ta("available")}</TableHeaderCell>
                      <TableHeaderCell>{ta("minStock")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inventory.data.lowStock.map((item) => (
                      <TableRow key={item.sku}>
                        <TableNumericCell>{item.sku}</TableNumericCell>
                        <TableCell>{localizedName(locale, item)}</TableCell>
                        <TableNumericCell>{item.available}</TableNumericCell>
                        <TableNumericCell>{item.minStock}</TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(inventory.error) ? null : inventory.isError ? (
        <ForbiddenOrError
          title={ta("reportInventory")}
          message={tCommon("loadFailed")}
        />
      ) : null}

      {showPurchasing ? (
        <MotionSection enter="rise" className="space-y-4">
          <div className="border-t border-border pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              {ta("reportPurchasing")}
            </p>
          </div>
          <h2 className="text-lg font-semibold">{ta("reportPurchasing")}</h2>
          <div className="maher-stagger grid gap-4 lg:grid-cols-2">
            <Board>
              <Board.Header title={ta("purchaseOrdersByStatus")} />
              <Board.Body>
                <StatusCountTable
                  rows={purchasing.data.purchaseOrdersByStatus.map((r) => ({
                    status: r.status,
                    count: r._count,
                    total: Number(r._sum?.total ?? 0),
                  }))}
                  showTotal
                  countLabel={ta("count")}
                  totalLabel={ta("total")}
                  statusLabel={tCommon("status")}
                  empty={ta("noData")}
                />
              </Board.Body>
            </Board>
            <Board>
              <Board.Header title={ta("purchaseRequestsByStatus")} />
              <Board.Body>
                <StatusCountTable
                  rows={purchasing.data.purchaseRequestsByStatus.map((r) => ({
                    status: r.status,
                    count: r._count,
                  }))}
                  countLabel={ta("count")}
                  totalLabel={ta("total")}
                  statusLabel={tCommon("status")}
                  empty={ta("noData")}
                />
              </Board.Body>
            </Board>
          </div>
          <Board>
            <Board.Header title={ta("recentReceipts")} />
            <Board.Body>
              {(purchasing.data.recentReceipts ?? []).length === 0 ? (
                <EmptyState title={ta("noData")} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{tCommon("number")}</TableHeaderCell>
                      <TableHeaderCell>{ta("purchaseOrder")}</TableHeaderCell>
                      <TableHeaderCell>{ta("warehouse")}</TableHeaderCell>
                      <TableHeaderCell>{ta("bin")}</TableHeaderCell>
                      <TableHeaderCell>{tCommon("date")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchasing.data.recentReceipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.number ?? r.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {r.purchaseOrder ? (
                            <Link
                              href={`/admin/purchasing/${r.purchaseOrder.id}`}
                              className="text-brand hover:underline"
                            >
                              {r.purchaseOrder.number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableNumericCell>
                          {r.warehouse?.code ?? "—"}
                        </TableNumericCell>
                        <TableCell dir="ltr">
                          {[
                            ...new Set(
                              (r.lines ?? [])
                                .map((line) => line.location?.code)
                                .filter(Boolean),
                            ),
                          ].join(" · ") || "—"}
                        </TableCell>
                        <TableNumericCell>
                          {r.createdAt?.slice(0, 10) ?? "—"}
                        </TableNumericCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Board.Body>
          </Board>
        </MotionSection>
      ) : isForbidden(purchasing.error) ? null : purchasing.isError ? (
        <ForbiddenOrError
          title={ta("reportPurchasing")}
          message={tCommon("loadFailed")}
        />
      ) : null}
      {pdfDialog}
    </div>
  );
}

function ForbiddenOrError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Board>
      <Board.Header title={title} />
      <Board.Body>
        <p className="text-sm text-text-secondary">{message}</p>
      </Board.Body>
    </Board>
  );
}

function StatusCountTable({
  rows,
  showTotal,
  countLabel,
  totalLabel,
  statusLabel,
  empty,
}: {
  rows: Array<{ status: string; count: number; total?: number }>;
  showTotal?: boolean;
  countLabel: string;
  totalLabel: string;
  statusLabel: string;
  empty: string;
}) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{statusLabel}</TableHeaderCell>
          <TableHeaderCell>{countLabel}</TableHeaderCell>
          {showTotal ? <TableHeaderCell>{totalLabel}</TableHeaderCell> : null}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.status}>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableNumericCell>{row.count}</TableNumericCell>
            {showTotal ? (
              <TableNumericCell>{money(row.total)}</TableNumericCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
