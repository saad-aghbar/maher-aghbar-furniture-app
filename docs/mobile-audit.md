# Mobile application audit

**Date:** 2026-07-31  
**Repository:** `maher-aghbar-furniture-app`  
**Goal:** One unified Expo/React Native app for all ERP roles, permission-driven, against the existing NestJS API.

---

## 1. Existing workspace structure

| Path | Package | Role |
|------|---------|------|
| `apps/api` | `@maher/api` | NestJS REST API `:4000` |
| `apps/admin-web` | `@maher/admin-web` | Next.js admin `:3000` |
| `apps/customer-portal` | `@maher/customer-portal` | Next.js customer `:3001` |
| `apps/employee-portal` | `@maher/employee-portal` | Next.js employee `:3002` |
| `apps/worker` | `@maher/worker` | BullMQ background jobs |
| `packages/*` | types, validation, permissions, i18n, ui, config, database, logging, testing, tsconfig, eslint-config | Shared |

**No native mobile app exists today.** Docs (`milestones.md`) treated native as post-launch; employee “mobile” = responsive web.

Workspace already includes `apps/*` / `packages/*` — adding `apps/mobile` fits without changing `pnpm-workspace.yaml`.

---

## 2. Existing API modules (confirmed)

Global prefix: `/api/v1`. Modules under `apps/api/src/modules/`:

| Module | Key routes |
|--------|------------|
| auth | login, refresh, logout, logout-all, me, sessions, forgot/reset, invite, mfa enable/disable |
| health | `GET /health` (public) |
| users | users CRUD-ish, roles list |
| customers | CRM + contacts/addresses/communications |
| requests | RFQ create/list/submit |
| quotations | full workflow + revise + versions |
| sales-orders | list/get/confirm |
| contracts / returns | contracts + returns |
| production | production-orders |
| tasks | worker task lifecycle |
| quality | inspections |
| inventory | items, warehouses, receipts, issues, transfers, counts, barcode lookup |
| purchasing | PR/PO + goods receipts |
| suppliers | suppliers |
| deliveries | deliveries + status |
| invoices / payments / statements | finance + SOA HTML |
| reports | dashboard + domain reports + CSV |
| documents | uploads + signed download |
| ai-intake | jobs create/get/approve |
| notifications | inbox + templates |
| audit | audit list |

---

## 3–4. REST endpoints & authentication flow

See OpenAPI at `/api/docs` when API is running. Auth flow today:

1. `POST /auth/login` with `{ email | phone, password }`
2. Sets HTTP-only cookies `access_token` (15m) + `refresh_token` (30d)
3. JSON body returns `{ user }` **only** — no tokens in body
4. Web apps call APIs with `credentials: 'include'`
5. `POST /auth/refresh` accepts cookie **or** body `refreshToken`
6. Access JWT payload: `{ sub: userId, typ: 'access' }` — permissions loaded from DB each request
7. Refresh tokens are opaque, SHA-256 hashed in `Session`

---

## 5–7. Access / refresh / cookie assumptions for React Native

| Topic | Finding | Mobile impact |
|-------|---------|---------------|
| Access token | Cookie + Bearer accepted by `JwtAuthGuard` | Bearer already works **if** client has the JWT |
| Issuance | Login never returns JWT in JSON | **Blocking** — need mobile client mode |
| Refresh | Cookie or body | Body path usable |
| Logout | Cookie refresh only | Must accept body refresh for mobile |
| Cookie domain | Not set in code | Host-only; useless for native apps |
| SecureStore | N/A today | Required for access + refresh on device |

---

## 8–9. CORS & CSRF

- CORS: `CORS_ORIGINS` with `credentials: true` — browser-only concern. Native RN does not use CORS.
- Expo web preview must be added to `CORS_ORIGINS` if used.
- No CSRF double-submit implementation found; SameSite `lax` cookies protect web. Bearer mobile auth does not need CSRF cookies.

---

## 10. Roles & permissions

**15 roles** in `@maher/permissions` match the product brief (CUSTOMER … SYSTEM_ADMINISTRATOR).

**~70 permission codes** (e.g. `quotation.approve`, `inventory.receive`, `production-task.update-own`).

Mobile navigation **must** use `user.permissions` from `/auth/me`, not role-name switches. Role codes may only hint default home dashboard layout.

---

## 11. Existing customer / employee / admin web routes

Three separate Next apps with overlapping API usage. Mobile must **reimplement** UX against the same API — do not import Next pages or `@maher/ui` (DOM + Tailwind + `react-dom`).

---

## 12–14. Reusable packages

| Package | Reuse in RN |
|---------|-------------|
| `@maher/types` | Yes — `AuthUser`, locales, pagination, errors |
| `@maher/permissions` | Yes — catalog + `hasPermission` |
| `@maher/validation` | Yes — Zod (align `loginSchema` with API `email`/`phone`) |
| `@maher/i18n` | Yes — message JSON + `getDirection` |
| `@maher/ui` | **No** — rebuild RN design system from brand tokens |
| `@maher/config` / `@maher/database` | Server only |

Business logic (taxes, stock, workflow) stays on API.

---

## 15–18. Files, PDFs, AI, notifications

| Capability | Endpoint | Notes |
|------------|----------|-------|
| Upload | `POST /uploads` | Multipart; needs `document.manage` |
| Signed download | `GET /uploads/download?token=` | Public with token |
| Quote/Invoice/SOA “PDF” | `GET …/pdf` | Returns **HTML**, not binary PDF |
| AI intake | `POST/GET /ai-intake/jobs`, approve | Mock providers locally |
| Notifications | `GET /notifications`, mark read | In-app only; **no push/device model** |

---

## 19. Localization

Locales: `ar` (default), `en`, `he`. RTL for AR/HE via `LOCALE_DIRECTION`. Namespaces under `packages/i18n/src/messages/{locale}/`. Mobile will add `mobile` namespace keys as needed.

---

## 20. Missing endpoints required by mobile

| Need | Recommendation |
|------|----------------|
| Tokens in login/refresh response | `client: 'mobile'` → return `accessToken` + `refreshToken` without removing cookies |
| Logout with body refresh | Mirror refresh input |
| Device / push registration | `MobileDevice` model + `POST/DELETE /mobile/devices` |
| Permission-aware home | `GET /mobile/home` (aggregates by permission) |
| Menu metadata (optional) | `GET /mobile/menu` or pure client from permissions |
| Global search | `GET /mobile/search?q=` with permission filters |
| Customer ownership | Enforce on all customer-scoped reads (verify each controller) |
| True PDF (later) | Worker PDF generation; HTML WebView OK for v1 |

Do **not** duplicate existing domain CRUD endpoints.

---

## 21. Security risks

1. Modified client can send arbitrary bodies — trust API only.
2. Stolen device / SecureStore bypass — short access TTL + revoke sessions.
3. Push lock-screen leakage — generic titles by default.
4. Offline queue of financial/inventory mutations — **disallowed**.
5. IDOR on customer/order IDs — must verify ownership server-side.
6. Demo passwords in docs — warn for production.
7. MFA incomplete (enable without login challenge).
8. Password-reset tokens in memory Map — replace before production mobile forgot-password.

---

## 22. Performance risks

- Dashboard over-fetching full lists on device.
- Large image uploads without compression.
- Unvirtualized long lists.
- Refresh storms on 401.
- HTML “PDF” heavy for low-end phones.

---

## 23. Database migration requirements

Likely new models (only if missing — confirmed missing):

- `MobileDevice` (userId, platform, pushToken, deviceName, appVersion, lastSeenAt, revokedAt)
- Optional: notification preferences, idempotency keys for queued uploads

`Session` already exists — extend with `clientType` / `deviceId` optional FKs rather than duplicating sessions.

---

## 24. Environment configuration

Add to `.env.example` (public only for Expo):

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_ENVIRONMENT=local
```

Document LAN IP for physical devices (`localhost` on phone ≠ Mac). Android emulator often `10.0.2.2`; iOS simulator can use localhost.

---

## 25. Recommended implementation order

Follow phases 0–12 in the product brief. Immediate next:

1. Docs (this audit + plan) ✅  
2. Scaffold `apps/mobile` (Expo Router + TS)  
3. Backend mobile auth token mode + logout body refresh  
4. Auth + permission shell + adaptive tabs  
5. Customer + production worker vertical slices  
6. Warehouse scan, sales, finance, admin  
7. AI intake + push devices  
8. Offline-safe queues, tests, EAS  

---

## Baseline (Phase 0)

| Check | Result (2026-07-31) |
|-------|---------------------|
| Node | v25.8.0 (CI uses 20) |
| pnpm | 9.15.9 |
| API typecheck | Pass |
| API health | 200 (when `start:all`) |
| Native app | Absent |
| Playwright full suite | PARTIAL / deferred |
| Pre-existing limitations | See `docs/known-limitations.md` |

Web apps must remain untouched in behavior; only additive API changes for mobile.
