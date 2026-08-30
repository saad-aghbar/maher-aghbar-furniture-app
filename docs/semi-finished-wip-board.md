# Semi-finished WIP board (domain)

Locked factory rules for order-centric semi-finished goods. Builds on existing
`SEMI_FINISHED_GOOD` lots, stage inventory tracking, and task completion.

## Decisions (Phase 0)

| Topic | Rule |
|--------|------|
| Piece count | Configured on product × stage (`expectedPieceCount`). Worker registers that many pieces (photos). |
| QR grain | **Kit QR required** (paper on the stack). Per-piece QR optional for high-value parts. |
| Photos ↔ WIP | `requiresPhotos` on a middle production stage that produces output ⇒ register a WIP kit. Setup defaults `PRODUCES_SEMI_FINISHED` when photos are required. |
| Platforms | Full stack: worker complete → board (admin + mobile) → QR claim → SEMI transfers/counts → scheduling readiness. |
| Material overage | Warn only; worker may complete with actual ≠ expected. Admin sees variance on kit/task. |

## Objects

### WipKit
One card per **production order × producing stage instance**.

- Status: `OPEN` → `READY` → `CLAIMED` → `CONSUMED` (or `CANCELLED`)
- Holds expected/actual piece count, kit `qrCode`, next snapshot node ids, warehouse
- Detail: photos, pieces, materials used on the producing task, next hop label

### WipPiece
Physical part inside a kit (e.g. three bed bars).

- Linked photo document, optional piece `qrCode`, optional `InventoryLot`
- Sort order within kit

### InventoryLot
Existing lot remains the stock authority. Extended with optional `qrCode` (often = kit or piece code). Kit aggregates lots for the board.

## Worker complete (producing stage)

1. Photos (required count ≥ `expectedPieceCount` when kit-producing)
2. Confirm pieces (one photo ↔ one piece by default)
3. Materials: expected from snapshot; adjust actual; overage flagged, not blocked
4. System creates/updates `WipKit` + pieces + `SEMI_FINISHED_RECEIPT` lots (idempotent with production-inventory)

## Next-stage handoff

If any prerequisite stage produced a READY/CLAIMABLE kit:

1. Worker opens task → **Scan kit QR** to claim
2. Claim marks kit `CLAIMED`, binds to consuming task
3. On progress/complete, existing semi-finished consume issues lots

## Board

Stage sections (by producing stage definition/code). Cards = kits. Tap → detail popup (photos, pieces, QR, next stage, materials).

## Transfers & counts

SEMI warehouse transfers may move kits/lots. Stock counts accept kit/piece QR and reconcile against AVAILABLE lots. Optional warehouse locations label stage floors (carpentry rack, assembly staging).

## Scheduling

WIP readiness considers kits: consumer stages blocked until required kits are `READY` (and claim required when configured). Surface `WIP_NOT_READY` / `WIP_NOT_CLAIMED` on schedule and task detail.
