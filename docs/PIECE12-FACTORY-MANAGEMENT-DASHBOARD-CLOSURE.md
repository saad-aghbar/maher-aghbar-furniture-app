# PIECE 12 — FACTORY MANAGEMENT DASHBOARD CLOSURE

> Status: **COMPLETE** (API + Home + Reports + smoke). Handset **PENDING**. Browser **PENDING**.  
> **STOP** — Piece 13 was **NOT** started. Pieces 1–11 remain **FROZEN**.

---

## A. Pre-implementation audit

| Surface | Verdict |
|---|---|
| Mobile signature Home | USEFUL shell; deep-links were WRONG → rewritten on summary API |
| `GET /reports/admin-home` | USEFUL partial (kept for non-signature paths) |
| Home attention blend | Was CLIENT-ONLY / WRONG → server attention cards |
| COUNT=DATASET on Home | Was GAP → fixed via management-summary |
| RecentActivityList | ORPHAN → activity from summary |
| `/reports` not in sidebar | GAP → fixed |
| Charts/Excel BI | MISSING — non-goal (documented) |
| Dealer home | FROZEN — untouched |

---

## B. Summary API + trust contract

**Path:** `GET /api/v1/reports/management-summary`  
**Permission:** `report.sales.read` (shell). Finance/manufacturing require `report.financial.read` (else `null`).

Sections: `attention`, `today`, `factoryFlow`, `production`, `blocked`, `workers`, `late`, `outbound`, `materials`, `inventory`, `quality`, `exceptions`, `finance`, `manufacturing`, `activity`, `generatedAt`.

Each metric tile: `{ count, key, href, filter }`.

Helpers: `apps/api/src/modules/reports/management-summary.ts`  
Service: `ReportsService.managementSummary`  
Tests: `management-summary.spec.ts` (8 passing)

---

## C. Management Home (mobile + admin-web)

**Order:** Greeting → Search → Attention → Today → Factory flow → Production today (+ blocked) → Outbound → Materials → Inventory → Quality → Exceptions (collapse when zero) → Workers → Late → Money → Manufacturing cost → Activity → Reports link.

- Mobile: `AdminHomeSignatureHome` + `useManagementSummaryQuery`
- Admin-web: `ManagementDashboard` on `/dashboard` (404 → legacy dashboard)
- Pull-to-refresh; skeletons (no flash zeros); section Retry; healthy empties

---

## D–E. Attention / Today / Flow / Floor / Outbound / Money

- Attention: WHAT/WHY/ACTION + priority bands; 2–4 preview + View all
- Today / Flow / Production / Blocked / Workers / Late (OVERDUE; `atRiskLimited: true`)
- Outbound / Materials / Inventory / Quality / Exceptions from P6/P8–P11
- Money: receivable / overdue / accountCredit **never netted**
- Mfg: FINAL-only totals; incomplete ≠ 0; “Gross manufacturing difference” (never Net profit)
- Activity: curated domain events
- Search: existing `AdminHomeSearchRow` → `GET /search`

---

## F. Reports

- Sidebar nav: `/reports` (any `report.*`)
- Home entry: mobile Account/Reports link; admin Quick Actions → Reports
- Presets: Today / This week / This month / Custom (UTC); URL `from`/`to`
- Categories: Production (+ light stage performance), Sales, Cost, Purchasing, Inventory, Quality link, Delivery via existing reports
- Export: **CSV where present**; **PDF/Excel = documented gap** (`exportGapsNote`)

---

## G. Demo / tests / smoke

| Artifact | Notes |
|---|---|
| `docs/piece12-management-tile-map.md` | Maps Home tiles → P7–P11 records |
| `piece12-management-dashboard.ts` | Log-only; no new lifecycle rows |
| `management-summary.spec.ts` | Finance split, incomplete≠0, attention, perms |
| Smoke | `pnpm smoke:piece12-management-dashboard-uat` → **PASS 10/10** |

Regression: Piece 12 is **read-only** aggregation — no P1–11 lifecycle writes.

---

## H. Routes / visual / frontend checklist

### Manual routes (EXPECT)

| Account | Route | EXPECT | Seed driver |
|---|---|---|---|
| `admin` / `123` | Mobile Home / Web `/dashboard` | Attention→…→Activity hierarchy | P8–P11 world |
| admin | Tap quality wait tile | Quality list; COUNT matches tile | QI / READY_FOR_INSPECTION |
| admin | Tap finished waiting | Finished inventory scope | P10 FG lots |
| admin | Tap overdue finance | Invoices / statement | Dealer balances |
| admin | `/reports` + Today/Week/Month | Tables refresh on date | Existing report APIs |
| `carpenter` | management-summary | **403** | — |
| Dealer (`oasis`) | Dealer Home | **No** factory metrics | Frozen dealer home |

### Visual (§56) — PENDING (not observed on handset/browser this session)

Home hierarchy, Attention, Today, Flow, Production, Blocked, Outbound, Materials, Money, Activity, Reports, date filter, loading/empty/error, AR/HE RTL, small/large phone.

### §58 Scoreboard

| Row | Status |
|---|---|
| MANAGEMENT HOME | DONE |
| ATTENTION WHY | DONE |
| ATTENTION ACTION | DONE |
| TODAY | DONE |
| FACTORY FLOW | DONE |
| PRODUCTION TODAY | DONE |
| BLOCKED | DONE |
| WORKER CAPACITY | DONE (lightweight) |
| LATE/AT-RISK | DONE (OVERDUE; AT RISK LIMITED) |
| OUTBOUND | DONE |
| MATERIALS | DONE |
| INVENTORY | DONE |
| QUALITY | DONE |
| EXCEPTIONS | DONE |
| AMOUNT DUE | DONE |
| ACCOUNT CREDIT SEPARATE | DONE |
| MFG COST | DONE |
| GROSS MFG DIFF | DONE |
| ACTIVITY | DONE |
| COUNT=DATASET | DONE (smoke 5 pairs) |
| TAP=SAME DATASET | DONE (href+filter contract) |
| SERVER AGGREGATION | DONE |
| PERMISSIONS | DONE (worker 403; finance gated) |
| EN/AR/HE | DONE |
| REPORTS | DONE |
| DATE RANGE | DONE |
| LIVE UAT | DONE (smoke 10/10) |
| HANDSET | **PENDING** |
| BROWSER | **PENDING** |
| P1–P11 REGRESSION | DONE (read-only) |

### §59 Checkoffs (implemented; visual PENDING)

- [x] Management dashboard  
- [x] Attention  
- [x] Daily production  
- [x] Factory flow  
- [x] Blocked  
- [x] Workers  
- [x] Outbound  
- [x] Materials  
- [x] Inventory  
- [x] Quality  
- [x] Exceptions  
- [x] Finance  
- [x] Dealer balances  
- [x] Mfg cost  
- [x] Activity  
- [x] Reports  

### §60 Frontend quality checklist

| Surface | ROUTE | ACCOUNT | CHANGED | SEE | PRESS | HAPPEN | DEMO |
|---|---|---|---|---|---|---|---|
| Mobile Admin Home | `/(app)/(admin)/(tabs)/` home | admin | Signature desk on summary | Sections Attention→Reports | Tile / Attention Open | Same-filter list | P8–P11 map |
| Admin dashboard | `/dashboard` | admin | ManagementDashboard | Hierarchy + Money | Tile Link | Canonical list | same |
| Reports | `/reports` | admin | Presets + nav + export note | Date presets | Today/Week/Month | Tables reload | period APIs |
| Dealer Home | dealer tabs | oasis | **None** | Dealer metrics only | — | — | frozen |

---

## STOP

**Piece 13 was NOT started.**
