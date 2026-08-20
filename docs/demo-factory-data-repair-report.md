# Demo factory data — presentation repair report

**Executed:** 2026-08-16  
**Clock:** `DEMO_AS_OF=2026-08-16` 14:00 Asia/Amman (`2026-08-16T11:00:00.000Z`)  
**Target:** local DEV Postgres `127.0.0.1` / **`maher_erp`** / `NODE_ENV=development`  
**Pipeline:** `pnpm demo:reset` only (not `db:seed:demo`, not factory-UAT).

Pre-repair fail: [father-demo-presentation-readiness.md](father-demo-presentation-readiness.md) (now the post-repair PASS). Walkthrough numbers: [father-demo-walkthrough.md](father-demo-walkthrough.md).

## Safety

| Check | Result |
|-------|--------|
| Preflight | `assertDemoEnvironment` — `NODE_ENV=development host=127.0.0.1 database=maher_erp` |
| Backup | Kept `backups/maher_erp-pre-demo-20260816.dump`. New `backups/maher_erp-pre-repair-20260816.dump` (`pg_dump -Fc`) before mutation |
| Mutation style | Deterministic seed + two presentation-mapping fixes. No one-off SQL |
| Idempotency | `pnpm demo:reset` reproduced 65 SO / 63 PO / 3 may-be-late / walkthrough numbers unchanged |

## What was wrong (and the layer that was wrong)

| Blocker | Root cause | Fix layer |
|---------|------------|-----------|
| Synthetic project names | Extras generator set `projectName` to `` `${dealer} ${sku} ${kind}` `` | Seed: `stories.ts` + `extra-project-names.ts` |
| TEST / TEST-2 / SA warehouses | Wipe only dropped RAW-2/SEMI-2/FIN-2; leftover warehouses survived truncate | Seed: `wipe.ts` + foundation deactivate net |
| Dashboard delayed 23 vs scheduling 3 | Dashboard counted incomplete SOs with `requiredDeliveryDate < now`. Classifier is LATE \| AT_RISK \| BLOCKED | Mapping: `reports.service.ts` uses `classifyScheduleRisk`. Seed also bumps live extras’ required dates so the naive date metric would no longer inflate |
| Hero `SO-2026-00003` | Floor spotlight picked soonest overdue SO, not may-be-late | Mapping: spotlight prefers canonical LATE (Jabal) |
| Admin `demo:jabal-dining-late` | Seed wrote `reason: demo:${story.id}`; admin rendered `schedule.reason` raw | Seed: `reason: null`. Mapping: `publicScheduleReason` + admin `reasonLabel` i18n |
| Future DELIVERED / past PLANNED | Occupancy packed historical extras past as-of; Abdali lead 40d from orderDay 18 landed 13 Aug | Seed: `presentationRequiredDelivery` + historical occupancy wave + delivery `atOrBefore(asOf)` |
| 91 stale open allocations | Live extras planned backward from past required dates with `now: createdAt` | Seed: remaining work forward from as-of (except Jabal); completed stages packed before as-of |
| Abdali story 3 | Planned delivery 13 Aug | Same delivery chronology; now **19 Aug** PLANNED |
| Diwan foam in progress | `completeThrough: CARPENTRY` treated next stage as IN_PROGRESS | Seed: `at_risk_wip` is gated (`READY` / `NOT_STARTED`) |
| Cedar admin copy | Same `demo:` reason leak | Mapping + null seed reason; materials story unchanged |

## Records / sources touched (seed, not live patches)

- **53 extra sales orders** — project names replaced with unique Amman/Levant site names. Flagship 12 names unchanged. `orderDay` / dealer / SKU / qty unchanged so **SO/PO/DLV/INV numbers stayed frozen**.
- **Leftover warehouses** `TEST`, `TEST-2`, `SA`, `RAW-2`, `SEMI-2`, `FIN-2` — deleted after operational truncate (no balances left); never delete RAW/SEMI/FIN.
- **Required delivery dates** for live incomplete extras and ready-for-delivery stories whose naive date was ≤ as-of — bumped into the current/future window. **Jabal** (`at_risk_committed`) kept its past required/committed dates.
- **Allocations** — two-wave occupancy: historical delivered first, Jabal second, other live remaining from as-of. Writes still happen in story sort so document numbers do not shuffle.
- **Diwan** FOAM `READY`, UPHOLSTERY `NOT_STARTED` (was FOAM `IN_PROGRESS`).
- **Schedule.reason** — no longer `demo:<id>`. Classification still uses `unschedulableReason` / `materialRisk` / committed dates.

## Mapping bugs (smallest correct layer)

- `ReportsService.dashboard().delayedOrders` = count of canonical may-be-late schedules (same `classifyScheduleRisk` as Scheduling).
- `adminHome` floor spotlight = may-be-late sales order, preferring `LATE`.
- `serializeAtRiskItem.reason` strips `demo:` / `async:` / `debug:` / `seed:`.
- Admin scheduling cards use `reasonLabel` and translate `mobile.adminScheduling.*`.

## Validators added (`demo:validate`)

Fails on: active TEST/UAT/SAMPLE warehouses; synthetic projectName patterns; `demo:` schedule reasons; DELIVERED after as-of; PLANNED before as-of; ordinary stale open allocations (Jabal excepted); may-be-late ≠ {Cedar, Diwan, Jabal}; walkthrough number/status mismatches; Diwan foam IN_PROGRESS; incomplete SOs with past required date except Jabal.

## Preserved on purpose

Abdoun paid history, Cedar velvet 0 + PORD-2026-00019 SENT, Oasis QC ON_HOLD + RW-2026-00002, Qasr PROPOSED, Noor DRAFT, Rawnaq 0 started, invoice 471.053, dealer isolation, Arabic dealer/product names, 12 walkthrough numbers.

## Live API (post-reset)

| Check | Observed |
|-------|----------|
| `GET /reports/dashboard` delayedOrders | 3 |
| `GET /reports/admin-home` hero | SO-2026-00023 LATE, peerCount 3 |
| `GET /scheduling/dashboard` atRisk | 3 |
| `GET /scheduling/at-risk` | PO-22 LATE, PO-50 WIP_NOT_READY, PO-55 MATERIAL_NOT_READY; `reason` null |
| `GET /inventory/warehouses` | RAW, SEMI, FIN |
| `GET /deliveries` | Abdali DLV-2026-00010 PLANNED 2026-08-19; 0 future DELIVERED; 0 past PLANNED |
| Carpenter `worker-home` | Carpentry IN_PROGRESS from 2026-08-16T11:00 on SO-2026-00010 |
| Nile vs Oasis orders | Nile sees SO-2026-00001; Oasis does not |
