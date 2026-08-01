# Mobile implementation plan

Companion to [mobile-audit.md](./mobile-audit.md). One app: `apps/mobile` (`@maher/mobile`).

---

## Principles

1. Backend remains authority for authz, money, stock, workflows.
2. Navigation from **permissions**, not `role === 'ADMIN'`.
3. Web cookie auth unchanged; mobile gets optional token body.
4. Keep monorepo buildable after every phase.
5. AR / EN / HE with correct RTL.

---

## Target stack (`apps/mobile`)

| Concern | Choice |
|---------|--------|
| Runtime | Expo (SDK aligned with Expo 52/53 stable at install time) |
| Navigation | Expo Router (file-based) |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod (`@maher/validation` where compatible) |
| Tokens | Expo SecureStore |
| i18n | `@maher/i18n` messages + Expo Localization + RTL |
| Camera / docs / share / FS | Expo ImagePicker, DocumentPicker, FileSystem, Sharing |
| Scan | `expo-camera` barcode / Expo-compatible scanner |
| Push | Expo Notifications + backend device registry |
| Tests | Jest + RNTL; Maestro later for E2E |
| Build | EAS profiles (dev / preview / production) |

Package name: `@maher/mobile`.

Root scripts (additive):

- `pnpm dev:mobile` / `mobile:start` / `mobile:android` / `mobile:ios`
- `pnpm mobile:typecheck` / `mobile:test` / `mobile:lint`

---

## Backend changes (additive)

### Auth

```
POST /api/v1/auth/login
  body: { email?, phone?, password, client?: 'web' | 'mobile' }
  mobile → { user, accessToken, refreshToken } + cookies (unchanged)

POST /api/v1/auth/refresh
  mobile → same dual response when client=mobile or body refresh used

POST /api/v1/auth/logout
  accept refreshToken from body OR cookie
```

### Mobile module

```
GET  /api/v1/mobile/home          # permission-scoped summary cards
GET  /api/v1/mobile/search?q=     # permission-filtered entity search
POST /api/v1/mobile/devices       # register push token
DELETE /api/v1/mobile/devices/:id
```

### Prisma

`MobileDevice` model + optional `Session.clientType` (`web` | `mobile`).

---

## Permission → navigation mapping

Helpers in app: `can`, `canAny`, `canAll` over `AuthUser.permissions`.

| Tab / area | Gate examples |
|------------|---------------|
| Customer home / RFQ / quotes / orders / invoices / SOA | `request.*`, `quotation.*`, `sales-order.read`, `invoice.read`, `statement.read` + `customerId` |
| Sales CRM | `customer.*`, `quotation.*`, `sales-order.*` |
| Purchasing | `supplier.*`, `purchase-request.*`, `purchase-order.*` |
| Warehouse | `inventory.*` |
| Production worker | `production-task.*` |
| Supervisor | `production-order.*`, `production-task.update-any`, assign |
| Quality | `quality-inspection.*` |
| Delivery | `delivery.*` |
| Accounting | `invoice.*`, `payment.*`, `statement.read`, `report.financial.read` |
| Management | report.* + approvals permissions |
| Admin | `user.manage`, `role.manage`, `audit.read`, `settings.manage` |

Adaptive bottom tabs (max ~5): Home, primary Work area, Scan (if warehouse/worker), Notifications (`notification.read`), More.

Multi-role users: **union** of destinations, de-duplicated.

---

## App structure

```
apps/mobile/
  app/                    # Expo Router
    (auth)/login.tsx
    (app)/_layout.tsx     # permission tabs
    (app)/index.tsx       # home
    (app)/more.tsx
    ...
  src/
    api/                  # fetch client + feature modules
    auth/
    permissions/
    components/
    features/{customer,sales,warehouse,production,...}/
    theme/
    i18n/
    storage/
    providers/
    testing/
```

---

## Phase plan

| Phase | Deliverable | Exit criteria |
|-------|-------------|----------------|
| 0 | Baseline recorded | Audit notes existing failures |
| 1 | Audit + this plan | Docs merged |
| 2 | Expo app skeleton, theme, i18n, Query, env | `mobile:typecheck` passes; web untouched |
| 3 | Mobile login / SecureStore / refresh / logout | Demo users login on simulator |
| 4 | Adaptive shell, More menu, locale, notifications list | Permission-gated tabs |
| 5 | Customer RFQ/quotes/orders/invoices/SOA | Customer demo path works |
| 6 | Production tasks + quality | Worker + inspector paths |
| 7 | Warehouse scan + purchasing | Scan + stock movements |
| 8 | Sales CRM + delivery + finance | End-to-end sales→delivery slice |
| 9 | Management dashboards + admin users | Manager/admin paths |
| 10 | AI intake + device push registration | Human-approve still required |
| 11 | Offline banner, safe queues, a11y | Documented offline rules |
| 12 | Tests, EAS, security docs, release checklist | CI green including mobile typecheck |

---

## Offline policy

| Allowed queued (with idempotency) | Never queued offline |
|-----------------------------------|----------------------|
| Task progress notes / photos | Payments, voids |
| Non-final draft RFQ text | Inventory adjustments / transfers finalize |
| Mark notification read | Role changes, approvals, quote accept |

Show “pending sync” UI; server remains source of truth.

---

## Security decisions

- Access JWT in SecureStore; refresh rotating; logout revokes session.
- No secrets in `EXPO_PUBLIC_*`.
- Hide UI by permission; API still enforces.
- Threat model docs in Phase 12 (`mobile-security.md`, `mobile-threat-model.md`).

---

## Testing strategy

- Unit: permissions helpers, auth store, error mapping
- Component: login, menu, key forms
- API: mobile login/refresh/logout, device register, home
- E2E (Maestro): customer RFQ, worker task, warehouse scan, RTL locales
- Keep existing web/API tests green

---

## Documentation to add (by phase)

| Doc | Phase |
|-----|-------|
| mobile-audit.md | 1 |
| mobile-implementation-plan.md | 1 |
| mobile-architecture.md | 2 |
| mobile-authentication.md | 3 |
| mobile-permissions.md / mobile-navigation.md | 4 |
| mobile-local-development.md | 2–3 |
| mobile-security.md / threat-model | 12 |
| mobile-testing.md / deployment / release-checklist / known-limitations | 12 |

Update root `README.md` with mobile setup once Phase 2–3 land.

---

## Non-goals for early phases

- Replacing web portals
- Binary PDF generation (HTML viewer OK initially)
- Live WhatsApp/SMS providers (keep console/mock)
- Full offline ERP

---

## Immediate next actions

1. Create `apps/mobile` with Expo Router + TypeScript.
2. Wire workspace scripts + Turbo.
3. Implement auth `client: 'mobile'` token response + logout body refresh.
4. Ship login + session restore + permission home stub.
