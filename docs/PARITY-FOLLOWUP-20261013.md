# Focused parity follow-up — 13 October 2026

This follow-up addresses important workflow regressions while leaving the full parity plan open.

## Fixed

- **Factory release deadlock.** The factory-release method contained an unconditional refusal for unreleased work. Mobile Confirm also required the plan to be released already, despite released plans becoming non-editable. Restored the validated release transaction and removed the circular mobile prerequisite. Release records the marker, audit and stage unlock; it does not start a task/timer or mark a fresh order In progress. Existing readiness requirements remain enforced, material shortage stays advisory for release, and legacy on-floor records remain compatible.
- **Visible release action.** Web now offers the translated Release to factory action only to permitted staff, gated by server readiness. Released work no longer offers the redundant Start production action. Confirm saves a supplied production date without silently applying a suggested schedule over manual task windows. The success message describes release accurately.
- **Item navigation.** Production hub's plan link now preserves salesOrderLineId. An unreleased WAITING_FOR_MATERIALS order now routes to preparation; the same status with release evidence still routes to the factory order.
- **Completed worker history.** Loads every page instead of silently showing only the first 100 tasks. Old-running-API compatibility is restricted to a validation failure specifically rejecting salesOrderId, including the API's fieldErrors envelope. Authentication, server and later-page failures propagate to the error UI rather than becoming partial/empty history. Parent filtering remains explicit.
- **Phantom open tasks.** Missing-task preparation now passes stage status and excludes COMPLETED/SKIPPED stages. It cannot create new NOT_STARTED tasks on already finished stages. This prevents a mechanism that can produce the mismatch described in the handoff; it does not establish the historical cause of that existing fixture record.

## Verification actually performed

- Regression test first reproduced the factory-release refusal before the correction.
- Web full suite: **37 files, 159 tests passed**.
- Focused API suites: release, readiness, factory-release projections and missing-task preparation; **4 files, 32 tests passed**.
- Web, API and mobile TypeScript checks passed.
- Diff whitespace check passed. Focused code review checked permissions, caller semantics, legacy release, soft stock warnings, item identity, pagination and error propagation against pre-edit copies. This was not a review of every pre-existing change.
- Actual browser: signed into the local admin portal; opened SO-FB1042.A; verified Release to factory disabled with the assignment/date explanation; opened More → Production plan and verified the exact parent and lineId destination. No release, assignment, schedule Apply, stock, timer, delivery or payment action was submitted.

## Runtime limitation and remaining work

The API process runs compiled dist code. It was not rebuilt/restarted during this pass, so the API release and missing-task fixes, as well as the salesOrderId filter, require the next normal API build/restart to become live. Mobile was typechecked; no new native-device execution is claimed. Metro and the phone were not restarted or deliberately reloaded.

The historical UAT carpentry stage/task mismatch and eight delivered records lacking customer-confirmation timestamps were not rewritten. The handoff does not supply sufficient evidence to invent receipt timestamps or safely reconstruct execution history. Any repair needs the plan's backed-up, evidence-based process.

Still unverified: complete route/control coverage, reports walkthrough, all U01–U16 journeys, physical-device checks and the second full project review. Chatbot remains intentionally excluded. No business-data repair, reset, reseed, external message or deployment was performed. The canonical plan remains open.
