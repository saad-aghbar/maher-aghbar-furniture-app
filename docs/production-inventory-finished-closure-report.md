# Production inventory — FINISHED goods closure report

**Date:** 2026-08-24 · **Scope:** Phase B (FIN + truck leave)

## Verdict

**PASS** — Finished lots exist only after QC + packaging / `PRODUCES_FINISHED`; READY_FOR_DELIVERY is backed by FIN in factory; truck leave issues stock on `OUT_FOR_DELIVERY`; `DELIVERED` does not double-issue.

## What shipped

| Item | Result |
|---|---|
| FIN lot + `FINISHED_GOODS_RECEIPT` with PO/SO identity | PASS |
| Balqis: FIN RESERVED while delivery PLANNED | PASS |
| Nile historical: FIN receipt then `DELIVERY_ISSUE`; 0 FIN left | PASS |
| Oasis QC hold: no deliverable FIN | PASS |
| Issue event = `OUT_FOR_DELIVERY` (not DELIVERED) | PASS |
| Days waiting + aging buckets on `GET /inventory/finished-lots` | PASS |
| Admin Finished tab = finished lots (waiting for truck) | PASS |
| Mobile finished lifecycle uses finished lots | PASS |

## Evidence anchors

- `apps/api/src/modules/deliveries/deliveries.controller.ts` — issue on OUT_FOR_DELIVERY
- `InventoryService.listFinishedLots`
- UAT cases **D, E, F, G, H, O**

## Remaining gaps

- Partial FIN while QC is all-or-nothing remains blocked by design (`PARTIAL_FINISHED_REQUIRES_QTY_QC`).
- Logistics reverse after departure uses existing restore path only.
