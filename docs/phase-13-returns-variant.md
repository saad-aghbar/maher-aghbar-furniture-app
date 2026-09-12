# Phase 13 — Returns carry the variant

**Date:** 2026-09-12

`ReturnRequest` and `ReturnPiece` copy `variantId` from the sales-order line. `specSnapshotFromLine` now includes variant sku/label. Dealer cards show the variant label. Recovery cost on Cost & Performance is grouped with the same variant id. Historical sales-order snapshots stay immutable.
