# Parity UAT fixture — 2026-10-12

Marker: `PARITY-UAT-20261012-receive-first`

Stored on the sales order external reference and notes, and on the task notes. System order numbers already in the factory were not changed. This order was added beside them.

| Record | ID | Number |
|---|---|---|
| Worker | `39de0b90-6b44-4113-bd99-848e28eb284b` | carpenter |
| Sales order | `0a66b971-b00c-4bc0-ab04-79a1114457cc` | SO-PARITY-UAT-20261012 |
| Line | `876e698d-fa1e-4817-96c3-d297392cbdaa` | A |
| Production order | `6a78d820-bd0a-4095-be43-944bf31091a2` | SO-PARITY-UAT-20261012.A |
| Task | `b740126f-3495-4a11-a245-694817de7bcf` | PT-PARITY-UAT-20261012 |
| Ready kit | `4145eb95-d558-4d13-ac60-318309e71e90` | WIP-PARITY-UAT-20261012 |

Starting state: foam task was READY and assigned to carpenter. The carpentry kit was READY and not received (0 of 1), so the task’s primary action was Receive first. A kit from another order, `WIP-SO-GOLDEN-001A-CARPENTRY`, was refused with “This QR belongs to a different production order” and was not consumed. That kit is still READY.

After one website receive as carpenter on 2026-10-12:

| Check | Result |
|---|---|
| Count before | 0 of 1, kit READY, task primary Receive first |
| Receipt | One handoff `c4885abc-f803-4484-a7e7-8c925c7f942a`, quantity 1, kit `4145eb95-d558-4d13-ac60-318309e71e90` |
| Count after | 1 of 1. Kit status CLAIMED. Incoming line RECEIVED |
| Task page | Primary action is Start task. Receive first is gone |
| Refresh | Still 1 of 1. No second handoff. No `wip-receive` on reload |
| Task | Still READY. `actualStart` and `actualCompletion` are empty. Not started or finished |
| SO-GOLDEN-001 | `WIP-SO-GOLDEN-001A-CARPENTRY` has no handoff from this task |

The additive script is `packages/database/prisma/scripts/parity-uat-receive-first.ts`. Running it again leaves this fixture in place. Do not receive the kit again.

The iPhone, signed in as carpenter Khaled, showed the same received state: 1 of 1, all pieces received, and Start task. That screen was not used to start the task.

Start, website, carpenter, 2026-10-12: the first Start click was refused with `INSUFFICIENT_SEMI_FINISHED_STOCK` because this order had a received kit and no semi-finished lot. One available lot was added on this order only: item `40d39482-ba8c-45ff-9cb6-fb89971435fe` (`SEMI-PARITY-UAT-20261012`), lot `f84a86db-f7ae-4ad6-9c37-c8719eb40f05`, quantity 1, warehouse SEMI. SO-GOLDEN-001 was not changed.

After that, Start was pressed once.

| Check | Result |
|---|---|
| Sessions before the successful start | 0. Task READY. Timer idle |
| Successful start | One POST. One open time entry `c08ece1c-ae27-4401-8978-f3af51150d31`, started 2026-10-12T10:46:13.147Z, not ended |
| Page | Status In progress. Timer Live. Stop timer and Hold to finish are shown. Start task is gone |
| Task | `IN_PROGRESS`. `actualStart` 2026-10-12T10:46:13.150Z. `actualCompletion` empty. Not finished |
| Refresh | Still that one open session. No second start POST. Timer still Live |
| SO-GOLDEN-001 | `WIP-SO-GOLDEN-001A-CARPENTRY` still READY |

The iPhone, still signed in as carpenter Khaled, showed this running state before the pause: In progress, timer Live at about five minutes, Stop timer and Finish task, no Start. Nothing was pressed on the phone.

Pause, website, carpenter, 2026-10-12: Stop timer was pressed once. The pause form did not ask for a reason.

| Check | Result |
|---|---|
| Before | One open session `c08ece1c-ae27-4401-8978-f3af51150d31`, started 2026-10-12T10:46:13.147Z. Task `IN_PROGRESS`. Timer running |
| After one Stop timer | Same session ended 2026-10-12T10:52:31.638Z, 6 minutes. No second session |
| Page | Status Paused. Timer Paused, elapsed 0h 6m. Resume task and Hold to finish are shown. Stop timer is gone |
| Task | `PAUSED`. `actualCompletion` empty. Not finished |
| Refresh | Still that one ended session. No pause, start, or resume POST. Status stays Paused |
| SO-GOLDEN-001 | `WIP-SO-GOLDEN-001A-CARPENTRY` still READY |

After that pause, the iPhone still signed in as carpenter Khaled showed the same task as Paused. The work stamp says Paused, not In progress. The timer reads 00:06:18 and Elapsed, logged 6m, and is not Live. Resume task is available. There is no Start. Resume, Start, Stop, and Finish were not pressed.

Resume, website, carpenter, 2026-10-12: Resume task was pressed once.

| Check | Result |
|---|---|
| Before | One session, ended. Task `PAUSED`. Open sessions 0 |
| After one Resume | Two sessions. Only one open |
| Ended session | `c08ece1c-ae27-4401-8978-f3af51150d31`, started 2026-10-12T10:46:13.147Z, ended 2026-10-12T10:52:31.638Z |
| New open session | `9be13f14-a594-452d-aac9-aa2cacc928eb`, started 2026-10-12T10:57:35.645Z, not ended |
| Page | Status In progress. Timer running. Stop timer and Hold to finish are shown. Resume is gone |
| Task | `IN_PROGRESS`. `actualCompletion` empty. Not finished |
| Refresh | Still two sessions, still one open. No resume, start, pause, or complete POST |
| SO-GOLDEN-001 | `WIP-SO-GOLDEN-001A-CARPENTRY` still READY |

Do not press Resume again.

The first Hold to finish was refused with `INSUFFICIENT_STOCK` and did not consume the lot. The warehouse available quantity was 0 while the lot quantity was 1.

Stock receipt, admin, 2026-10-12: the finish issue needs quantity 1 of `SEMI-PARITY-UAT-20261012`. Before the receipt the warehouse balance was 0 and the lot was quantity 1 available. One audited purchase receipt was posted: `INV-2026-00001` (`b1c9d798-f763-4fee-913e-c464df3380c3`), quantity 1, into warehouse SEMI. The balance became 1. The lot stayed quantity 1. SO-GOLDEN-001 was not changed. The stock guard was not changed.

Finish, website, carpenter, 2026-10-12: Hold to finish was used once.

| Check | Before finish | After finish |
|---|---|---|
| Task | `IN_PROGRESS` | `COMPLETED` |
| `actualCompletion` | empty | 2026-10-12T11:08:01.309Z |
| Sessions | 2, 1 open | 2, 0 open |
| Open session | `9be13f14-a594-452d-aac9-aa2cacc928eb` open | same session ended 2026-10-12T11:08:01.280Z |
| Ended session | `c08ece1c-ae27-4401-8978-f3af51150d31` ended 2026-10-12T10:52:31.638Z | unchanged |
| Lot `f84a86db-f7ae-4ad6-9c37-c8719eb40f05` | quantity 1, AVAILABLE | quantity 0, CONSUMED |
| Warehouse available | 1 | 0 |
| Semi issue | none | one movement `9e02e070-3d15-423c-9afc-9b62a02b86b7`, quantity -1 |
| Page | Hold to finish | Completed. Hold to finish is gone |
| Refresh | — | No complete, start, resume, or pause POST. Still 2 sessions, 1 issue, lot quantity 0 |
| SO-GOLDEN-001 | `WIP-SO-GOLDEN-001A-CARPENTRY` READY | still READY |

Do not finish this task again.

After that finish, the iPhone still signed in as carpenter Khaled showed the same task as Completed and view only. The work stamp says Completed. The timer reads 00:16:43 and Finished, not Live. There is no Start, Resume, Stop, or Hold to finish. No completion or timer control was pressed. Sessions stayed at 2 with 0 open, and the semi issue stayed at one.

After that resume, the iPhone still signed in as carpenter Khaled showed the same task as In progress. The work stamp says In progress. The timer reads 00:08:27 and Live, not the paused 6-minute clock. Stop timer is shown. Resume and Start are not shown. Stop, Resume, Start, and Finish were not pressed. Sessions stayed at two, with one open.
