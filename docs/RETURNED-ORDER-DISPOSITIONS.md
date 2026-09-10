# Returned-order dispositions — factory checklist

Use this after `pnpm smoke:returned-dispositions` and the existing visibility / Piece 11 UATs.

## Feature flag

`SystemSetting` key `returns` → `{ "dispositionV2": true }`.

Mobile reads `GET /returns/:id/capabilities`. Flag off keeps the old “Decide factory work” sheet.

Backfill existing fates: `node scripts/backfill-return-dispositions.mjs`.

## Paths

For Standard, Modified, and Custom orders, walk each outcome on a received return:

1. **Repair** — inspect (result + technician notes) → execute → `RW-` work order → optional QC fail (loop count +1) → QC pass → schedule reship → dealer confirm. Parent becomes `COMPLETED`.
2. **Replacement** — inspect → execute → `RP-` work order. Must not reuse an existing `RW-` order. Same reship close.
3. **Return to stock** — inspect PASS, pick warehouse/bin. Blocked for manufacturing defect, delivery damage, failed inspection, and Custom builds. Warehouse/QC approve → lot becomes `AVAILABLE` at the chosen bin → parent `COMPLETED`.
4. **Scrap** — inspect + disposal method/reason. Optional salvage lines. QC/production approve → salvage receipts + valued write-off → parent `COMPLETED`.

## Edge cases

- Partial split: 1 repair + 1 scrap on a qty-2 return. Sum cannot exceed received qty.
- Missing parts: repair execute with no materials still creates the `RW-` order; add parts on the plan.
- Rejected inspection: FAIL on restock keeps the piece out of stock (`RETURN_NOT_STOCKABLE` / blockers).
- Second replacement after a rework PO: legacy `POST /work-order` returns `RETURN_WORK_KIND_CONFLICT` unless `allowSiblingKinds` is used by the disposition executor.

## Manual taps (mobile)

1. Open Returns → received row.
2. Confirm the stepped “What to do” sheet requires inspection fields before Save.
3. Confirm linkage board shows original SO, `RW-`/`RP-`, lot, warehouse/bin, reship.
4. After restock/scrap, Orders Returned pending count drops (return is `COMPLETED`).
5. Refresh the return, FIN Returned, SEMI Returned, and Production origin=returned.

## Proof for this release

- API Jest: disposition lifecycle, rules, salvage, replacement conflict, decide, Piece 11.
- Mobile: disposition sheet render + required-field tests, existing selector/floor tests.
- Live (this run):
  - `pnpm smoke:returned-visibility` — **59/59**. `pendingReturns` dropped from 3 to 2 after restock/scrap now close to `COMPLETED` (and leftover `RETURNED_TO_STOCK` / `SCRAPPED` no longer count as pending).
  - `pnpm smoke:piece11-exceptions-returns-uat` — **15/17**. CASE2 receive still returns `RETURN_INVALID_TRANSITION` (pre-existing; not patched around).
  - `pnpm smoke:returned-dispositions` — **20/20**.
