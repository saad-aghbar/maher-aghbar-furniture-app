# Semi-finished WIP board — closure

## Shipped

- Domain doc: [`docs/semi-finished-wip-board.md`](semi-finished-wip-board.md)
- Schema: `WipKit`, `WipPiece`, `WipKitStatus`, lot `qrCode`, `expectedPieceCount`, `WipKit.locationId` → stage bins
- `WipKitService` + APIs:
  - `GET /inventory/wip-kits/board`
  - `GET /inventory/wip-kits/:id`
  - `GET /inventory/wip-kits/by-code/:code`
  - `GET /inventory/wip-kits/stage-bins`
  - `POST /inventory/wip-kits/ensure-stage-bins`
  - `PATCH /inventory/wip-kits/:id/location`
  - `GET /tasks/:taskId/wip-claim-requirements`
  - `POST /tasks/:taskId/wip-claim`
  - `GET /inventory/wip-kits/:id/qr-label` · `GET /inventory/wip-pieces/:id/qr-label`
- Task complete creates READY kits (photos → pieces, materials overage notes, stage-bin location) when `PRODUCES_SEMI_FINISHED`
- Photo gate uses `expectedPieceCount`
- Task start requires WIP claim when prior kits feed the stage
- Scheduling readiness: lots + kit status (`assessWipKitsReady`)
- Inventory `by-code` resolves kit/piece/lot QR to semi SKU (transfers/counts scan path)
- Admin semi-finished tab: stage-section WIP board, kit detail (print kit/piece QR, assign bin), ensure stage bins
- Mobile: camera `CodeField` claim sheet; semi inventory WIP board with on-screen QR + print; PDF helpers
- Setup: `expectedPieceCount` persisted on product stage outputs; photo stages default toward produce-semi on node add

## Factory loop

1. Carpentry worker finishes with N photos → kit card under Carpentry + kit QR (+ stage bin)
2. Board shows order card → detail (pieces, QR, overage, bin) → print labels
3. Assembly worker taps start → camera-scan kit QR → claim → work
4. Consume marks kit CONSUMED; schedule sees WIP ready

## Ready checklist

- [x] Camera scan on claim
- [x] Kit + piece label PDF
- [x] SEMI stage-bin locations (auto on register + ensure + assign)
- [x] Mobile WIP board + QR
