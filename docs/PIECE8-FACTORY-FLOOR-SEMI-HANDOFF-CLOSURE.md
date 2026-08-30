# PIECE 8 — FACTORY FLOOR SEMI HANDOFF CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING HANDSET**. Browser **PENDING**. **STOP** after Piece 8 — do not start Piece 9.

Pieces 1–7 are **FROZEN**. **Piece 9 was NOT started.**

---

## A. Pre-implementation audit

### WHAT EXISTS

| Layer | Assets |
|---|---|
| DB | `WipKit`, `WipPiece`, `WipHandoff`, `ProductionTask`, `ProductionStageInstance`, `ProductionTaskMaterialUsage`, SEMI/FIN inventory classes + txs |
| Domain | `wip-handoff.ts`; `floor-execution.ts` (Piece 8 phases/lanes/custody); `piece-labels.ts`; Packaging→FIN validator |
| API | Receive/claim/incoming/lanes/discrepancy; material-usage RAW-only; SEMI lot receipt/issue |
| Mobile worker | Task detail RAW≠SEMI; Receive sheet (manual+QR); Today buckets; SEMI PO board |
| Admin | SEMI PO-grouped board; production WIP panel; workflow circles unchanged |
| UAT | `pnpm smoke:piece8-factory-floor-semi-uat` **15/15** |

### WHAT WORKS (post Piece 8)

- First stage: SEMI input not required; Start without fake SEMI
- Downstream: expected SEMI by predecessor lane; receive manual or QR
- Partial X of Y; discrepancy → Attention without silent receive
- Custody CLAIMED after receive; handoff history via timeline
- RAW required/used/scrap/unused; SEMI receive adds **0** mfg cost
- Packaging→FIN; Delivery worker tasks = 0
- Demo SO/PO-P8-A…L

### Freeze

| System | Frozen |
|---|---|
| Pieces 1–7 | YES |
| Workflow DAG editor | YES |
| Scheduling / commercial finance / purchasing | YES |

---

## B. Physical model

| Concept | SoT |
|---|---|
| RAW | `ProductionTaskMaterialUsage` + inventory issue/return |
| SEMI | `WipKit` + pieces + QR + `WipHandoff` |
| Custody | Derived (no Custody table): READY→waiting; CLAIMED→received; CONSUMED→in work |
| Location | Stage bins / kit `locationId` (`whereHints` on incoming) |
| FIN | Packaging only |

Human phases: Waiting previous | Ready to receive | Ready to start | In progress | Completed | Attention.

---

## C–F. Task UX / Receive / Today / RAW

- Task anatomy: photo → what making → **RAW** → **SEMI INPUT** → instructions → **OUTPUT**
- One primary CTA from `floorHint.primaryAction`
- Receive: lanes FROM {stage}; Scan QR **or** Confirm expected kit; Report problem
- Today: DO NOW / READY AFTER RECEIVING / WAITING / COMPLETED TODAY
- Partial: keep domain rule (allow; show X of Y)
- RAW scrap ≠ SEMI damage

---

## G–H. SEMI inventory + admin PO

- Admin SEMI: PO-grouped Active|History board (`semi-order-board.tsx`)
- Mobile SEMI: existing PO board polished
- Production WIP panel: incoming/outgoing + location; workflow circles untouched

---

## I. Boundaries

Inspection QC unlocks Packaging; Packaging→FIN once; no SEMI after Packaging; Delivery = 0 worker production tasks.

---

## J. Permissions + idempotency

Worker: own tasks / expected PO SEMI / own usage. Deny BOM/cost/assign/workflow/other-PO.  
Receive / discrepancy / kit create use idempotency keys.

---

## K. Demo P8-A…L

Seed: `packages/database/prisma/demo/piece8-factory-floor.ts` after Piece 7.

| ID | Story |
|---|---|
| A | Carpentry ready (SEMI none) |
| B | Kit READY waiting Assembly |
| C | Assembly ready to receive |
| D | CLAIMED → ready to start |
| E | Parallel Carpentry + Foam |
| F | Partial 4/6 |
| G | Discrepancy Attention |
| H–K | Downstream / Inspection / Packaging→FIN |
| L | RAW scrap + unused |

Logins: `carpenter` / `assembler` / `admin` password `123`.

---

## L. Tests + live UAT

| Suite | Result |
|---|---|
| `floor-execution.spec.ts` | PASS |
| `manufacturing-cost.spec.ts` (SEMI receive ≠ cost) | PASS |
| `pnpm smoke:piece8-factory-floor-semi-uat` | **PASS 15/15** |

---

## M. Manual handset routes (EXPECT)

### Carpenter / `123`

1. Today → **DO NOW** or Tasks → open **PO-P8-A** Carpentry (`TSK-P8-A-*`)
2. EXPECT: product image; **RAW MATERIALS**; **SEMI-FINISHED INPUT = None**; Start CTA (no QR wall)
3. Open **PO-P8-B** Carpentry completed / kit produced story for output reference

### Assembler / `123`

1. Today → **READY AFTER RECEIVING** → **PO-P8-C** Assembly
2. EXPECT: RAW section; separate **SEMI-FINISHED INPUT** From Carpentry; Ready to receive; where hint if bin set
3. Tap **Receive SEMI** → expected checklist → **Confirm expected kit** (or Scan QR)
4. EXPECT after confirm: Received ✓; phase Ready to start; Start enabled
5. Optional: **Report problem** on another story (P8-G) → Attention; kit not received

### Admin

- Inventory → SEMI → PO cards Active|History; open PO dossier / timeline
- Production → PO-P8-* → WIP panel (incoming/outgoing)

HANDSET / BROWSER remain **PENDING** until you observe Expo / admin-web.

---

## N. Scoreboard (§43)

| Gate | Result |
|---|---|
| RAW/SEMI SEPARATION | **PASS** |
| WORKER TASK UX | **PASS** (code) |
| FIRST-STAGE UX | **PASS** |
| INCOMING SEMI | **PASS** |
| MANUAL RECEIVE | **PASS** |
| QR RECEIVE | **PASS** (path retained) |
| CUSTODY | **PASS** |
| HANDOFF HISTORY | **PASS** (timeline) |
| MULTI-PREDECESSOR | **PASS** |
| PARALLEL LANES | **PASS** |
| PARTIAL HANDOFF | **PASS** |
| DISCREPANCY | **PASS** |
| RAW USAGE | **PASS** |
| SCRAP | **PASS** |
| UNUSED | **PASS** |
| SEMI OUTPUT | **PASS** |
| NO COST DOUBLE COUNT | **PASS** |
| SEMI INVENTORY BOARD | **PASS** |
| SEMI HISTORY | **PASS** |
| PRODUCT IMAGES | **PASS** (code; handset pending) |
| INSPECTION INTEGRATION | **PASS** |
| PACKAGING→FIN | **PASS** |
| DELIVERY TASKS | **0** |
| IDEMPOTENCY | **PASS** |
| PERMISSIONS | **PASS** |
| LIVE UAT | **PASS 15/15** |
| HANDSET | **PENDING** |
| BROWSER | **PENDING** |
| PIECE3 REGRESSION | **PASS** (frozen; assign authority) |
| PIECE5 REGRESSION | **PASS** |
| PIECE6 REGRESSION | **PASS** (inventory txs retained) |

**PASS:** 28 · **PENDING:** 2 (HANDSET, BROWSER)

---

## O. Backlog checkoffs (§44)

You can check off (not mocked):

- [x] Worker task execution  
- [x] RAW material usage  
- [x] SEMI-finished handoff  
- [x] SEMI custody  
- [x] SEMI inventory  
- [x] Scrap  
- [x] Unused material  
- [x] Stage output  
- [x] Physical production history  

Still for you on device: aesthetic/sticky/RTL feel (HANDSET).

---

## P. Known gaps

- Credit/refund of advance finance = Piece 7 gap (unrelated)
- Soft-claim legacy route name remains as alias of receive
- Full `demo:reset` recommended after pull so all P8 kits are READY before first smoke
- Mobile QC UI still thin (API+admin exist) — out of Piece 8 redesign scope

---

## Q. Files changed (high level)

- `apps/api/.../floor-execution.ts` + spec; `wip-kit.service/controller` (lanes, discrepancy)
- `apps/mobile/.../tasks/*`, `worker-home/*`, i18n EN/AR/HE
- `apps/admin-web/.../semi-order-board.tsx`, `inventory-client.tsx`, `production-wip-panel.tsx`
- `packages/database/prisma/demo/piece8-factory-floor.ts`, `factory-world.ts`
- `scripts/smoke-piece8-factory-floor-semi-uat.mjs`
- This closure doc

---

## Z. STOP

**Piece 8 CODE COMPLETE. Piece 9 was NOT started.**
