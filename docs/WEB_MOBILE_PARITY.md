# Web ↔ mobile feature parity

Living checklist for the three Next.js portals vs Expo mobile. Status: `missing` / `thin` / `parity`. UAT date is filled after a browser walkthrough.

Shared primitives: `@maher/ui` `CodeScanner`, `CameraCapture`, `QrDisplay`, `FilterPanel`, `PeriodCells`, `PillTabBar`, `InboxCellGrid`. Wired via `DeskToolsI18n` in admin-web, customer-portal, employee-portal.

Browser walk: `pnpm exec playwright test e2e/web-parity-walk.spec.ts` (uses installed Chrome `--guest`). Last full walk **2026-09-14** (ar / en / he). Golden fixture `SO-2026-00026` was already in the demo DB (no extra `demo:reset`). Wave 8 also submitted dealer RFQ `RFQ-2026-00077` (STD + named variant + modified width + custom line) as `nile` / `123`.

| Mobile | Web | Status | UAT |
|--------|-----|--------|-----|
| Auth login / MFA | All three `/login` | parity | 2026-09-14 |
| Biometrics / unlock | skipped (web session) | n/a | |
| Notifications inbox | `/notifications` all three | thin | 2026-09-14 |
| Dealer catalog list | customer-portal `/catalog` | parity | 2026-09-14 |
| Dealer PDP | `/catalog/[id]` | parity | 2026-09-14 |
| Customize variant | `/catalog/[id]/customize` | parity | 2026-09-14 |
| Custom item | `/order/custom` | parity | 2026-09-14 |
| Basket | `/basket` | parity | 2026-09-14 |
| New order / RFQ submit | `/orders/new` (basket-backed) | parity | 2026-09-14 |
| Quotes list/detail accept | `/quotations`, `/quotations/[id]` | parity | 2026-09-14 |
| Orders list/detail | `/orders`, `/orders/[id]` | close | 2026-09-14 |
| Invoice list + detail | `/invoices`, `/invoices/[id]` | parity | 2026-09-14 |
| Payments | `/payments` | parity | 2026-09-14 |
| Statement | `/statement` | parity | 2026-09-14 |
| Deliveries calendar / receipt | `/deliveries`, `/deliveries/[id]` | parity | 2026-09-14 |
| Returns list/create/detail | `/returns`, `/returns/[id]` | parity | 2026-09-14 |
| Profile places dock | `/profile` | parity | 2026-09-14 |
| Production plan desk | `/sales-orders/[id]/production-plan` (`/production-setup` redirects) | parity | 2026-09-14 |
| Production basket hub | `/production` `group=boards` | parity | 2026-09-14 |
| Kit QR | PO WIP `QrDisplay` | parity | 2026-09-14 |
| RFQ quoted + line desks | RFQ inbox + `/requests/.../lines`, `/quotations/.../lines` | parity | 2026-09-14 |
| Inventory IDENTIFY/VERIFY | `InventoryScanBar` + `CodeScanner` | parity | 2026-09-14 |
| Inventory item / receive / warehouse / fabric-bundle / semi / finished / low-stock | dedicated `/inventory/...` routes | parity | 2026-09-14 |
| Purchasing fabric jobs + PO barcode | `/purchasing/fabric`, `/purchasing/new` scan | parity | 2026-09-14 |
| Reports inventory / custom / product / variant / coverage issue | `/reports/...` | parity | 2026-09-14 |
| Delivery FIN scan | admin + employee `/deliveries/[id]` | parity | 2026-09-14 |
| Worker SO grouping / lane / take-in | `/orders/[salesOrderId]`, `/lane/[id]`, `/tasks/[id]/take-in` | parity | 2026-09-14 |
| QC / materials / problems | employee task detail | parity | 2026-09-14 |
| Delivery load | employee `/deliveries/[id]` | parity | 2026-09-14 |

Definition of done: every product row is `parity` and UAT dated after the Wave 8 browser walk (ar / en / he).

## Local env URLs (no secrets)

Match `.env.example`. Do not ship credentials.

| Variable | Local |
|----------|--------|
| `API_URL` / `NEXT_PUBLIC_API_URL` | `http://localhost:4000` |
| `ADMIN_WEB_URL` / `NEXT_PUBLIC_ADMIN_WEB_URL` | `http://localhost:3000` |
| `CUSTOMER_PORTAL_URL` / `NEXT_PUBLIC_CUSTOMER_PORTAL_URL` | `http://localhost:3001` |
| `EMPLOYEE_PORTAL_URL` / `NEXT_PUBLIC_EMPLOYEE_PORTAL_URL` | `http://localhost:3002` |
| `CORS_ORIGINS` | the three portal origins plus Metro `http://localhost:8081` |

Demo logins (password `123`): `admin`, `nile`, floor workers such as `carpenter`, delivery `driver`.

## Deploy gate

- `pnpm --filter @maher/ui build` (desk primitives live in `packages/ui` `dist`)
- `pnpm --filter @maher/admin-web typecheck` + `pnpm --filter @maher/customer-portal typecheck` + `pnpm --filter @maher/employee-portal typecheck` + `pnpm --filter @maher/mobile typecheck`
- `pnpm --filter @maher/admin-web --filter @maher/customer-portal --filter @maher/employee-portal build`
- `pnpm check:boundaries` (Next apps must not import `apps/mobile`)
- i18n leaf parity: `pnpm --filter @maher/mobile test -- --testPathPattern=catalog-parity.test`
- Hosting credentials stay with you; this repo only documents URL names.
