# Piece 12 — Management dashboard tile map

API: **`GET /api/v1/reports/management-summary`** (`report.sales.read`).  
Admin web: `/dashboard` (fallback to `GET /reports/dashboard` on 404).  
Demo: **no new seed rows** — tiles aggregate existing P7–P11 (and earlier) factory-world data.

## Hierarchy (admin-web)

Attention → Today → Factory Flow → Production → Outbound → Materials → Money → Activity

## Tile → demo drivers

| Section / tile | Primary demo drivers | List / filter (COUNT=DATASET) |
|---|---|---|
| Attention — returns waiting | `RET-P11-G` WAITING_RETURN; `RET-P11-F` PENDING | `/returns?physical=WAITING_RETURN` |
| Attention — cancel / disposition | `SO-P11-C`, `SO-P11-L`, `SO-P11-D` | `/sales-orders` / cancel impact |
| Attention — quality fail / rework | `SO/PO-P9-C`, `SO/PO-P9-D` | `/quality?filter=waiting` or Quality attention |
| Attention — overdue pickup | `DLV-P10-D` | `/deliveries?section=attention` |
| Today — quality waiting | `SO-P9-A` Ready for Inspection | `/quality?filter=waiting` |
| Today — leaving today | `SO/DLV-P10-C` | `/deliveries?section=…` (planned today) |
| Today — finished / receiving | P10 finished lots + GRN from P6 | `/inventory?lifecycle=finished&scope=inWarehouse` |
| Factory flow — prepare / ready | P2/P3 needs planning / ready for factory | `/production` board buckets |
| Factory flow — in production | `SO/PO-P8-*` on floor | `/production` |
| Factory flow — quality / rework | P9-C/D | `/quality` |
| Factory flow — packaging / finished | P9-B packaging; P10-A FIN waiting | `/inventory?lifecycle=finished` |
| Outbound — finished waiting | `SO-P10-A` | `/inventory?lifecycle=finished&scope=inWarehouse` |
| Outbound — shipped awaiting dealer | `DLV-P10-G` | `/deliveries?section=shipped` |
| Outbound — overdue pickup | `DLV-P10-D` | `/deliveries?section=attention` |
| Materials — late / purchasing | Piece 6 PO / receiving stories | `/purchasing` |
| Materials — SEMI handoff blockers | `SO/PO-P8-*` Attention kits | `/inventory` semi board |
| Money — overdue vs account credit | P7 overdue invoices + **`SO/INV/PAY-P7-L` advance credit** | `/invoices?overdue=true` — credit never netted with overdue |
| Exceptions — returns open | `RET-P11-F…J` | `/returns` |
| Exceptions — inventory corrections | `SO-P11-K` cycle count / adjustment | inventory corrections |

## Notes

- Finance section omitted (`finance: null`) when caller lacks `report.financial.read`.
- COUNT on every tappable tile must match the filtered list/count API (or prisma count with the same predicate).
- Worker / dealer must receive **403** on management-summary.
