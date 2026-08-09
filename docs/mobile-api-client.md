# Mobile API client

**Date:** 2026-08-05  
**Code:** [`apps/mobile/src/api/`](../apps/mobile/src/api)  
**Architecture:** [mobile-architecture.md](./mobile-architecture.md) · [mobile-data-flow.md](./mobile-data-flow.md)

Native `fetch` client for Nest `/api/v1` with Bearer tokens. Prefer **[mobile-authentication.md](./mobile-authentication.md)** endpoints (`/auth/mobile/*`). No cookies. No API secrets in the bundle — only `EXPO_PUBLIC_API_BASE_URL`.

---

## Rules

| Rule | Detail |
|------|--------|
| Base | `getApiV1Url()` |
| Auth | `Authorization: Bearer` from SecureStore (`maher.access_token`) |
| Request ID | Always send `x-request-id`; errors prefer response echo |
| Timeout | 30s default (`AbortController`) |
| Offline | Pre-flight NetInfo; throw `OFFLINE` |
| 401 | Single-flight `POST /auth/refresh` → retry once → else `clearSession` |
| Retry | GET only for network / 5xx / 429 — **never** POST/PUT/PATCH/DELETE |
| Mutations (Query) | `retry: false` |

---

## Errors (`ApiError`)

Normalized codes: `OFFLINE`, `TIMEOUT`, `ABORTED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR` (400/422), `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, plus domain codes from Nest body when present.

Body shape: `{ error: { code, message, fieldErrors, requestId } }`.

---

## Domain modules

`authApi`, `catalogApi`, `tasksApi`, `invoicesApi`, `notificationsApi` — thin functions over `apiGet` / `apiPost`. Query keys in `queryKeys.ts`.

---

## TanStack Query

- Default `staleTime` 30s; mutation retry off
- Persist (AsyncStorage **2.2.x** for Expo SDK 54 / Expo Go): **catalog** + **tasks** list keys only (`shouldDehydrateQuery`)
- Persister uses `createSafeAsyncStorage` so native-module failures degrade to an empty cache (app still boots)
- Reports: `GET /reports/admin-home` via `reportsApi.getAdminHome()` (admin Home summary); `GET /reports/dealer-home` via `reportsApi.getDealerHome()` (dealer-owned Home; requires `customerId`); `GET /reports/worker-home` via `reportsApi.getWorkerHome()` (assignee-scoped Worker Home)
- Sales orders: `GET /sales-orders` via `salesOrdersApi.listSalesOrders()` (infinite list; dealers forced to own `customerId`; costs stripped); `GET /sales-orders/:id` via `salesOrdersApi.getSalesOrder()` (detail; dealers stripped of stages/workers/costs/end-customer; `assertCustomerOwns` → 403 cross-dealer). Document preview: `uploadsApi.resolveDocumentUrl()` → `GET /uploads/documents/:id/link`. Invoice PDF: `invoicesApi.openInvoicePdf()` → `GET /invoices/:id/pdf` (ownership-checked).
- Catalog browse: `catalogApi.listBrowseCategories()` + `catalogApi.listBrowseProducts()` → `GET /catalog/browse/categories` and `GET /catalog/browse/products`; `catalogApi.getBrowseProduct(id)` → `GET /catalog/browse/products/:id` (dealer `DealerPrice` scoped to `customerId`; costs/`basePrice` stripped for dealers)
- Requests (New Order steps 1–6): local draft + `createRequest` / `updateRequest` / `submitRequest`; step 5 uploads (`expo-image-picker`, camera, `expo-document-picker`) with progress/retry/cancel; step 6 review + estimated dealer price; AI keep-upload-on-failure; Orders hub merges RFQs via `listRequests`.
- Dealer RFQ edit: `GET/PATCH /requests/:id` with `editPolicy` (server timestamps); 409 `ORDER_LOCKED` / `FABRIC_LOCKED`. See [`docs/dealer-edit-rules.md`](./dealer-edit-rules.md).
- `onlineManager` ← NetInfo; `focusManager` ← AppState
- Global errors toast via `shouldToastApiError` (skips 401 / abort)

---

## Tokens

SecureStore only: `maher.access_token`, `maher.refresh_token`. Never log values. Never put tokens in Query cache.
