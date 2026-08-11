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
    dealerHome: () => [...queryKeys.reports.all, 'dealer-home'] as const,
    workerHome: () => [...queryKeys.reports.all, 'worker-home'] as const,
  },
  salesOrders: {
    all: ['sales-orders'] as const,
    lists: () => [...queryKeys.salesOrders.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.salesOrders.lists(), filters] as const,
    details: () => [...queryKeys.salesOrders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.salesOrders.details(), id] as const,
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
  },
  production: {
    all: ['production'] as const,
    summary: () => [...queryKeys.production.all, 'summary'] as const,
    lists: () => [...queryKeys.production.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.production.lists(), filters] as const,
    details: () => [...queryKeys.production.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.production.details(), id] as const,
    workers: (q?: string) => [...queryKeys.production.all, 'workers', q ?? ''] as const,
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
  },
  payments: {
    all: ['payments'] as const,
    lists: () => [...queryKeys.payments.all, 'list'] as const,
    list: (filters: unknown = {}) => [...queryKeys.payments.lists(), filters] as const,
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
    departments: (filters: unknown = {}) =>
      [...queryKeys.users.all, 'departments', filters] as const,
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
};
