# Task Details RAW vs SEMI layout — closure report

Generated: 2026-08-26T10:10:08.797Z
API: http://localhost:4000

## Acceptance scoreboard

| Check | Result |
|-------|--------|
| RAW/SEMI SEPARATION | PASS |
| INCOMING SEMI HANDOFF | PASS |
| OUTPUT SEMI | PASS |
| PARTIAL HANDOFF | PASS |
| QR HANDOFF | PASS |
| WRONG ORDER QR | PASS |
| CUSTODY TRACEABILITY | PASS |
| PARALLEL PREDECESSORS | PASS |
| FINISH VALIDATION | PASS |
| RAW STOCK REGRESSION | PASS |
| FIN/QC REGRESSION | PASS |
| REAL HANDSET | NO |

**UI layout** (RAW card + one SEMI card with Incoming / Your Output) ships in mobile Task Details. REAL HANDSET remains NO until exercised on a physical device.

Live steps: see `production-wip-physical-handoff-closure-report.md`.
