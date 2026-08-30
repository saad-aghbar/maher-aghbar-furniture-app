# Semi-finished floor — how to think about it

## One flow

1. Open **Semi-finished**
2. Tap the full-width **stage** board button → pick a stage
3. See **order cards** for that stage (same industrial language as Material Floor tasks)
4. Tap an order → **detail sheet** (worker photos, pieces, materials, Show QR / Print)

There is **no** Floor kits / Stock lots switch. Transfers and counts stay on their own tabs.

## Aesthetic

Matches Material Floor / employee industrial:

- Board cards: accent rail, header stamps, near-square media, soft board shadow
- Stage control + picker: LotInspect-level rows (not chip wrap)
- Detail: LotInspect stacking + ImageCarousel for piece worker photos

## Mental model

1. Worker finishes a produce-semi stage → an **order×stage kit** appears under that stage (QR + bin).
2. Next-stage worker **scans kit QR** on the task → claim → work.
3. Inventory Semi is the floor list of those orders — identity first, then QR/print from detail.

## What to test with demo data

- Stage button → Foam / Assembly / Upholstery / Painting / Packaging (not only Carpentry)
- Status stamps: READY and CLAIMED
- Multi-piece kits with worker photos (seed attaches real JPGs from `uploads/seed/task-photos`)
- Order card → detail → eye on piece → full-screen viewer → Show QR → Print

Re-seed anytime:

```bash
# from repo root, with DATABASE_URL set
pnpm --filter @maher/database exec tsx prisma/seed-wip-demo.ts
```

This also backfills photos onto any existing WIP pieces that still lack one.