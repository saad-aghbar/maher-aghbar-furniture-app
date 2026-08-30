# Production WIP physical handoff — closure report

Generated: 2026-08-26T10:10:08.796Z
API: http://localhost:4000
Tag: WIP-HANDOFF-UAT

## Scoreboard

| Result | Count |
|--------|------:|
| PASS | 15 |
| FAIL | 0 |
| **Verdict** | **PASS** |

## Steps exercised

- [x] admin login — status=201
- [x] Material Prep does not require SEMI claim — task=TSK-2026-00026 required=false
- [x] Incoming work board loads — lines=1
- [x] Eligible kits endpoint — kits=1
- [x] Wrong PO QR rejected — status=400 code=WIP_ORDER_MISMATCH
- [x] Finish blocked without full receive — status=400 code=WIP_CLAIM_REQUIRED
- [x] Partial receive accepted — status=201 qty=1 code=
- [x] Over-receive rejected — status=400 code=WIP_NOTHING_TO_RECEIVE
- [x] Remainder receive / choose-by-id — already fully received after partial
- [x] Start gate clears after receive — allReceived=true
- [x] Kit timeline includes receive events — events=2
- [x] Incoming DTO has display fields — output=Wingback Chair your=PACKAGING
- [x] RAW materials list excludes SEMI — task=TSK-2026-00026 lines=4 leaked=false
- [x] Semi board custody filter — total=50
- [x] Scheduling produced-lot readiness (READY kits present) — readyKits=50

## Notes

- Scheduling readiness remains **produced-lot / READY kit** based (receive not required to plan).
- Task **Start** and **Finish** require physical **receive** coverage for consuming stages.
- Material Prep / non-consuming stages must not demand SEMI scan.
- RAW materials list is itemClass-filtered (no SEMI leak).
- Live UAT: `pnpm smoke:production-wip-handoff-uat`


