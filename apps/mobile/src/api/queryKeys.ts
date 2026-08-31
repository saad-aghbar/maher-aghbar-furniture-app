export const queryKeys = {
  settings: {
    all: ['settings'] as const,
    root: () => [...queryKeys.settings.all, 'root'] as const,
  },
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    lists: () => [...queryKeys.catalog.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.catalog.lists(), filters] as const,
    categories: () => [...queryKeys.catalog.all, 'categories'] as const,
    details: () => [...queryKeys.catalog.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.catalog.details(), id] as const,
    adminDetails: () => [...queryKeys.catalog.all, 'admin-detail'] as const,
    adminDetail: (id: string) => [...queryKeys.catalog.adminDetails(), id] as const,
    dealerPrices: (productId: string) =>
      [...queryKeys.catalog.all, 'dealer-prices', productId] as const,
    previouslyOrdered: () => [...queryKeys.catalog.all, 'previously-ordered'] as const,
    productCategories: () => [...queryKeys.catalog.all, 'product-categories'] as const,
    materials: (filters: { q?: string; categoryGroup?: string } = {}) =>
      [...queryKeys.catalog.all, 'materials', filters] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    lists: () => [...queryKeys.invoices.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.invoices.lists(), filters] as const,
    details: () => [...queryKeys.invoices.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.notifications.lists(), filters] as const,
  },
  reports: {
    all: ['reports'] as const,
    adminHome: () => [...queryKeys.reports.all, 'admin-home'] as const,
    managementSummary: () => [...queryKeys.reports.all, 'management-summary'] as const,
    dealerHome: () => [...queryKeys.reports.all, 'dealer-home'] as const,
    workerHome: () => [...queryKeys.reports.all, 'worker-home'] as const,
    dashboard: () => [...queryKeys.reports.all, 'dashboard'] as const,
    sales: (q: string) => [...queryKeys.reports.all, 'sales', q] as const,
    production: (q: string) => [...queryKeys.reports.all, 'production', q] as const,
    orderProfit: (q: string) => [...queryKeys.reports.all, 'order-profit', q] as const,
    financial: () => [...queryKeys.reports.all, 'financial'] as const,
    cashFlow: (q: string) => [...queryKeys.reports.all, 'cash-flow', q] as const,
    periodPl: (q: string) => [...queryKeys.reports.all, 'period-pl', q] as const,
    inventory: () => [...queryKeys.reports.all, 'inventory'] as const,
    purchasing: () => [...queryKeys.reports.all, 'purchasing'] as const,
  },
  salesOrders: {
    all: ['sales-orders'] as const,
    lists: () => [...queryKeys.salesOrders.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.salesOrders.lists(), filters] as const,
    details: () => [...queryKeys.salesOrders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.salesOrders.details(), id] as const,
    manufacturingCost: (id: string) =>
      [...queryKeys.salesOrders.detail(id), 'manufacturing-cost'] as const,
    productionSetup: (id: string) =>
      [...queryKeys.salesOrders.detail(id), 'production-setup'] as const,
    productionSetupReleasePreview: (id: string) =>
      [...queryKeys.salesOrders.productionSetup(id), 'release-preview'] as const,
  },
  requests: {
    all: ['requests'] as const,
    lists: () => [...queryKeys.requests.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.requests.lists(), filters] as const,
    details: () => [...queryKeys.requests.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.requests.details(), id] as const,
  },
  quotations: {
    all: ['quotations'] as const,
    lists: () => [...queryKeys.quotations.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.quotations.lists(), filters] as const,
    details: () => [...queryKeys.quotations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.quotations.details(), id] as const,
  },
  aiIntake: {
    all: ['ai-intake'] as const,
    lists: () => [...queryKeys.aiIntake.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.aiIntake.lists(), filters] as const,
    details: () => [...queryKeys.aiIntake.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.aiIntake.details(), id] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    groups: () => [...queryKeys.inventory.all, 'groups'] as const,
    lists: () => [...queryKeys.inventory.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.inventory.lists(), filters] as const,
    details: () => [...queryKeys.inventory.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.inventory.details(), id] as const,
    transactions: (id: string, filters: unknown = {}) =>
      [...queryKeys.inventory.detail(id), 'transactions', filters] as const,
    warehouses: () => [...queryKeys.inventory.all, 'warehouses'] as const,
    transfers: () => [...queryKeys.inventory.all, 'transfers'] as const,
    transfersList: (filters: unknown = {}) =>
      [...queryKeys.inventory.transfers(), filters] as const,
    counts: () => [...queryKeys.inventory.all, 'counts'] as const,
    countsList: (filters: unknown = {}) =>
      [...queryKeys.inventory.counts(), filters] as const,
    openReceipts: (itemId: string) =>
      [...queryKeys.inventory.all, 'open-receipts', itemId] as const,
    overview: () => [...queryKeys.inventory.all, 'overview'] as const,
    lowStock: () => [...queryKeys.inventory.all, 'low-stock'] as const,
    semiFinished: (filters: unknown = {}) =>
      [...queryKeys.inventory.all, 'semi-finished', filters] as const,
    wipKitBoard: (
      filters: {
        custody?: string;
        productionOrderId?: string;
        status?: string;
        scope?: string;
        from?: string;
        to?: string;
        warehouseId?: string;
        q?: string;
      } = {},
    ) =>
      [
        ...queryKeys.inventory.all,
        'wip-kit-board',
        filters.custody ?? 'all',
        filters.productionOrderId ?? 'all',
        filters.status ?? 'default',
        filters.scope ?? 'active',
        filters.from ?? '',
        filters.to ?? '',
        filters.warehouseId ?? 'all',
        filters.q ?? '',
      ] as const,
    wipKitDetail: (id: string) => [...queryKeys.inventory.all, 'wip-kit', id] as const,
    wipKitTimeline: (id: string) =>
      [...queryKeys.inventory.all, 'wip-kit-timeline', id] as const,
    finishedGoods: (filters: unknown = {}) =>
      [...queryKeys.inventory.all, 'finished-goods', filters] as const,
    finishedLots: (filters: unknown = {}) =>
      [...queryKeys.inventory.all, 'finished-lots', filters] as const,
  },
  production: {
    all: ['production'] as const,
    summary: () => [...queryKeys.production.all, 'summary'] as const,
    lists: () => [...queryKeys.production.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.production.lists(), filters] as const,
    details: () => [...queryKeys.production.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.production.details(), id] as const,
    planSetup: (id: string) => [...queryKeys.production.all, 'plan-setup', id] as const,
    workers: (
      q?: string,
      stageDefinitionId?: string,
      opts?: { taskId?: string; plannedStart?: string; plannedCompletion?: string },
    ) =>
      [
        ...queryKeys.production.all,
        'workers',
        q ?? '',
        stageDefinitionId ?? '',
        opts?.taskId ?? '',
        opts?.plannedStart ?? '',
        opts?.plannedCompletion ?? '',
      ] as const,
  },
  purchasing: {
    all: ['purchasing'] as const,
    lists: () => [...queryKeys.purchasing.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.purchasing.lists(), filters] as const,
    requestLists: () => [...queryKeys.purchasing.all, 'requests'] as const,
    requestList: (filters: unknown = {}) =>
      [...queryKeys.purchasing.requestLists(), filters] as const,
    invoiceLists: () => [...queryKeys.purchasing.all, 'supplier-invoices'] as const,
    invoiceList: (filters: unknown = {}) =>
      [...queryKeys.purchasing.invoiceLists(), filters] as const,
    details: () => [...queryKeys.purchasing.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.purchasing.details(), id] as const,
    requestDetails: () => [...queryKeys.purchasing.all, 'request-detail'] as const,
    requestDetail: (id: string) => [...queryKeys.purchasing.requestDetails(), id] as const,
    invoiceDetails: () => [...queryKeys.purchasing.all, 'invoice-detail'] as const,
    invoiceDetail: (id: string) => [...queryKeys.purchasing.invoiceDetails(), id] as const,
    suppliers: (filters: unknown = {}) =>
      [...queryKeys.purchasing.all, 'suppliers', filters] as const,
    materialDemand: () => [...queryKeys.purchasing.all, 'material-demand'] as const,
  },
  payments: {
    all: ['payments'] as const,
    lists: () => [...queryKeys.payments.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.payments.lists(), filters] as const,
    dealerSummary: (customerId: string) =>
      [...queryKeys.payments.all, 'dealer-summary', customerId] as const,
  },
  statements: {
    all: ['statements'] as const,
    detail: (customerId: string) =>
      [...queryKeys.statements.all, 'detail', customerId] as const,
  },
  returns: {
    all: ['returns'] as const,
    lists: () => [...queryKeys.returns.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.returns.lists(), filters] as const,
    details: () => [...queryKeys.returns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.returns.details(), id] as const,
  },
  search: {
    all: ['search'] as const,
    lists: () => [...queryKeys.search.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.search.lists(), filters] as const,
  },
  dealers: {
    all: ['dealers'] as const,
    lists: () => [...queryKeys.dealers.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.dealers.lists(), filters] as const,
    details: () => [...queryKeys.dealers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.dealers.details(), id] as const,
    notes: (id: string) => [...queryKeys.dealers.detail(id), 'notes'] as const,
    prices: (id: string) => [...queryKeys.dealers.detail(id), 'prices'] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    roles: () => [...queryKeys.users.all, 'roles'] as const,
    staffTypes: (filters: unknown = {}) =>
      [...queryKeys.users.all, 'staffTypes', filters] as const,
    staffType: (id: string) => [...queryKeys.users.all, 'staffType', id] as const,
    permissionCatalog: () => [...queryKeys.users.all, 'permissionCatalog'] as const,
    departments: (filters: unknown = {}) =>
      [...queryKeys.users.all, 'departments', filters] as const,
  },
  scheduling: {
    all: ['scheduling'] as const,
    availability: (filters: unknown = {}) =>
      [...queryKeys.scheduling.all, 'availability', filters] as const,
    orderSchedule: (productionOrderId: string) =>
      [...queryKeys.scheduling.all, 'order', productionOrderId] as const,
    ownDeliveries: (filters: unknown = {}) =>
      [...queryKeys.scheduling.all, 'own-deliveries', filters] as const,
    dashboard: () => [...queryKeys.scheduling.all, 'dashboard'] as const,
    atRisk: () => [...queryKeys.scheduling.all, 'at-risk'] as const,
    calendar: (filters: unknown = {}) =>
      [...queryKeys.scheduling.all, 'calendar', filters] as const,
    capacity: (filters: unknown = {}) =>
      [...queryKeys.scheduling.all, 'capacity', filters] as const,
    conflicts: () => [...queryKeys.scheduling.all, 'conflicts'] as const,
    productProfile: (productId: string) =>
      [...queryKeys.scheduling.all, 'product-profile', productId] as const,
    productStageEstimates: (productId: string) =>
      [...queryKeys.scheduling.all, 'product-stage-estimates', productId] as const,
  },
  workflow: {
    all: ['workflow'] as const,
    lists: () => [...queryKeys.workflow.all, 'list'] as const,
    details: () => [...queryKeys.workflow.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workflow.details(), id] as const,
    version: (workflowId: string, versionId: string) =>
      [...queryKeys.workflow.detail(workflowId), 'version', versionId] as const,
    stageLibrary: () => [...queryKeys.workflow.all, 'stage-library'] as const,
    orderGraph: (productionOrderId: string) =>
      [...queryKeys.workflow.all, 'order', productionOrderId] as const,
    productConfig: (productId: string) =>
      [...queryKeys.workflow.all, 'product-config', productId] as const,
    productionSetup: (productId: string) =>
      [...queryKeys.workflow.all, 'production-setup', productId] as const,
  },
} as const;

/** Mutation → invalidate helpers (use with QueryClient). */
export const invalidateKeys = {
  afterTaskMutation: (taskId?: string): readonly (readonly unknown[])[] => {
    const base = [
      queryKeys.tasks.lists(),
      queryKeys.tasks.all,
      queryKeys.reports.workerHome(),
    ] as const;
    if (taskId) {
      return [...base, queryKeys.tasks.detail(taskId)];
    }
    return [...base];
  },
  afterNotificationRead: () => [queryKeys.notifications.lists()],
  afterAuthChange: () => [queryKeys.auth.all],
  afterScheduleMutation: (productionOrderId?: string): readonly (readonly unknown[])[] => {
    const base = [
      queryKeys.scheduling.dashboard(),
      queryKeys.scheduling.atRisk(),
      queryKeys.scheduling.all,
      queryKeys.salesOrders.lists(),
      queryKeys.production.lists(),
      queryKeys.reports.dealerHome(),
      queryKeys.reports.adminHome(),
      queryKeys.reports.managementSummary(),
    ] as const;
    if (productionOrderId) {
      return [...base, queryKeys.scheduling.orderSchedule(productionOrderId)];
    }
    return [...base];
  },
};
