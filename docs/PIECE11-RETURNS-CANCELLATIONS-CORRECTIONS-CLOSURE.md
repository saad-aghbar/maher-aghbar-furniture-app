# PIECE 11 — RETURNS, CANCELLATIONS, CORRECTIONS & EXCEPTION MANAGEMENT CLOSURE

> Status: **CODE COMPLETE** — Handset **PENDING**. Browser **PENDING**. **STOP** after Piece 11 — do not start Piece 12.

Pieces 1–10 are **FROZEN**. Visual checklist (§44) uses **CODE READY** vs **PENDING** observation honesty.

---

## A. Pre-implementation audit

### WHAT EXISTS / WORKS / DANGEROUS (pre-fix)

| Area | Pre-verdict | Post-fix |
|---|---|---|
| ReturnRequest + returns API | WORKS thin | Receive-gated lifecycle |
| Approve → quarantine | **DANGEROUS** | **FIXED** — approve = 0 stock |
| Silent quarantine no lot | **DANGEROUS** | **FIXED** — BadRequest |
| DELIVERY_RESTORE | WORKS shipment-fail; SO-wide | Delivery-scoped prefer |
| SO cancel pre-release | WORKS | Retained |
| SO cancel IN_PRODUCTION+ | **GAP** | Phase 1–4 + impact |
| SEMI on cancel | WORKS REQUIRES_REVIEW | Retained + disposition attention |
| CreditNote / payment void | **GAP** | FINANCIAL ATTENTION only |
| Cycle-count adjustment | WORKS | Reason + confirm UX |
| createForReturn rework | WORKS | Repair path |
| piece11 demo/smoke | **MISSING** | P11-A…L + smoke 17/17 |

Freeze P1–10. Piece 12 NOT STARTED.

---

## B. Principles

- Never erase consumed RAW / completed tasks / original mfg cost.
- CANCEL ≠ RETURN ≠ CORRECTION (UX + AuditEvent actions).
- Human labels only; no raw enums in UI.

---

## C. Phase-aware cancellation

| Phase | Behavior |
|---|---|
| 1–2 | Easy / setup cancel; reason required; release reservations |
| 3 | Impact preview; stop future tasks; preserve completed; SEMI disposition |
| 4 | FIN disposition required; never auto-destroy FIN |
| 5 | `USE_RETURN` — must use Return flow |

API: `GET /sales-orders/:id/cancel-impact`, `POST …/cancel` with `reasonCode` (+ note).

RAW: unused reserved released; consumed stays. Purchasing: show commitments; never cascade-cancel supplier POs. Finance: never auto-refund.

---

## D. Returns

Lifecycle: Reported → Under review → Approved/Rejected → Waiting for return → Returned → Inspection → Resolution → Closed. Need-info loop without stock.

- Report / Approve = **0 inventory**
- `POST /returns/:id/receive` → `CUSTOMER_RETURN` once
- Disposition: Repair / Replacement / Stock / Scrap / Commercial-only
- Repair: `createForReturn` + additive `isRework` cost
- Replacement: new PO labeled `REPLACEMENT — RET-…`
- DELIVERY_RESTORE = shipment-fail only ≠ RMA

---

## E. Corrections + finance

- Inventory: `INVENTORY_ADJUSTMENT` + required reason + confirm
- Cost: prior FINAL lines not rewritten in place
- Payment void / CreditNote = **DOCUMENTED LIMITATION** → FINANCIAL ATTENTION / RESOLUTION REQUIRED
- Piece 7 money conservation regressions PASS

---

## F. Attention / timeline / UX

- Attention: WHY + WHAT + NEXT (cancel SEMI/finance, return waiting, inventory)
- Timeline retains exception history
- Dealer Places Returns — human statuses; no factory internals
- Admin: More → Cancel impact sheet; returns board cards + detail

---

## G. Aesthetic / perms / i18n

Hard gate vs Purchasing/Inventory/P8–10. Photos when present. Loading/empty/error. Confirm sheets. Idempotent receive/cancel. Cross-dealer deny. EN/AR/HE + RTL keys.

---

## H. Demo / smoke / tests

| ID | Story |
|---|---|
| A–E | Cancel phases + SEMI/FIN disposition |
| F–J | Return report → approve → receive → inspect/repair/replace |
| K | Inventory correction ledger |
| L | Financial attention |

Users: `admin`/`123`, `balqis`/`123`, `nile`/`123`.

`pnpm smoke:piece11-exceptions-returns-uat` → **PASS 17/17**  
Unit: cancel-impact + returns-piece11 + dealer-finance + confirm-receipt **PASS**.

---

## I. Manual routes

| Route | Account | EXPECT |
|---|---|---|
| Orders → SO-P11-C → More → Cancel | admin | Impact: materials/SEMI/tasks; reason required; consumption remains |
| Returns → RET-P11-G → Approve | admin | Still 0 stock; Waiting for return |
| Confirm returned | admin | Quarantine once |
| Returns → RET-P11-H | admin | Waiting inspection / fate |
| Places → Returns → SO-P11-F | balqis | Photo/issue/human status |
| Open balqis return | nile | Denied |

### Visual checklist (§44)

| Check | Code | Observed |
|---|---|---|
| Cancel impact sheet | READY | **PENDING** BROWSER |
| Cancel reason UX | READY | **PENDING** |
| Returns board / detail | READY | **PENDING** |
| Dealer Returns lifecycle | READY | **PENDING** HANDSET |
| Repair / replacement link | READY | **PENDING** |
| Inventory correction confirm | READY | **PENDING** |
| Financial attention | READY | **PENDING** |
| AR/HE RTL | READY keys | **PENDING** |

HANDSET = **PENDING**. BROWSER = **PENDING**.

---

## §46 Scoreboard

| Row | Result |
|---|---|
| PHASE-AWARE CANCELLATION | **PASS** |
| CANCEL IMPACT PREVIEW | **PASS** |
| REASON REQUIRED | **PASS** |
| PRODUCTION HISTORY PRESERVED | **PASS** |
| RAW CONSUMPTION PRESERVED | **PASS** |
| UNUSED/RESERVED RELEASE | **PASS** |
| SEMI DISPOSITION | **PASS** |
| PURCHASE COMMITMENT SAFETY | **PASS** |
| RETURN REQUEST | **PASS** |
| RETURN APPROVAL | **PASS** |
| APPROVAL INVENTORY MOVEMENT | **0** |
| PHYSICAL RETURN | **PASS** |
| DUPLICATE RETURN RECEIPT | **0** |
| RETURN INSPECTION | **PASS** (fate/rework path) |
| REPAIR | **PASS** |
| REPLACEMENT | **PASS** |
| REPAIR COST | **PASS** (additive isRework) |
| ORIGINAL COST PRESERVED | **PASS** |
| INVENTORY CORRECTION | **PASS** |
| AUDIT HISTORY | **PASS** |
| FINANCE CONSERVATION | **PASS** |
| DEALER RETURNS | **PASS** (code) |
| CROSS-DEALER | **PASS** |
| ATTENTION WHY/ACTION | **PASS** |
| PERMISSIONS | **PASS** |
| EN/AR/HE | **PASS** |
| LIVE UAT | **PASS 17/17** |
| HANDSET | **PENDING** |
| BROWSER | **PENDING** |
| PIECE5–10 REGRESSION | **PASS** (unit + smoke boundaries) |

---

## §47 Backlog checkoffs (real only)

- [x] Order cancellation (phase-aware)
- [x] Production cancellation (tasks stopped; history kept)
- [x] Cancellation impact
- [x] SEMI disposition (REQUIRES_REVIEW + attention)
- [x] Return requests
- [x] Return review
- [x] Physical returns (receive-gated)
- [x] Return inspection / fate
- [x] Repair
- [x] Replacement
- [x] Inventory corrections
- [x] Exception/Attention management
- [x] Return history (timeline + audits)

Still for you on device: aesthetic/RTL feel (HANDSET / BROWSER).

---

## Known limitations

- CreditNote / payment void / invoice VOID UX = DOCUMENTED LIMITATION (FINANCIAL ATTENTION)
- Dedicated return QC checklist UI reuses fate/rework rather than full Piece 9 inspector clone
- HANDSET/BROWSER not physically observed

---

## Files changed (high level)

- Schema: ReturnRequest deliveryId/physicalStatus/receivedAt/needInfoNote
- API: cancel-impact/cancel phases; returns receive/need-info/replacement; quarantine/restore harden
- Admin: cancel-impact-sheet; returns board/detail; inventory correction confirm
- Mobile: dealer returns lifecycle; Places Returns retained
- Demo: piece11-exceptions-returns.ts; smoke script; UAT report
- i18n EN/AR/HE; this closure

---

## Z. STOP

**Piece 11 CODE COMPLETE. Piece 12 was NOT started.**
