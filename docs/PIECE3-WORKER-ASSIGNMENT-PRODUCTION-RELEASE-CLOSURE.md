# PIECE 3 — WORKER ASSIGNMENT & PRODUCTION RELEASE CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING HANDSET**. **STOP** — Piece 4 not started.

## 0. Audit (WHAT EXISTED / CONFUSING / REUSED / MUST CHANGE)

### WHAT EXISTED

| Area | Behavior |
|---|---|
| Piece 2 `release` | Creates POs (`PLANNED`), workflow snapshot, non-LOGISTICS `ProductionTask`s (unassigned), `tryReserve`; returns `schedulingSkipped: true`, `workerAssignmentRequired: true` |
| Readiness | `production-readiness.ts`: buckets `needs_setup` / `ready_to_start` / `on_floor` / `blocked` / …; `canStart` hard-requires assignments |
| Assign | `POST /tasks/:id/assign` (`production-order.assign`); skill gate; optional `plannedCompletion` only |
| Start | `POST /production-orders/:id/start` (`production-order.update`) → PO `IN_PROGRESS`, SO `IN_PRODUCTION` |
| Mobile | Overview board; plan split on `/production/[id]/setup`; worker Home/Tasks `mine` |

### WHAT WAS CONFUSING

- “Needs setup” vs commercial Production Setup
- Piece 2 “release” sounded like floor start
- Schedule generate could silently assign
- Plan UX split across setup vs detail

### WHAT IS REUSED

- Models: `ProductionOrder`, `ProductionTask` (`plannedStart`/`plannedCompletion`), `WorkerSkill`
- APIs: assign, start, assignable-workers, readiness
- Permissions: `production-order.assign|update|read`, `schedule.override` (conflict only) — **no `production.plan.*`**
- Maher boards / sheets / `JourneyStickyDock`

### WHAT CHANGED (Piece 3)

- Assign: `plannedStart` + conflict block/override + dependency dates + reassign pre-start only
- Readiness: `datesReady` / `workersReady` / `setupReady`; hard-gate `MISSING_DATE`
- Board labels: Needs planning / Ready for factory / In production / Attention
- Mobile: one-screen Production Plan on detail; sticky Release to factory; setup route redirects
- Recommendations with human reasons on assignable-workers
- Post-release SO copy: Production plan required / Assign workers & dates
- Demo P3-A–H; tests; this closure

### Freeze confirmation

| System | Frozen |
|---|---|
| Piece 1 / Piece 2 structure | YES (copy only for P2) |
| `@maher/workflow-domain` / workflow editor | YES |
| SEMI/FIN / material usage / QC / terminal | YES |
| Dealer receipt / purchasing / invoices | YES |
| Scheduling hub (non-Production UX) | KEEP for specialists/tests |

---

## A. Permissions mapping

| Suggested (not added) | Actual |
|---|---|
| `production.plan.view` | `production-order.read` |
| `production.plan.edit` | `production-order.assign` + `production-order.update` |
| `production.plan.release` | `production-order.update` (`POST .../start`) |
| conflict override | `schedule.override` + `overrideConflict: true` |

**Who can plan**
- `PRODUCTION_MANAGEMENT` staff pack: assign, update, setup, **and** `schedule.override` (conflict override on assign)
- `SYSTEM_ADMIN`: full catalog
- `CUSTOMER` / dealers: `production-order.read` only — cannot assign, start, or plan (UI `showPlan` requires assign|update)
- `PRODUCTION_WORKER`: task own/read only — cannot plan
- Mobile plan UI gated: `canSetup = assign|update`; Release dock requires `production-order.update`

---

## B. Board label map

| API `boardBucket` | UI label |
|---|---|
| `needs_setup` | Needs planning |
| `ready_to_start` | Ready for factory |
| `on_floor` | In production |
| `blocked` | Attention |

---

## C. Release to factory

Equals existing `ProductionService.start` + confirm sheet (workers / dates / materials lines). Does **not** consume materials or create SEMI/FIN alone. Sticky `JourneyStickyDock` + tab-bar clearance.

---

## D. Route proof (mounted mobile)

| Feature | Location | ROUTE → SCREEN → COMPONENT → API |
|---|---|---|
| Production board | Admin → Production | `/(admin)/(tabs)/production` → `ProductionOverviewScreen` → `ProductionOrderCard` → `GET /production-orders?bucket=` + summary |
| Needs planning | Board chip | bucket `needs_setup` → list → card → `GET /production-orders/:id` |
| Production plan | Open PO | `/(admin)/production/[id]` → `ProductionDetailScreen` → readiness + stage assign → `GET /production-orders/:id` |
| Assign worker+dates | Tap stage | `AssignWorkerSheet` → windowed `GET .../assignable-workers?taskId&plannedStart&plannedCompletion` → `POST /tasks/:id/assign` |
| Release to factory | Sticky dock | confirm → `POST /production-orders/:id/start` |
| Setup deep link | Legacy | `/(admin)/production/[id]/setup` → **Redirect** → detail (`ProductionOrderSetupScreen` removed) |
| SO plan CTA | SO detail | `planRequired` banner → `/(admin)/production/{poId}` |
| Worker tasks | Worker Home/Tasks | `mine` / forceMine → `GET /tasks` → `TaskDetailScreen` (Raw + SEMI sections) |

---

## E. Manual navigation (P3-A–H)

| ID | ROLE | ACCOUNT | APP | NAVIGATION |
|---|---|---|---|---|
| P3-A | Admin | `admin` / `123` | Mobile | Production → Needs planning → `PO-P3-A` — many unassigned |
| P3-B | Admin | `admin` / `123` | Mobile | Partially planned `PO-P3-B` |
| P3-C | Admin | `admin` / `123` | Mobile | Ready for factory → Release to factory |
| P3-D | Worker | `carpenter` / `123` | Mobile | Home Today — IN_PRODUCTION carpentry |
| P3-E | Admin | `admin` / `123` | Mobile | Attention — materials hold, plan valid |
| P3-F | Admin | `admin` / `123` | Mobile | Conflict on assign (overlap with P3-D) |
| P3-G | Admin | `admin` / `123` | Mobile | Parallel opening assigned; downstream open |
| P3-H | Admin | `admin` / `123` | Mobile | Pre-start reassignment (`carpenter2`) |

Accounts (password `123`): `admin`, `prodmgr`, `carpenter`, `upholsterer`, …

---

## F. Demo

- Seed: [`packages/database/prisma/demo/piece3-production-plan.ts`](../packages/database/prisma/demo/piece3-production-plan.ts)
- Wired: `factory-world.ts` after Piece 2
- Reset: `pnpm demo:reset`
- P2-F bonus: now creates real non-LOGISTICS tasks

---

## G. Test evidence

| Suite | Status |
|---|---|
| `production-readiness.spec.ts` | PASS |
| `worker-recommend.spec.ts` | PASS |
| `tasks.assign-piece3.spec.ts` | PASS |
| `tasks.assign-permissions.spec.ts` | PASS |
| `order-production-setup.spec.ts` | PASS |
| `production-inventory.service.spec.ts` | PASS |
| `terminal-chain.test.ts` | PASS |
| `requests.piece1-lifecycle.spec.ts` | PASS |
| mobile `adminOrderJourney` / `selectProduction` | PASS |

---

## H. Handset checklist

| Check | Status |
|---|---|
| Admin: Needs planning → P3-A → assign+dates → Ready for factory | **PENDING HANDSET** |
| Admin: Release to factory confirm → IN_PRODUCTION | **PENDING HANDSET** |
| Worker carpenter: sees only own released task | **PENDING HANDSET** |
| Conflict override path (P3-F) | **PENDING HANDSET** |
| Parallel stages (P3-G) | **PENDING HANDSET** |
| RTL AR/HE sheets + dock | **PENDING HANDSET** |

---

## I. Master-list checkoff

**In Piece 3:** production planning after setup; manual workers; manual dates; qualification/availability help; conflict visibility; ready-for-factory gate; release-to-factory; worker receives work; production mobile simplification.

**Out (Piece 4+):** dealer statement/balance; Material Prep portal; invoice final cost; purchasing; RFQ AI attachments; quotations aesthetic; global search; full-app RTL audit; PWA contacts; fabric beyond P2; actual mfg costing.

---

## J. Runtime scores

| Check | Status |
|---|---|
| Audit / freeze | PASS |
| API readiness + assign + recommend | PASS |
| Mobile board / plan / release / redirect | PASS |
| Demo P3-A–H | PASS (seed wired; reset not run in this session) |
| Automated tests §27 core | PASS |
| Handset | **PENDING HANDSET** |
| Piece 4 | **STOP — not started** |

---

## HANDSET FIX — ASSIGN WORKERS & DATES

### ROOT CAUSE

Pressing **Assign workers & dates** called `openAssign(firstTaskId)` only when an executable task existed. On **PO-P2-F** with **Workers 0/0** (zero `ProductionTask` rows), `executableTasks` was empty → the handler found no task and **returned silently** (dead CTA). The dock also wrapped the CTA in an opaque full-width `JourneyStickyDock` panel.

### WHY 0/0 APPEARED

Piece 2 demo **PO-P2-F** historically created a workflow snapshot + stage instances **without** floor `ProductionTask` rows (or re-seed hit `existingPo` / existing snapshot and skipped task creation). Readiness then correctly reported `required: 0` → UI showed Workers 0/0, Dates 0/0, and “No executable production tasks…”.

### FIX

1. **API** `ensureExecutableTasks` — create missing non-LOGISTICS tasks from stage instances; auto-run on staff `GET /production-orders/:id`; also `POST .../ensure-plan-tasks` for Retry.
2. **Seed** P2-F always backfills `TSK-P2-F-*` tasks even when PO/snapshot already exists.
3. **CTA** always opens `ProductionPlanAssignSheet` (lists all executable stages) — never a silent no-op; Retry when stages cannot be prepared.
4. **Floating dock** — `JourneyStickyDock floating`: transparent outer wrapper + `pointerEvents="box-none"`; only the elevated button is opaque.

### REAL ROUTE

```
Admin → Production tab
→ /(app)/(admin)/production/[id]  (PO-P2-F)
→ ProductionDetailScreen
→ JourneyStickyDock floating → SecondaryButton "Assign workers & dates"
→ openPlanSheet() → ProductionPlanAssignSheet
→ stage Assign → AssignWorkerSheet → POST /tasks/:id/assign
```

### CTA DESTINATION

`ProductionPlanAssignSheet` (bottom sheet on the same PO detail). Not a separate route.

### FLOATING DOCK

`JourneyStickyDock` `floating` prop: transparent background, box-none pointer events, tab-bar safe inset unchanged.

### TESTS

- `ensure-executable-tasks.spec.ts` — PASS
- `planCta.test.ts` — PASS (CTA must open sheet even at 0 tasks)
- readiness / selectProduction — PASS

### HANDSET

**PENDING HANDSET** — retest:

```
admin / 123
→ Production
→ PO-P2-F
→ Assign workers & dates
```

Expected: plan sheet opens with executable stages (not Delivery); Workers/Dates N>0 after load/ensure; Assign on a stage opens worker sheet.

Optional: `pnpm demo:reset` if DB still has a pre-fix P2-F without tasks (API ensure should repair on open without reset).

### Piece 4

**STOP — not started.**
