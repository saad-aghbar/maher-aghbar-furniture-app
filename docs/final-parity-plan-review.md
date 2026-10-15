# Second review of the final parity and workflow plan

Reviewed 12 October 2026. This is a second self-review of the complete planning artifact, including all 20 sections and appendices A–D. It is not an independent audit and does not certify the application as fixed or fully tested.

Primary artifact: [final implementation plan](/Users/saadaghbar/maher-aghbar-furniture-app/docs/FINAL-WEB-MOBILE-PARITY-AND-WORKFLOW-PLAN.md).

Companion ledger: [all route entries](/Users/saadaghbar/maher-aghbar-furniture-app/docs/final-parity-route-inventory.csv).

## Requirements coverage review

| User requirement | Where the plan satisfies it | Review outcome |
|---|---|---|
| Detailed implementation handoff | Copyable opening instruction, settled decisions, source map, ordered phases and completion gates | Covered. |
| Page-by-page and control-by-control comparison | Complete source-route inventories; mandatory mounted-control/state ledger; shared-shell/modal coverage; module checklists | Covered as implementation requirements. Exhaustive runtime inspection remains implementation work. |
| All roles and relevant pages | Admin/staff/dealer/worker/inspector/packer/driver scope, permission matrix requirements, actual public/auth entry behavior | Covered. |
| Confusing extra web pages | Canonical route architecture, concrete dispositions, compatibility/context rules and justified specialist tools | Covered without removing supported capabilities blindly. |
| Parent orders, suborders, planning and production | Stable relation identity, line editor, item board, distinct lifecycle boundaries and release/readiness rules | Covered with regression cases. |
| Workers offered work they cannot do | Authoritative per-action capability contract; Work now versus My orders; specific waiting reasons; mutation enforcement | Covered. User's delegated choice is implemented consistently. |
| Current local data | Observed snapshot, whole-dataset audit, tested backup, narrow dry-run/idempotent repair and UI verification | Covered. Existing legacy/waiting states are not presumed corrupt. |
| Frontend completion | Visible page/action outcomes in every work phase; real controls, errors, responsive and state behavior | Covered; backend changes alone cannot close the plan. |
| Preserve aesthetic | Separate web/mobile visual contracts, before/after verification and current component reuse | Covered. |
| Dashboard differences allowed | Explicit exception in opening instruction, decision table, visual rules, navigation and report testing | Covered; functional links/data still tested. |
| Actual testing beyond terminal | Browser/native/device matrix, real action assertions, counterpart-client/persistence verification and no silent skips | Covered with an explicit unavailable-device gate. |
| Full order examples may stay in data | Sixteen registered retained UAT scenarios, additive markers and a 19-step full order walkthrough | Covered without database reset. |
| Review everything again | P08 and section 19 repeat the complete route/control/data review after final changes | Covered; this file records the separate review of the plan itself. |

## Source and structural validation

Validated against the current repository tree:

- 145 locale web page files plus the non-locale root: 146 web ledger records.
- 146 mobile non-layout route files: 131 existing-manifest mappings, one root and 14 developer-only entries.
- 292 ledger records total, with unique IDs. Every ledger source path exists.
- Exact set equality between the ledger source paths and both current route trees; no source route omitted or duplicated.
- All 292 route IDs also appear in the plan's appendices.
- 25 distinct manifest target strings lack an exact current page pattern; each has an explicit proposed resolution. Equivalent dynamic parameter names are not treated as proven missing pages.
- Nine implementation phases P00–P08, 16 UAT scenarios U01–U16, 19 primary walkthrough steps and 12 finding/investigation records F01–F12.
- Markdown table shapes, internal navigation anchors and code-fence pairing checked.
- All runtime-parity ledger statuses remain unverified. None were promoted to passed by route enumeration or source inspection.
- Ledger rows include plan-section/scenario references and blank evidence, defect and final-retest fields for implementation. These references guide coverage; they do not replace expanding each route into its real controls.

## Consistency traps checked

| Potential planning mistake | Resolution in final plan |
|---|---|
| Treat all legacy links as broken | Records a successfully followed admin legacy redirect and separately records the reproduced dealer 404. |
| Treat setup RELEASED as factory execution | Explicitly separates preparation confirmation, factory release and task start. |
| Treat every material warning as a release prohibition | Preserves soft release advisories and action-specific hard material/WIP requirements. |
| Treat every blocker as hard | Distinguishes advisory records from hard BLOCKED state and per-action reasons. |
| Hide all waiting assignments | My orders retains appropriate waiting assignments; Work now only presents available actions. Upcoming work remains discoverable. |
| Use first child/index when IDs do not resolve | Requires stable parent/line/PO relationships and an explicit invalid-selection response. |
| Factory completion means customer delivery | Requires actual dispatch/receipt facts and correct per-line/parent aggregation. |
| Missing old release marker means unreleased | Preserves evidence-backed legacy execution compatibility; forbids blind status resets. |
| Different counters must always be identical | Requires declared units/scope and reconciliation; does not conflate parents, POs and tasks. |
| Multiple active tasks imply invalid worker data | Preserves actual concurrency policy and checks running sessions per task. |
| Read-only refetch can initialize work repeatedly | Separates reads from authorized idempotent initialization mutations. |
| A source route equals a whole feature | Includes shared shells, sheets, conditional controls and runtime state branches. |
| QC/packaging can use generic Finish | Requires the actual quality and label-confirmation paths. |
| Tests pass if fixtures are absent | Required fixture absence fails; no guarded silent scenario skips. |
| Mobile viewport testing proves native behavior | Native iOS/Android and relevant physical-device checks remain explicit gates. |
| Big project means reset current data | Requires backup, narrow evidence-based repairs and additive retained examples. |
| Passing terminal tests means project completion | Runtime/control/data/device gates and the second complete review remain mandatory. |

## Improvements made during the second review

The review added explicit coverage of shared shells and error boundaries, task progress/notes/problem resolution/carry-over, fabric disposition and worker order deep links that cannot depend solely on an Open-list cache. It added the capability-contract implementation order and the existing task read endpoints requiring consistent projections. It clarified that every U01–U16 scenario must pass the full-validation phase.

Browser verification also confirmed that a full reload corrected the stale worker identity to the dealer identity, strengthening the account-cache diagnosis. The plan records this observation without claiming all account data leaked or all security behavior failed.

## Planning status versus implementation status

The planning artifact and its coverage/consistency review are complete and ready for handoff. Application implementation, exhaustive native/browser/control testing, local data repair and retained fixture execution have not been performed by this planning task.

Actual planning checks included representative read-only browser exploration, read-only local database queries, 116 passing web tests across 28 files, and a passing web TypeScript check. These results are baseline evidence only. No native/device pass, complete end-to-end pass, data repair or production deployment is claimed.
