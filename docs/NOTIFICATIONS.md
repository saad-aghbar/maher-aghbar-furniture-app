# Maher ERP notifications — implementation report

Date: 2026-09-14

Slices 1–7 are implemented on one pipeline:

**Catalog topic → persist success → `NotificationsService.emit` → inbox row + outbox → Expo push (when a deliverable device token exists).**

There is no second notification mechanism.

| Slice | Scope | Status |
|---|---|---|
| 1–4 | Catalog, inbox, outbox, device tokens, prefs, privacy, eventId, cold start | Complete (see earlier slice notes in 5/6 docs) |
| 5 | Factory DAG handoff / QC / packaging / delivery-ready | Complete — `docs/NOTIFICATIONS_SLICE_5.md` |
| 6 | Purchasing, inventory, fabric, returns, finance, scheduling | Complete — `docs/NOTIFICATIONS_SLICE_6.md` |
| 7 | IAM, permission catalog, staff presets, nav/gates, eligibility, persona matrix | Complete — `docs/NOTIFICATIONS_SLICE_7.md` |

## IAM (Slice 7)

| Topic | When | Who |
|---|---|---|
| `user.invited` | User created active | `user.manage` staff + affected user extra |
| `user.deactivated` | Account set inactive (and delete-before-archive) | Same. Sessions + push tokens revoked after emit |
| `user.roleChanged` | Staff type / role ids actually changed | Same. Next `/me` and topic GET follow DB permissions |

Push copy never includes passwords, PINs, MFA, reset tokens, permission matrices, or admin reasons.

## Eligibility

`topic.permission` is a live `@maher/permissions` code. Preference sheet lists `eligibleTopicsForUser` only. `PUT` of an ineligible topic is **400 `TOPIC_NOT_ELIGIBLE`**. Stored preference rows cannot outrank eligibility.

`SYSTEM_ADMINISTRATOR` is eligible for every catalog topic via explicit role grants (all codes except `quotation.accept`), not a `*` bypass.

## Dead catalog entries (documented, not revived)

`schedule.awaitingApproval`, `schedule.replanProposed`, `pr.rejected`, `payment.failed`, `inventory.correctionPending`.

## Local validation

Demo password `123`. API `http://127.0.0.1:4000/api/v1`. Do not `demo:reset`.

Proof (2026-09-15): persona topic sets, ineligible preference **400**, IAM inbox copy, Warehouse→Finance topic swap, deactivate **401**. Details in `docs/NOTIFICATIONS_SLICE_7.md`.

iOS Simulator has no Expo push token in this Personal Team environment. **APNs lock-screen banners were not claimed.**

Physical-device attempt: [NOTIFICATIONS_PHYSICAL_PUSH_UAT.md](NOTIFICATIONS_PHYSICAL_PUSH_UAT.md) (2026-09-15, second run). iPhone 15 Pro Max **USB connected**; on-device `0.1.0` (2) is Personal Team **without** `aps-environment`. EAS still has **no iOS IPA** (no Apple team / internal credentials). `DevicePushToken` empty; outbox all `SKIPPED` / `no_deliverable_device`.

## Verdict

Implementation (slices 1–7): complete on one emit/outbox pipeline.

Physical APNs / killed-app tap (2026-09-15): **NOTIFICATIONS NOT READY — PHYSICAL PUSH BLOCKERS REMAIN**

Do not treat lock-screen push as production-ready until [NOTIFICATIONS_PHYSICAL_PUSH_UAT.md](NOTIFICATIONS_PHYSICAL_PUSH_UAT.md) records a real iPhone banner and a killed-app tap PASS.
