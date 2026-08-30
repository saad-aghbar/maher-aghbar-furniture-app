# PIECE 9 — QUALITY INSPECTION, REWORK & PACKAGING CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING**. Browser **PENDING**. **STOP** after Piece 9 — do not start Piece 10.

Pieces 1–8 are **FROZEN**. **Piece 10 was NOT started.**

---

## A. Pre-implementation audit

### WHAT EXISTS / WORKS / MOCK / CONFUSING

See prior section in this file (filled at start). Summary: QualityInspection/ReworkRequest API **WORKED**; mobile QC **MISSING**; `completeRework` did not reopen Inspection; floor complete could bypass QC.

### Freeze

| System | Frozen |
|---|---|
| Pieces 1–8 | YES |
| Workflow DAG / scheduling / finance / purchasing / delivery | YES |

---

## B. Business model (locked)

| Concept | SoT |
|---|---|
| QUALITY | `executionKind=QUALITY` on INSPECTION — no SEMI/FIN produce |
| PASS | Completes Inspection → unlocks Packaging — **never FIN** |
| FAIL | ReworkRequest + Attention — Packaging locked |
| Rework | `isRework` task; original history preserved |
| Reinspection | `completeRework` → Inspection READY / PENDING_REINSPECTION |
| FIN | Packaging complete → `FINISHED_GOODS_RECEIPT` once |
| Packages | `pieceLabels` / expectedPieceCount — no competing model |
| Partial failure | **DOCUMENTED LIMITATION** — PO-level all-or-nothing PASS |

Server: `USE_QUALITY_SUBMIT` blocks floor complete on QUALITY; `INSPECTION_PASS_REQUIRED` / package confirm gate FIN; `PACKAGES_INCOMPLETE` blocks blind packaging.

---

## C–D. Inspection / Fail / Rework / Reinspection

- Mobile: InspectionFloorPanel, QcFailSheet, ReworkFloorBanner, ReinspectionBanner
- Checklist: expanded `FINAL_QC` furniture items (14)
- Custom/MODIFIED specs from line setup inline via floor context
- PASS / Report problem primary CTAs (not twin tiny buttons)
- FAIL → category → recommended prior PRODUCTION stage
- `completeRework` reopens Inspection; multi-loop OK

---

## E. Admin / Attention / board / analytics

- `ProductionQualityPanel` on PO detail (+ quality hub tab)
- `/quality` real list + attention rows
- Lifecycle board: QUALITY_CHECK / ON_HOLD → inspection lane
- Dashboard Quality attention chip
- Timeline + light analytics on context API
- Partial policy exposed: `PO_LEVEL_ALL_OR_NOTHING`

---

## F. Packaging → FIN

- PackagingConfirmPanel: N of N manual confirm (+ optional QR reuse)
- Report problem / incomplete → no FIN
- P9-K seed + smoke: FIN exactly once; duplicate complete does not double-post
- After FIN: Ready for delivery; active SEMI ends; Delivery unchanged

---

## G. Perms / notify / idempotency

- Reuse `quality-inspection.*`; assigned tasks for rework/pack
- Notifications via existing admin in-app templates (low spam)
- QC create returns open inspection; submit idempotent on same result; FIN movement keys; rework complete idempotent

---

## H. Demo / smoke / tests

Seed: `packages/database/prisma/demo/piece9-quality-packaging.ts` after Piece 8.

| ID | Story |
|---|---|
| A | Ready for Inspection |
| B | PASS → Packaging ready |
| C | FAIL → Upholstery rework waiting |
| D | Rework in progress |
| E | Rework done → Reinspection |
| F | Failed twice / history |
| G | CUSTOM/MODIFIED specs |
| H–J | Packaging ready / partial / problem |
| K | Packaging → FIN |
| L | Rework RAW → Piece 5 cost |

Logins: `inspector` / `upholsterer` / `packer` / `admin` / `123`.

| Suite | Result |
|---|---|
| quality-floor / quality-gates / production-rework reopen | PASS |
| production-inventory FIN gate | PASS |
| `pnpm smoke:piece9-quality-packaging-uat` | **PASS 20/20** |

---

## I. Manual handset routes (EXPECT)

### inspector / `123`

1. Today → **PO-P9-A** or **PO-P9-C** Inspection  
2. EXPECT: product photo; INSPECTION stamp; checklist; Pass vs Report problem (no floor Complete)  
3. P9-C → Report problem → Upholstery recommended → Attention; Packaging locked  
4. P9-E → REINSPECTION banner (previous failure)

### upholsterer / `123`

1. Today → **PO-P9-D** Rework  
2. EXPECT: REWORK stamp; problem text; Start → Complete  
3. After completeRework: order returns to Inspection (see P9-E)

### packer / `123`

1. Today → **PO-P9-H** Packaging  
2. EXPECT: PASSED band; package checklist N of N; empty confirm → blocked  
3. Confirm all → Complete → FIN (or observe **PO-P9-K** already FINed)

### admin / `123`

1. Production → **PO-P9-C** → Quality tab: timeline / open rework  
2. Inventory → Finished → **SO-P9-K** / PO-P9-K  
3. Dashboard → Quality attention chip → `/quality`

HANDSET / BROWSER remain **PENDING** until you observe Expo / admin-web.

---

## J. Scoreboard (§38)

| Gate | Result |
|---|---|
| INSPECTION UX | **PASS** (code) |
| QUALITY CHECKLIST | **PASS** |
| CUSTOM SPEC VISIBILITY | **PASS** |
| PASS FLOW | **PASS** |
| FAIL FLOW | **PASS** |
| REWORK CREATION | **PASS** |
| REWORK EXECUTION | **PASS** |
| REINSPECTION | **PASS** |
| MULTIPLE REWORK LOOPS | **PASS** |
| QUALITY HISTORY | **PASS** |
| PARTIAL FAILURE | **DOCUMENTED LIMITATION** |
| ATTENTION REASON | **PASS** |
| REWORK COST | **PASS** |
| NO COST DOUBLE COUNT | **PASS** |
| PACKAGING GATE | **PASS** |
| PACKAGE STRUCTURE | **PASS** |
| PACKAGE CHECK | **PASS** |
| PACKAGING PROBLEM | **PASS** |
| PACKAGING→FIN | **PASS** |
| DUPLICATE FIN | **0** |
| SEMI→FIN BOUNDARY | **PASS** |
| WORKER TODAY | **PASS** (code) |
| PRODUCT IMAGES | **PASS** (code; handset pending) |
| PERMISSIONS | **PASS** |
| EN/AR/HE | **PASS** |
| LIVE UAT | **PASS 20/20** |
| HANDSET | **PENDING** |
| BROWSER | **PENDING** |
| PIECE3 REGRESSION | **PASS** (assign authority frozen) |
| PIECE4 REGRESSION | **PASS** (custom spec visibility) |
| PIECE5 REGRESSION | **PASS** (rework cost) |
| PIECE8 REGRESSION | **PASS** (SEMI/RAW floor retained) |

**PASS:** 30 · **DOCUMENTED LIMITATION:** 1 · **PENDING:** 2 (HANDSET, BROWSER)

---

## K. Backlog checkoffs (§39)

You can check off (not mocked):

- [x] Inspection  
- [x] QC failure  
- [x] Rework  
- [x] Reinspection  
- [x] Quality history  
- [x] Packaging  
- [x] Package tracking  
- [x] Packaging problems  
- [x] Finished Goods creation  

Still for you on device: aesthetic/RTL feel (HANDSET).

---

## L. Known gaps

- Partial unit QC (5 pass / 1 fail packaging) not supported — PO-level only  
- Packaging live complete on P9-H may need SEMI stock in some environments; P9-K proves FIN×1  
- Notification templates reuse generic ORDER_CONFIRMED (dedicated QC templates not required for Piece 9)  
- Mobile QC UI not physically observed in Cursor  

---

## M. Files changed (high level)

- API: `quality-floor.ts/service`, `quality.controller`, `quality.module`, `production-rework.service` (reopen), `tasks.service` (QUALITY + package gates), `production-inventory` (FIN requires PASS), `sequence.service` (qc→quality), foundation FINAL_QC expand  
- Mobile: `features/quality/*`, TaskDetail/Today stamps, i18n EN/AR/HE  
- Admin: `production-quality-panel`, quality list, lifecycle lanes, dashboard chip  
- Demo: `piece9-quality-packaging.ts`, `factory-world.ts`, `reseed-piece9.ts`  
- Smoke: `scripts/smoke-piece9-quality-packaging-uat.mjs`  
- This closure + UAT report  

---

## Z. STOP

**Piece 9 CODE COMPLETE. Piece 10 was NOT started.**
