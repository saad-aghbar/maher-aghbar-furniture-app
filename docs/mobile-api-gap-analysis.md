# Mobile API gap analysis

**Date:** 2026-08-05  
**Goal:** One unified Expo client for admin / customer / employee personas against the existing NestJS API.  
**Companion:** [mobile-api-inventory.md](./mobile-api-inventory.md), [mobile-audit.md](./mobile-audit.md)

---

## Summary

Most domain workflows already exist as REST under `/api/v1`. Auth already supports a mobile client mode that returns access and refresh tokens in the JSON body. The largest gaps are **push delivery**, **durable password-reset**, **shared typed API client**, **offline/sync**, and a few **persona permission** mismatches for floor/warehouse features (e.g. cycle count requires `inventory.count`, which default `PRODUCTION_WORKER` does not have).

---

## Already usable for mobile

| Capability | Evidence | Notes |
|------------|----------|-------|
| Login / refresh with body tokens | `client: 'mobile'` on `POST /auth/login` and `/auth/refresh` | Also sets cookies (ignore on native) |
| Bearer access | `JwtAuthGuard` accepts `Authorization: Bearer` | Prefer over cookies |
| Session management | `/auth/me`, `/sessions`, logout / logout-all | Logout needs access JWT (+ refresh in body) |
| MFA | enable / confirm / disable | Login returns `MFA_REQUIRED` without code |
| Customer RFQ / quotes / orders | `/requests`, `/quotations`, `/sales-orders`, statements | Row-scoped via `customerId` |
| Employee tasks | `/tasks/*` lifecycle | start/pause/progress/complete |
| Quality | `/quality-inspections*` | Floor QC |
| Deliveries | list/get + location/status | Field GPS updates |
| Uploads | `POST /uploads` multipart + signed download | HEIC/JPEG/PNG/WebP/PDF/docx/xlsx ≤15MB |
| AI intake | `/ai-intake/*` | Handwritten / photo RFQ |
| In-app notifications | `GET /notifications`, mark read | Cap 50; poll |
| Device token register | `POST /notifications/device-token` | Stores only — no send |
| Catalog browse | `/catalog/browse/*` | Customer catalog |
| Health | `GET /health` | Public |
| Home routing helpers | `resolveMobileHomeHref` in `@maher/permissions` | Expo Router paths |
| i18n copy | `@maher/i18n` `mobile` namespace | ar/en/he |

---

## Missing or weak for mobile

### Notifications / devices

| Gap | Severity | Detail |
|-----|----------|--------|
| No push send path | **High** | `DevicePushToken` upserted; no FCM / APNs / Expo push provider in API or worker |
| No token unregister / delete | Medium | Logout cannot clean stale tokens |
| No notification preferences API | Medium | `docs/api.md` mentions `PATCH /notifications/preferences` — **not implemented** |
| No unread count endpoint | Low | Client must compute from list of 50 |
| No Hebrew body fields on `Notification` rows | Low | Templates have He; inbox model is Ar/En only |
| Employee portal has no notifications UI | Low (web) | API still works if mobile implements inbox |

### Auth / session

| Gap | Severity | Detail |
|-----|----------|--------|
| Password-reset tokens in-memory `Map` | **High** for prod | Lost on restart; not Redis; console-logs token; returns `devToken` outside production |
| Invite emails console-only | Medium | No real invite delivery |
| No dedicated mobile bootstrap | Low | Client must compose `GET /auth/me` + local `resolveMobileHomeHref` + feature flags |
| Refresh rotation | Medium (client care) | Old refresh revoked; mobile must persist new refresh every time |
| Logout requires valid access JWT | Low | Expired access + only refresh needs refresh-first then logout |

### Client / platform

| Gap | Severity | Detail |
|-----|----------|--------|
| No shared `@maher/api-client` | Medium | Three cookie-based Next clients; mobile needs Bearer + SecureStore client |
| No offline / sync / delta endpoints | Medium | All lists are online request/response |
| No multipart resumable / chunked upload | Medium | 15MB memory buffer; large videos unsupported |
| No deep-link / universal-link auth callback | Low | Password reset / invites are email-oriented |
| `@maher/ui` not RN-compatible | Expected | DOM React; reuse tokens/brand assets only |
| `apps/mobile` removed | Expected | Scaffold / restore separately; do not create in this audit |

### Domain / persona gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Cycle count vs worker role | Medium | Counts/scan need `inventory.count`; default `PRODUCTION_WORKER` grants task/QC/delivery/docs/notifications — **not** inventory.count |
| Warehouse persona | Medium | `resolveHomePersona` can return `warehouse`, but mobile href collapses to admin/customer/employee surfaces only |
| Admin surface is huge | Medium | Full ERP on phone needs deliberate IA; API is complete enough |
| Reports / CSV | Low | Browser-oriented; optional on mobile |
| Settings / roles / users | Low | Admin-only; fine via API if needed |

---

## File-upload limitations

| Constraint | Value |
|------------|-------|
| Endpoint | `POST /api/v1/uploads` field `file` |
| Alt | `POST /uploads/from-url` (server fetch ≤20s) |
| Max size | **15 MB** (`memoryStorage`) |
| MIME allowlist | jpeg, png, webp, **heic**, pdf, xlsx, docx |
| Permission | `document.manage` (CUSTOMER and PRODUCTION_WORKER include it) |
| Storage | Local disk or S3/MinIO when `STORAGE_PROVIDER=s3` |
| Download | `GET /uploads/download?token=` **Public** signed token |
| Default token TTL | **900s**; product/catalog images ~10 years |
| Link helper | `GET /uploads/documents/:id/link` (`document.read`) |

Mobile implications: use Expo ImagePicker / DocumentPicker / Camera; compress before upload; treat download tokens as short-lived except catalog images; do not assume presigned S3 PUT (docs that mention `/documents/presign` are stale).

---

## Persona → endpoint mapping

### Customer (`CUSTOMER` role)

**Needs:** login, me, requests CRUD/submit, quotations accept/reject/revision, sales-orders read, deliveries read, invoices/payments/statements, catalog browse, uploads, AI intake, notifications.

**Seed grants:** customer/catalog/quotation/sales-order/production-order/delivery/contract/invoice/payment/statement/document/request/ai-intake/notification permissions as in `ROLE_PERMISSIONS.CUSTOMER`.

**Gaps:** none blocking for a customer portal-equivalent app; push send still missing.

### Employee / floor (`PRODUCTION_WORKER`)

**Needs:** tasks lifecycle, quality inspections, deliveries location/status, document uploads (task photos), notifications.

**Seed grants:** production + quality + delivery + document + notification.

**Gaps:** inventory cycle-count / barcode scan **not** in default worker role; assign warehouse/`inventory.count` via custom role if mobile cycle-count ships. No employee notifications UI on web (API OK).

### Admin / office (`SYSTEM_ADMINISTRATOR` or custom roles)

**Needs:** broad CRM, quoting, production, inventory, purchasing, finance, reports, AI intake, settings.

**Seed grants:** all permission codes.

**Gaps:** product/IA only — API surface is largely present. Mobile should gate screens by `user.permissions`, not hard-code admin.

### Home hrefs (shared package)

| Surface | `resolveMobileHomeHref` |
|---------|-------------------------|
| Customer | `/(app)/(customer)/(tabs)` |
| Employee | `/(app)/(employee)/(tabs)` |
| Else (admin) | `/(app)/(admin)/(tabs)` |

---

## Docs vs code (stale claims)

| Doc claim | Reality |
|-----------|---------|
| Login email/phone + Argon2 | **Username** + **bcryptjs** |
| Presigned document upload APIs | **`/uploads` multipart** + from-url |
| `PATCH /notifications/preferences` | **Missing** |
| Native mobile in workspace | **`apps/mobile` deleted** (commit `c25ea5d`) |
| Worker queues drive notifications | Notifications send **inline** in API; worker queues mostly log stubs |

---

## Recommended API additions (future — not in this audit)

1. Push sender (Expo Push or FCM/APNs) consuming `DevicePushToken`
2. `DELETE /notifications/device-token` (and clear on logout)
3. Durable password-reset store (Redis) + email delivery
4. Optional `GET /auth/bootstrap` → user + permissions + home persona + unread count
5. Optional unread count / cursor pagination on notifications
6. Notification preferences if product requires opt-out per channel
7. Shared `@maher/api-client` with web (credentials) and mobile (Bearer) adapters

No production code changes are made in this documentation pass.
