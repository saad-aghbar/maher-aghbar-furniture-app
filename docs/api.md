# REST API Reference (Phase 0)

NestJS REST API for **Maher Al-Aghbar & Sons Furniture ERP**. OpenAPI 3.1 spec generated at `/api/docs` (non-production) and exported to `apps/api/openapi.json` in CI.

**Base URL:** `/api/v1`  
**Auth:** HTTP-only cookies (`access_token`, `refresh_token`) or `Authorization: Bearer` for service accounts.

---

## Cross-cutting conventions

### Request headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Accept-Language` | No | `ar`, `en`, `he` — affects error messages and PDF locale |
| `X-Request-Id` | No | Correlation; echoed in response |
| `Idempotency-Key` | POST mutations | Prevents duplicate creates (24h window) |

### Pagination

List endpoints accept:

```
?page=1&pageSize=25&sort=-createdAt&filter[status]=SENT
```

Response envelope:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 142,
    "totalPages": 6
  }
}
```

- Default `pageSize`: 25; max: 100.
- Cursor pagination (`cursor`, `limit`) on audit log and high-volume transaction feeds.

### Error shape

All errors follow RFC 7807–inspired structure:

```json
{
  "statusCode": 422,
  "error": "VALIDATION_ERROR",
  "message": "One or more fields are invalid.",
  "requestId": "01J...",
  "details": [
    { "field": "lineItems[0].quantity", "code": "MIN", "message": "Must be at least 1" }
  ]
}
```

| HTTP | `error` code | When |
|------|--------------|------|
| 400 | `BAD_REQUEST` | Malformed JSON or params |
| 401 | `UNAUTHORIZED` | Missing/expired token |
| 403 | `FORBIDDEN` | Permission denied |
| 404 | `NOT_FOUND` | Entity missing or no access |
| 409 | `CONFLICT` | State transition invalid; duplicate; insufficient stock |
| 422 | `VALIDATION_ERROR` | DTO validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Soft delete

`DELETE` sets `archivedAt`. Archived records excluded from default lists; `?includeArchived=true` for admins with permission.

---

## Endpoint groups

### `/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Email/phone + password → cookies |
| POST | `/auth/logout` | Revoke session, clear cookies |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/forgot-password` | Send reset link |
| POST | `/auth/reset-password` | Complete reset |
| POST | `/auth/invitations/accept` | Staff invitation acceptance |
| GET | `/auth/me` | Current user, roles, permissions |
| POST | `/auth/mfa/setup` | TOTP enrollment (staff) |
| POST | `/auth/mfa/verify` | MFA challenge |

### `/users` · `/roles` · `/invitations`

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/users` | `user.manage` |
| GET/PATCH | `/users/:id` | `user.manage` |
| GET | `/roles` | `role.manage` |
| PATCH | `/roles/:id/permissions` | `role.manage` |
| POST | `/invitations` | `user.manage` |

### `/customers`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/customers` | List/create customers |
| GET/PATCH/DELETE | `/customers/:id` | CRUD + archive |
| GET/POST | `/customers/:id/contacts` | Contact management |
| GET/POST | `/customers/:id/addresses` | Addresses |
| GET/POST | `/customers/:id/activities` | Communication log |
| GET | `/customers/:id/timeline` | Aggregated activity feed |

### `/rfqs`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/rfqs` | RFQ list/create |
| GET/PATCH | `/rfqs/:id` | Detail/update draft |
| POST | `/rfqs/:id/submit` | Submit for quoting |
| POST | `/rfqs/:id/attachments` | Link documents |

### `/quotations`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/quotations` | List/create draft |
| GET/PATCH | `/quotations/:id` | Detail/update draft |
| POST | `/quotations/:id/submit` | → PendingApproval |
| POST | `/quotations/:id/approve` | Internal approval |
| POST | `/quotations/:id/send` | Send to customer |
| POST | `/quotations/:id/accept` | Customer acceptance |
| POST | `/quotations/:id/reject` | Customer rejection |
| POST | `/quotations/:id/revise` | New version |
| GET | `/quotations/:id/pdf` | Generate/download PDF |
| GET | `/contracts/:id/pdf` | Contract PDF |
| GET | `/purchasing/orders/:id/pdf` | Purchase order PDF |
| GET | `/suppliers/:id/statement/pdf` | Supplier statement PDF |

### `/sales-orders`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales-orders` | List |
| GET | `/sales-orders/:id` | Detail with lines, production, delivery |
| POST | `/sales-orders/:id/confirm` | Confirm order |
| POST | `/sales-orders/:id/cancel` | Cancel (state-gated) |
| POST | `/sales-orders/:id/deposit` | Record deposit |
| GET | `/sales-orders/:id` | Sales order detail |
| GET | `/contracts/:id/pdf` | Contract PDF (see pdf section) |

### `/production-orders`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/production-orders` | Board/list; create from SO |
| GET/PATCH | `/production-orders/:id` | Detail/update priority, due date |
| GET | `/production-orders/:id/stages` | Stage instances |
| POST | `/production-orders/:id/hold` | Put on hold |
| POST | `/production-orders/:id/resume` | Clear hold |

### `/tasks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | Filter by assignee, stage, status |
| GET | `/tasks/:id` | Task detail |
| POST | `/tasks/:id/assign` | Assign/reassign worker |
| POST | `/tasks/:id/start` | Start work |
| POST | `/tasks/:id/pause` | Pause |
| POST | `/tasks/:id/block` | Report blocker |
| POST | `/tasks/:id/complete` | Complete with optional photos |
| POST | `/tasks/:id/photos` | Attach progress images |

### `/quality-inspections`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/quality-inspections` | List/create |
| GET/PATCH | `/quality-inspections/:id` | Checklist, defects |
| POST | `/quality-inspections/:id/complete` | Pass/fail/rework |

### `/inventory`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/inventory/items` | Item master |
| POST | `/inventory/items` | Create SKU |
| GET | `/inventory/balances` | By warehouse/item |
| GET | `/inventory/transactions` | Ledger |
| POST | `/inventory/receive` | Goods receipt |
| POST | `/inventory/issue` | Issue to production/SO |
| POST | `/inventory/transfer` | Inter-warehouse |
| POST | `/inventory/adjust` | Adjustment (permission-gated) |
| POST | `/inventory/count` | Cycle count submission |
| GET | `/inventory/items/:id/barcode` | Barcode/QR payload |

### `/warehouses`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/warehouses` | Warehouse CRUD |

### `/suppliers` · `/purchase-orders`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/suppliers` | Supplier master |
| GET/POST | `/purchase-requests` | Internal PRs |
| GET/POST | `/purchase-orders` | PO CRUD |
| POST | `/purchase-orders/:id/approve` | Approve PO |
| POST | `/purchase-orders/:id/receive` | Goods receipt → inventory |

### `/deliveries`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/deliveries` | Schedule deliveries |
| POST | `/deliveries/:id/dispatch` | Out for delivery |
| POST | `/deliveries/:id/complete` | POD (signature/photos) |

### `/invoices` · `/payments`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/invoices` | List/create from SO |
| POST | `/invoices/:id/issue` | Issue invoice |
| GET | `/invoices/:id/pdf` | Invoice PDF |
| POST | `/payments` | Record payment |
| GET | `/statements/:customerId` | Statement of account JSON |
| GET | `/statements/:customerId/pdf` | Statement of account PDF |

### `/documents`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/documents/upload` | Presigned upload init |
| POST | `/documents/:id/complete` | Finalize upload |
| GET | `/documents/:id/url` | Signed download URL (short TTL) |
| GET | `/documents` | List by entity link |

### `/ai-intake`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai-intake/jobs` | Upload + enqueue extraction |
| GET | `/ai-intake/jobs` | List jobs |
| GET | `/ai-intake/jobs/:id` | Job detail + proposed payload |
| POST | `/ai-intake/jobs/:id/approve` | Human approve → draft entity |
| POST | `/ai-intake/jobs/:id/reject` | Reject with reason |

### `/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | In-app inbox |
| POST | `/notifications/:id/read` | Mark read |
| PATCH | `/notifications/preferences` | Channel preferences |

### `/reports`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/sales` | Sales pipeline, conversion |
| GET | `/reports/production` | WIP, throughput, blockers |
| GET | `/reports/order-profit` | Per-order profit |
| GET | `/reports/productivity` | Worker hours / score |
| GET | `/reports/ap-ledger` | Supplier AP aging |
| GET | `/reports/period-pl` | Period P&L proxy |
| GET | `/reports/cash-flow` | Customer receipts vs supplier payments |
| GET | `/reports/inventory` | Stock levels, reorder |
| GET | `/reports/purchasing` | PO status, supplier spend |
| GET | `/reports/financial` | AR aging, revenue |
| GET | `/reports/export/*.csv` | CSV downloads (sales, profit, AP, P&L, cash, AR) |

### `/geo`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/geo/reverse` | Reverse geocode (Nominatim or Google) |
| GET | `/geo/search` | Forward geocode search |

### `/audit`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit/events` | Cursor-paginated audit log |

### `/search`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Global search (permission-filtered) |

### `/settings`

| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/settings` | Company, tax, numbering, integrations |

### `/health`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/health/ready` | DB + Redis + storage |

---

## Customer portal scope

Portal routes mirror subset of above under same paths; authorization restricts to `customerId` linked to authenticated user:

- `GET /quotations` (own, Sent+)
- `POST /quotations/:id/accept|reject`
- `GET /sales-orders`, `/deliveries`, `/invoices`, `/payments`
- `POST /rfqs`, `/documents/upload`, `/ai-intake/jobs`

## Employee portal scope

- `GET /tasks` (own assignments)
- Task action endpoints
- `GET /production-orders/:id` (limited fields)
- `POST /quality-inspections`, `/deliveries/:id/complete`

## Rate limits (default)

| Scope | Limit |
|-------|-------|
| Login | 10/min per IP |
| Authenticated API | 300/min per user |
| Upload init | 30/min per user |
| AI intake | 20/hour per user |

## Versioning

Breaking changes increment `/api/v2`. Deprecation headers (`Sunset`, `Link`) announced 90 days before removal.
