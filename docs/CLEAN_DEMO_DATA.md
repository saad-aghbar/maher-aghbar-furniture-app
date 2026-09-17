# Clean deterministic demo data

Local / demo only. Never run `pnpm demo:reset` against production or staging with real business data.

## Safety guards

`packages/database/prisma/demo/env-guard.ts` refuses reset unless:

- `NODE_ENV` is **not** `production`
- Database host is loopback (`127.0.0.1` / `localhost` / `::1`)
- Database name is exactly **`maher_erp`**

## Reset

```bash
pnpm demo:reset
pnpm demo:validate
```

Pipeline:

1. Safety check
2. Foundation seed
3. Truncate operational tables (incl. notifications, outbox, push tokens, prefs, sessions, users)
4. Drop non-system custom staff types
5. Re-foundation + compact factory seed
6. Release fabric UAT for `SO-FB1042`
7. Validate + print cheat sheet

All demo passwords are **`123`** (local only — never copy to production).

## Accounts

| Username | Role / skill | Tests |
|---|---|---|
| `admin` | `SYSTEM_ADMINISTRATOR` (exactly one) | Full admin |
| `production` | `PRODUCTION_MANAGEMENT` | Production desk |
| `scheduling` | `SCHEDULING` | Calendar / capacity |
| `sales` | `SALES` | RFQ / quote / SO |
| `purchasing` | `PURCHASING` | POs / fabric procure |
| `warehouse` | `WAREHOUSE_MANAGEMENT` | Inventory / bins |
| `qc` | `QUALITY_CONTROL` | Office QC |
| `finance` | `FINANCE` | Invoices / statements |
| `delivery` | `DELIVERY_OPERATIONS` | Dispatch desk |
| `carpenter` | Worker · MATERIAL_PREP + CARPENTRY + ASSEMBLY | Floor tasks |
| `foam` | Worker · FOAM | Foam queue |
| `upholsterer` | Worker · UPHOLSTERY | Upholstery queue |
| `inspector` | Worker · INSPECTION | Floor QC tasks |
| `packer` | Worker · PACKAGING | Pack queue |
| `recovery` | Worker · DISMANTLE_RECOVER | Return recovery |
| `driver` | Worker · DELIVERY | Load / depart |
| `nile` | Dealer (`CUSTOMER`) | Dealer portal |
| `oasis` | Dealer (`CUSTOMER`) | Cross-dealer isolation |

Internal only (not on cheat sheet): `cost.unpriced` for incomplete labor costing.

## Flagship fixtures

| Code / name | What it tests |
|---|---|
| **SO-GOLDEN-001** · Golden factory path | 4 lines: STD qty2, KARINA STANDARD, MODIFIED, CUSTOM (`productId` null + photo). Live Dealer→RFQ→Quote→SO→Plan→Worker path (not fully costed). |
| **SO-COST-GOLDEN** | Cost twin: actual **294** / sale **630** / margin **336** (derived from issues + labor). |
| **SO-FB1042** | Fabric desk: Velvet 302 ready, Linen 180 allocated, Bouclé 611 waiting. |
| **RT-DEMO-001** | One return case: REPAIR / REPLACEMENT / SCRAP_RECOVERY. |
| **PORD-DEMO-LATE** | Late purchase order. |
| **PORD-DEMO-OPEN / PARTIAL / RCVD** | Open / partial / fully received POs. |
| **MAT-BEECH** | Low-stock wood. |

### Cost & Performance (A–J)

- Profit / low / loss: `SO-COST-PROFIT`, `SO-COST-LOW`, `SO-COST-LOSS`
- Partial / no rate: `SO-COST-PARTIAL`, `SO-COST-NORATE`
- Waste / rework: `SO-COST-WASTE`, `SO-COST-REWORK`
- Custom: `SO-COST-CUSTOM-A`
- Variants: `SO-COST-VAR-STD-1`, `SO-COST-VAR-KAR-1`, `SO-COST-VAR-XL-1`
- Dates via relative `costPeriodAnchors()` (today / week / month / older)

### Catalog

4 products · 7 variants:

- Model 204 (`SOF-3S-STD`): STD, KARINA, XL
- Luna Sofa (`SOF-LUNA`): STD, CORNER
- Classic Chair (`ARM-01`): STD
- Queen Bed (`BED-Q`): STD

### Inventory

RAW: Velvet 302, Linen 180, Bouclé 611, Beech, Pine, MD/HD foam, hardware kit.

Bins: `RAW-MAIN`, `SEMI-MAIN`, `FIN-MAIN`, `FABRIC-HOLD`.

Movements include receipt, issue, unused return (cost world), transfer (**not** consumption), adjustment, WIP/FIN, scrap.

### Finance

At least:

- Paid (Abdoun lounge)
- Partial (`Nile partial payment set`)
- Overdue/unpaid (`Oasis overdue bed`)

### Notifications / AI / auth

After reset:

- `Notification` = 0
- `NotificationOutbox` = 0
- `DevicePushToken` = 0
- Sessions empty; MFA off
- No AI extraction jobs

Notification UAT should create fresh events after reset.

### Scheduling

Relative dates from reset time (`demoAsOf` / `daysAgo`). Dead topics `schedule.awaitingApproval` / `schedule.replanProposed` stay `defaultOn: false`.

## Expected approximate counts

| Domain | Count |
|---|---|
| Admin | 1 |
| Dealer logins | 2 |
| Staff + workers | ~16 |
| Products / variants | 4 / 7 |
| Sales orders | ~8–25 |
| Purchase orders | 4 |
| Returns | 1 canonical |
| Invoices | 3+ |
| Notifications / push | 0 |

## Legacy paths

Do **not** use for presentation:

- `pnpm db:seed:demo` (deprecated — exits)
- Piece 1–14 / `DEMO_PIECES`
- `demo:nile-returns` / `demo:unique-floor` / factory-uat overlays

Launch empty ops: `pnpm db:seed` (admin + thin dealers, no factory flood).
