# Demo screen → API → seeded data coverage

**Checkpoint:** 3 of 3 executed 2026-08-16 (`pnpm demo:reset` + `demo:validate` + `demo:live-uat`). See [demo-factory-data-closure-report.md](demo-factory-data-closure-report.md).  
**Clock:** `DEMO_AS_OF=2026-08-16` Asia/Amman  
**Reset:** `pnpm demo:reset` (refuses non-loopback / non-`maher_erp` / `NODE_ENV=production`)  
**Validate:** `pnpm demo:validate`

Logins (password `123`): `admin`, `nile`, `oasis`, `balqis`, plus `prodmgr`, `scheduler`, `sales1`, `purchasing`, `warehouse`, `qclead`, `finance`, `cutter`, `carpenter`, `inspector`, `driver`, and the other dealer usernames (`cedar`, `zaatar`, `qasr`, `rawnaq`, `diwan`, `noor`, `jabal`).

## Direct-Prisma exceptions (historical seed)

Live Nest services are not bootstrapped from Prisma seed. Historical rows are written with the **same invariants**:

| Exception | What we did instead | Why it is still honest |
|-----------|---------------------|------------------------|
| `SalesOrdersService.confirm` | Create PO + compileWorkflow snapshot + tasks, then set `READY_FOR_PRODUCTION` or `WAITING_FOR_MATERIALS` | Never seeds vestigial `CONFIRMED` / `WAITING_FOR_PAYMENT` / `COMPLETED` as live statuses |
| `SchedulingService.generateForProductionOrder` + `approve` | Domain `backwardSchedule` / `forwardSchedule`, then `APPROVED` (or `PROPOSED` / `NEEDS_REVIEW` for stories) | Same planner as production; occupancy accumulated oldest-first |
| `TasksService.complete` | Status + actual timestamps from **allocation chronology**; `requiresPhotosOverride: false` on demo template nodes | Stage library still has `requiresPhotos: true`; demo templates opt out so we do not fake `TASK_PHOTO` binaries |
| `InventoryService.applyMovement` | Signed `inventory_transactions` + matching `inventory_balances` | Opening, GRN, and `PRODUCTION_ISSUE` when material prep completed |
| QC submit / rework / delivery / payment | Prisma rows matching status machines | Failed QC is never delivered without completed rework + later pass; returns only on `DELIVERED` SOs |

## Screen matrix

| Screen | App | API (representative) | Seeded records | Expected UI |
|--------|-----|----------------------|----------------|-------------|
| Admin dashboard | Admin web | `GET /reports/dashboard` | ~65 SOs, RFQs, invoices, returns | Counts recomputable from tables (validator 22) |
| Admin home | Mobile | `GET /reports/admin-home` | Same + at-risk schedules | May-be-late chips = `classifyScheduleRisk` on latest active schedules |
| Dealer home | Portal / mobile | dealer RFQ/SO/invoice queries | 10 dealers with addresses | Nile/Oasis/Balqis see own orders only |
| Worker home | Worker web / mobile | `GET /reports/worker-home` | Tasks assigned from planner | Floor workers have `WorkerSkill` |
| Requests | All sales surfaces | `/requests` | RFQ → quote → SO; plus open Nile WhatsApp RFQ | Specs include fabric/wood/qty |
| Quotations | Admin / dealer | `/quotations` | Accepted quotes for confirmed SOs; SENT for drafts | VAT 16% ILS |
| Sales orders | Admin / dealer | `/sales-orders` | Mix: delivered, ready, in production, waiting materials, draft | No fake `CONFIRMED` as current live status |
| Production / tasks | Admin / worker / mobile | `/production`, `/tasks` | Snapshots + HARD edges + stage chronology | Downstream never completes before predecessors |
| Production setup | Admin product | product workflow + stage I/O | `SOF-3S-STD` frame output **שלדת ספה סטנדרטית** | Playwright retargeted off `UAT-SOFA-A` |
| Scheduling | Admin web / mobile | `/scheduling` | Approved plans + 1–3 legitimate at-risk + proposed | Overtime = `EXTRA_SHIFT` 22 Jul / 5 Aug / 12 Aug; shutdown 25 Jun |
| Dealer delivery calendar | Mobile account / portal | `/scheduling/own-deliveries` | Committed/suggested dates on schedules | Not internal carpentry dates |
| Inventory | Admin / mobile | `/inventory` | ~40 raw SKUs, opening txs, GRNs, issues | Balance = sum of txs |
| Purchasing | Admin / mobile | `/purchasing` | 8 suppliers, 22 POs (received / partial / sent) | Italian velvet PO inbound for Cedar recliner |
| Invoices / statement | Admin / dealer | `/invoices`, `/statement` | Delivered SOs invoiced; paid / partial / outstanding | Payment ≤ outstanding |
| Returns | Admin / dealer | `/returns` | 3 returns on delivered orders only | Qty ≤ delivered |
| Catalog | All | `/products` | 22 products, 5 workflows, `materials[]` BOMs | Reservation-readable SKUs |
| Employees / skills | Admin | `/users` | 32 staff+workers with skills | Scheduler will not fail closed |
| Workflow templates | Admin | `/production/workflow` | `STANDARD_FURNITURE`, `PAINTED_WOOD`, `ARMCHAIR_PATH`, `CUSTOM_SECTIONAL`, `SIMPLE_OTTOMAN` | No `UAT_PARALLEL` |
| QC | Production task / quality detail | `/quality` | Pass on delivered/ready; current fail+rework; historical recovered | No dedicated mobile QC list |
| Notifications | All | `/notifications` | Modest inbox for admin + one worker | Not thousands |
| AI intake | Admin | `/ai-intake` | One **reviewed** WhatsApp extraction (`provider: demo-reviewed`) | Not `seed-stub` copy |

## Flagship stories (search `projectName`)

| Id | Dealer | What to open |
|----|--------|----------------|
| Abdoun lounge set | nile | Delivered, paid, full history |
| Sweifieh sectional | oasis | In carpentry / foam |
| Abdali hotel banquettes | balqis | Ready for delivery |
| Cedar Italian velvet recliner | cedar | Waiting materials / at-risk |
| Diwan wingback foam gate | diwan | WIP gate at-risk |
| Jabal contract dining | jabal | Committed date vs plan (late) |
| Oasis club armchair QC | oasis | Current QC fail + rework |
| Nile loveseat recovered | nile | Historical rework then delivered |
| Zaatar ottoman scuff | zaatar | Delivered + approved return |
| Qasr suite dining | qasr | Schedule awaiting approval |
| Noor club chair hold | noor | Draft SO |
| Rawnaq dining six | rawnaq | Ready, not started |

## Commands that are **not** the father dataset

- `pnpm db:seed` — empty launch accounts only  
- `pnpm db:seed:demo` — old 14-day world (QA leftover; do not present)  
- `pnpm db:seed:factory-uat` — `UAT-SOFA-*` fixtures for isolated tests only  
