export { getApiBaseUrl, getApiV1Url } from './config';
export {
  ApiError,
  apiErrorFromResponse,
  assertOnline,
  offlineError,
  timeoutError,
  abortedError,
  isApiError,
  normalizeStatusCode,
} from './errors';
export { createRequestId } from './requestId';
export { shouldRetryRequest, shouldRetryQuery, isMutatingMethod } from './retry';
export { getIsConnected } from './online';
export {
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  DEFAULT_TIMEOUT_MS,
} from './client';
export { refreshSession, resetRefreshFlight, type MobileAuthResponse } from './refresh';
export { queryKeys, invalidateKeys } from './queryKeys';
export {
  createQueryClient,
  createQueryPersister,
  createSafeAsyncStorage,
  shouldDehydrateQuery,
  stripPendingFromPersistedClient,
  shouldToastApiError,
  isTechnicalQueryError,
  sanitizeFeedbackCopy,
  toastMessageForError,
  QUERY_PERSIST_KEY,
} from './queryClient';
export { toSearchParams, defaultPageParams, type PageParams } from './pagination';
export {
  getNextPageParamFromMeta,
  getPreviousPageParamFromMeta,
  flattenPaginatedPages,
} from './infinite';

export * as authApi from './modules/auth';
export * as catalogApi from './modules/catalog';
export * as catalogAdminApi from './modules/catalogAdmin';
export * as tasksApi from './modules/tasks';
export * as invoicesApi from './modules/invoices';
export * as notificationsApi from './modules/notifications';
export * as reportsApi from './modules/reports';
export * as salesOrdersApi from './modules/sales-orders';
export * as uploadsApi from './modules/uploads';
export * as requestsApi from './modules/requests';
export * as aiIntakeApi from './modules/ai-intake';
export * as customersApi from './modules/customers';
export * as inventoryApi from './modules/inventory';
export * as productionApi from './modules/production';
export * as purchasingApi from './modules/purchasing';
export * as paymentsApi from './modules/payments';
export * as returnsApi from './modules/returns';
export * as searchApi from './modules/search';
export * as schedulingApi from './modules/scheduling';
