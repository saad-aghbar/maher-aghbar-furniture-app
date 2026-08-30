# Piece 14 — Full-system UAT dataset

Deterministic walkthrough seeds for end-to-end factory smoke and **manual** golden lifecycle (not pre-completed).

| Artifact | Path / command |
|----------|----------------|
| Seed | `packages/database/prisma/demo/piece14-full-system.ts` → `seedPiece14FullSystemExamples` |
| Wired from | `factory-world.ts` **after** Piece 12 |
| Optional reseed | `pnpm --filter @maher/database exec dotenv -e ../../.env -- tsx prisma/demo/reseed-piece14.ts` |
| Full demo reset | `pnpm demo:reset` (destructive local/demo only) |
| Smoke | `pnpm smoke:piece14-full-system-uat` → [`piece14-invariants-report.md`](./piece14-invariants-report.md) |

Demo passwords: `*/123` (admin, carpenter, oasis, balqis, …) — **never** auto-create on production ([`PRODUCTION-DEPLOYMENT.md`](./PRODUCTION-DEPLOYMENT.md)).

---

## Primary rows (Piece 14)

| Number | Intent | Start gate | Do **not** expect at seed |
|--------|--------|------------|---------------------------|
| **SO-P14-GOLDEN** | Oasis + sofa-like catalog product; RFQ → QT **ACCEPTED** → SO; setup **RELEASED**; commercial price **CONFIRMED**; catalog materials (fabric/wood/foam/hardware when present) | Open SO → floor on **PO-P14-GOLDEN** (**READY**); **first executable task READY** (carpenter; typically **MATERIAL_PREP**) | No FIN lots, no deliveries, lifecycle not completed |
| **RFQ-P14-GOLDEN** / **QT-P14-GOLDEN** / **PO-P14-GOLDEN** | Linked commercial + production spine | Same as SO | — |
| **SO-P14-MOD** | Same dealer/product; **order width ≠ catalog** (+25); complexity **MODIFIED**; order-specific materials (`FACTORY_MODIFIED` / `CUSTOM` — Product BOM untouched); explicit commercial unit price **CONFIRMED**; setup released | Same pattern; verify dims + materials on setup/PO | Catalog BOM unchanged |
| **QT-P14-MOD** / **PO-P14-MOD** | Quotation + released PO for modified path | — | — |

Notes fields mention “Piece 14 golden walkthrough” / MOD width + order-only materials.

### Golden MANUAL path (after start gate)

1. Worker starts first READY task → consume/issue RAW as required  
2. Stage chain → SEMI create/handoff (0 mfg $ on handoff)  
3. QC PASS (FAIL → rework companions P9 if needed)  
4. Packaging → FIN receipt once  
5. Delivery load → `POST /deliveries/:id/depart`  
6. Dealer **oasis** `confirm-receipt` → Delivered + invoice path  
7. Optional return: use P11 fixtures or report new return after deliver  

Smoke does **not** drive steps 1–7; it proves fixtures + gates + samples only.

---

## Useful companion rows (P6–P11)

Use these for side paths without overloading P14 seeds:

| Area | Pointers | Where | Account hints |
|------|----------|-------|---------------|
| **Shortage / purchasing** | `PO-P6-F` open shortage; `PO-P6-H` receipt stocks need | Purchasing / materials tiles | admin |
| **Factory floor / SEMI** | `SO/PO-P8-A` carpentry READY; `P8-B…G` kit handoffs | Floor / SEMI boards | carpenter / assemblers |
| **QC / rework / packaging** | `SO/PO-P9-A` inspection; `P9-C/D` FAIL + rework; `P9-H` packaging READY; `P9-K` FIN after pack | Quality / packaging | inspector / packer |
| **Finished outbound / receipt** | `SO/DLV-P10-A…G` waiting → leaving → ship; **`P10-G`** balqis confirm; `P10-E` incomplete load; `P10-F` depart idempotency | Outbound / dealer receipt | admin; **balqis** confirm |
| **Returns / cancel / exceptions** | `RET-P11-F…J`; cancel `SO-P11-C` / `SO-P11-L`; inventory correction `SO-P11-K`; smoke uses **RET-P11-F** pending | Returns / cancel impact | admin; dealers |
| **Finance** | `SO/INV/PAY-P7-L` advance credit; P7 overdue invoices; oasis statement fields | Invoices / dealer finance | admin / oasis |

See also: [`piece12-management-tile-map.md`](./piece12-management-tile-map.md) for management dashboard tile → demo map.

---

## Manual UAT matrix (focused)

| Story | Record | Actor | Action | Pass if |
|-------|--------|-------|--------|---------|
| Standard start | SO/PO-P14-GOLDEN | admin + carpenter | Open floor task | READY; materials visible |
| Modified | SO-P14-MOD | admin | Compare width vs catalog product | Order wider; BOM unchanged |
| Shortage | PO-P6-F | admin | Materials / purchasing tile | Shortage visible without inventing demand |
| SEMI | PO-P8-* | worker | Handoff | Custody changes; 0 mfg $ |
| QC fail | P9-C/D | inspector | FAIL | Rework path; no pack |
| FIN / ship | P10-F/G | admin / balqis | Depart / confirm | Depart once; confirm 0 inv |
| Finance | oasis statement | oasis | View due vs credit | Separate fields |
| Return | RET-P11-F | admin | Receive before approve | **RETURN_NOT_APPROVED** |
| Cancel | SO-P11-C | admin | Cancel impact | History preserved |
| Cross-dealer | foreign SO | oasis | GET other dealer | 403/404 |

---

## Wipe / idempotency

Reseed deletes existing rows whose numbers match `*-P14-*` tags **GOLDEN** and **MOD** (SO / PO / QT / RFQ / DLV), same cascade style as Piece 10 `wipeBundle`.

If smoke reports fixtures missing: run **`pnpm demo:reset`** (or reseed-piece14) against the demo DB, then re-run smoke.

---

## Related

- Ownership: [`PIECE14-DATA-OWNERSHIP-MAP.md`](./PIECE14-DATA-OWNERSHIP-MAP.md)  
- Closure: [`PIECE14-FULL-SYSTEM-CLOSURE.md`](./PIECE14-FULL-SYSTEM-CLOSURE.md)  
- Readiness: [`PIECE14-PRODUCTION-READINESS.md`](./PIECE14-PRODUCTION-READINESS.md)
