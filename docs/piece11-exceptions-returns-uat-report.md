# Piece 11 Exceptions / Returns UAT Report

API: http://localhost:4000
Result: **PASS** (17/17)

## Story map

| Story | Numbers | Intent |
|---|---|---|
| A | SO-P11-A | Draft SO cancellable |
| B | SO/PO-P11-B | Setup / ready-for-production cancellable |
| C | SO/PO-P11-C | IN_PRODUCTION + PRODUCTION_ISSUE RAW + open tasks + SEMI |
| D | SO/PO-P11-D | Already CANCELLED + SEMI REQUIRES_REVIEW |
| E | SO/PO-P11-E | READY_FOR_DELIVERY + FIN AVAILABLE (hold disposition) |
| F | SO/PO/DLV/RET-P11-F | DELIVERED + return PENDING (balqis) — 0 quarantine |
| G | SO/PO/DLV/RET-P11-G | APPROVED + WAITING_RETURN — 0 stock until receive |
| H | SO/PO/DLV/RET-P11-H | RETURNED + QUARANTINED lot awaiting inspection |
| I | SO/PO/DLV/RET-P11-I | REWORK fate + ReworkRequest (repair) |
| J | SO/PO/DLV/RET-P11-J + PO-P11-J-REPL | REPLACEMENT + replacement PO notes |
| K | SO-P11-K + CNT/ITX-P11-K | Cycle count / INVENTORY_ADJUSTMENT on RAW |
| L | SO/PO/INV/PAY-P11-L | Partial invoice + cancel financial attention |

Dealers: **balqis** (F–J), **nile** (cross-deny). Password `123`.

## Smoke results

- PASS 1. admin login
- PASS 2. P11 demo rows present (SO A–L + RET F–J) — missingSO=none missingRET=none
- PASS 3. CASE1 P11-C cancel-impact shows consumption — status=200 materials=46 openTasks=3 semi=1
- PASS 4. CASE1 P11-C cancel with reason → CANCELLED — status=201 so=CANCELLED reason=Unable to manufacture: P11 smoke cancel — material / capacity code=
- PASS 5. CASE1 RAW PRODUCTION_ISSUE txs remain — before=1 after=1
- PASS 6. CASE1 open tasks cancelled — openLeft=0 cancelled=3
- PASS 7. CASE1 SEMI still exists (REQUIRES_REVIEW or present) — status=REQUIRES_REVIEW
- PASS 8. CASE2 P11-G already APPROVED + WAITING_RETURN — approval=APPROVED physical=WAITING_RETURN
- PASS 9. CASE2 approve alone had 0 CUSTOMER_RETURN before receive — count=0
- PASS 10. CASE2 receive → quarantine once — status=201 cret=1 lot=QUARANTINED physical=RETURNED code=
- PASS 11. CASE2 second receive idempotent — status=201 cret=1 code=
- PASS 12. CASE3 inventory adjustment/correction on K exists as ledger — tx=yes count=POSTED notes=P11-K cycle count adjustment — reason: physical count short
- PASS 13. nile login — status=201
- PASS 14. CASE4 nile cannot GET balqis return — status=404 code=NOT_FOUND
- PASS 15. CASE5 financialAttention true on L impact before cancel — status=200 attention=true invoice=true
- PASS 16. CASE5 cancel does not delete invoice on L — cancel=201 inv=kept pay=kept code=
- PASS 17. Phase 5 cannot cancel delivered SO-P11-F (USE_RETURN) — cancel=400 code=USE_RETURN phase=5 canCancel=false

HANDSET: PENDING
BROWSER: PENDING
