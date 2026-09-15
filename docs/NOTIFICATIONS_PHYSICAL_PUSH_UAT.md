# Maher ERP notifications — physical push UAT

Date: 2026-09-15 (second run, same calendar day as the first attempt)

Slices 1–7 remain complete (catalog → persist → `NotificationsService.emit` → inbox + outbox → Expo when a deliverable token exists). This session is **acceptance testing of the real APNs path only**. No topic, outbox, recipient, or permission architecture was changed.

Paired protocol: agent drove environment lock, EAS, DB inspection; a physical operator would install/tap. Lock-screen taps never started because no push-capable IPA exists.

## Environment lock (printed before any install/build)

| Check | Resolved value | Decision |
|---|---|---|
| Git SHA | `ab174672d2d9a2c8b599b300a8d4edc0321bc23e` (`main`) | Recorded. Working tree is **dirty** (uncommitted admin/mobile/api notification work). UAT is not of a frozen tag. |
| App version / build | `0.1.0` / iOS `buildNumber` `2` (`apps/mobile/app.config.ts`) | Remote EAS `appVersionSource` also initialized `buildNumber` 2 when the cloud build was attempted |
| Bundle ID | `jo.maheraghbar.furniture` | Correct project |
| Expo project | `@saad-aghbar/maher-aghbar-furniture` / `bd5ccf7c-9b99-4bc5-a0bc-2a52d781c023` | Correct project |
| EAS login | `saad-aghbar` (`saad.aghbari@gmail.com`; also owns `saad-aghbars-team`) | OK |
| EAS Apple teams | **none** (`eas device:list`: “No Apple teams found for account saad-aghbar”) | Cannot mint Ad Hoc / internal iOS credentials |
| EAS iOS builds | **none** | No IPA / TestFlight / development-device artifact to reuse |
| EAS Android | One `preview` build `9bb846dc-…` (2026-08-05) **errored** | Not usable |
| Local API | `http://127.0.0.1:4000/api/v1/health` → `"status":"ok"` | **Use this** (demo). Process listens on `*:4000` |
| Postgres | host `127.0.0.1:5432` database `maher_erp` | **Not production** |
| Mobile `.env` | `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000` | LAN rewrite for a real Maher native client, not Expo Go |
| Mac LAN | `192.168.1.15` (`en0`) | Phone would use `http://192.168.1.15:4000` via Metro host rewrite |
| Dev stack | API / admin-web / Metro **OK** on this Mac | Metro is the stack `expo start --host lan` (not a push substitute) |
| `eas.json` `development-device` | `http://localhost:4000` + `developmentClient: true` | Intended UAT profile. **Not started** as a successful cloud build |
| `eas.json` `preview` | `https://api.staging.maheraghbar.jo` | `dig` **no A/AAAA**. Do not build/install preview |
| `eas.json` `production` | `https://api.maheraghbar.jo` | `dig` **no A/AAAA**. **Did not** start a production build |
| `EXPO_ACCESS_TOKEN` | **unset** on API process env and repo `.env` | Expo send still works at low volume; set before production traffic |
| `APPLE_TEAM_ID` | unset → Personal Team `NR2ZFUP7R7` | Local `expo run:ios` **strips APNs** (`stripIosPush`) |
| Apple signing (this Mac) | `Apple Development: may.love.saad@icloud.com (P5M8AG468T)` | Personal Team identity only |
| Physical iPhone | `Sa69aD iPhone` · iPhone 15 Pro Max (`iPhone16,2`) · iOS **26.6.2** · UDID `00008130-001924A02651001C` | **USB connected** this run |
| App already on phone | `Maher Al-Aghbar Furniture` `0.1.0` (`2`) | Local Personal Team install. Provisioning entitlements: **no `aps-environment`**. **Must not** be used as the UAT client |
| Second device | `Sa69aD iPad` iPad 10th gen (`iPad13,18`) iOS 18.5 | **unavailable**. Multiple-devices = NOT TESTED |
| Expo Go | Not used | Forbidden for this UAT |

**Production-safety stop:** preview/production API hostnames still have no DNS. Testing would have used only the local demo API/DB. No production dealer/customer messages were sent.

**Push-capability stop:** EAS `development-device --platform ios`:

1. `--non-interactive` → `EAS CLI couldn't find any credentials suitable for internal distribution`.
2. Interactive → encryption prompt answered **yes** (could not write `ITSAppUsesNonExemptEncryption` into dynamic `app.config.ts`; left unchanged — not a notification-catalog change). Then **Apple ID login required**. No Apple password was entered from this agent.
3. Expo account has **no Apple team**, so it cannot generate a push-capable internal provisioning profile / APNs key.

Local Personal Team profile `iOS Team Provisioning Profile: jo.maheraghbar.furniture` entitlements are only `application-identifier`, team id, `get-task-allow`, keychain groups — **no `aps-environment`**. Per freeze rules, Expo Go and this Personal Team binary were **not** used as substitutes.

`demo:reset` was **not** run.

## BUILD (as far as it exists)

| Field | Value |
|---|---|
| SHA | `ab174672d2d9a2c8b599b300a8d4edc0321bc23e` (dirty tree on top) |
| App version | `0.1.0` |
| Build number | `2` (config + on-device Personal Team app; **not** an EAS IPA) |
| EAS profile / channel | **N/A — no iOS artifact**. Intended: `development-device` |
| Device | Sa69aD iPhone 15 Pro Max, iOS 26.6.2 — **online**, wrong binary |
| API environment | Local demo `127.0.0.1:4000` / `maher_erp` (phone LAN `192.168.1.15`) |
| Expo push token | **None.** `DevicePushToken` table is empty. No token prefix to record |

## Pipeline proof that is **not** lock-screen UAT

Local demo outbox (same worker that would call Expo):

| Metric | Value |
|---|---|
| `NotificationOutbox` rows | 291 |
| Status | **all `SKIPPED`** |
| `lastError` | **all `no_deliverable_device`** (unchanged this session) |
| `expoTickets` | all null |
| `DevicePushToken` rows | **0** (re-checked after environment lock; abort token-bind) |

Dispatcher behavior (`PushDispatchWorker`): claim outbox → list deliverable tokens → if none, skip. Business persist is already done. This matches “no push = no business failure” **for the skip path**, not for Expo HTTP / APNs failure.

First-login / OS permission / unique token bind: **not started**. There is no push-capable client that can call `getExpoPushTokenAsync` and `POST /notifications/device-token`.

Slices 1–7 inbox/API UAT on this demo DB still stand. They do **not** count as physical push.

## TESTS

| Test | Result |
|---|---|
| Foreground (open app, real push) | **NOT TESTED** |
| Background banner + tap | **NOT TESTED** |
| Killed-app tap-through | **NOT TESTED** |
| Logged-out cold start + pending intent | **NOT TESTED** |
| Account switch (Worker A → B, same phone) | **NOT TESTED** |
| Dealer privacy (lock-screen + factory-only suppression) | **NOT TESTED** |
| Worker task.ready tap | **NOT TESTED** |
| QC / rework lock-screen | **NOT TESTED** |
| Packaging / delivery-ready vs FIN posted | **NOT TESTED** |
| Purchasing (PO late / fabric) | **NOT TESTED** |
| Warehouse eligible vs invoice/cost | **NOT TESTED** |
| Finance invoice.overdue / payment.received | **NOT TESTED** |
| Preference off then new eventId | **NOT TESTED** |
| Device master “Deliver to this phone” off | **NOT TESTED** |
| iOS Settings permission denied + Settings CTA | **NOT TESTED** |
| Role change Warehouse → Finance on device | **NOT TESTED** |
| Deactivation + token disable on device | **NOT TESTED** |
| Invalid token prune (`DeviceNotRegistered`) | **NOT TESTED** (code path exists in worker; no APNs receipts) |
| Multiple physical devices | **NOT TESTED** (iPad unavailable; not faked) |
| eventId idempotency on real push | **NOT TESTED** |
| EN lock-screen copy | **NOT TESTED** |
| AR lock-screen copy | **NOT TESTED** |
| HE lock-screen copy | **NOT TESTED** |
| Badge / unread | **NOT TESTED** |
| Push vs inbox same semantic event | **NOT TESTED** |
| Network interrupt of dispatcher | **NOT TESTED** |
| Expo outage / transport fail vs business tx | **NOT TESTED** (skip-without-token only) |

No test is marked PASS. None is FAIL against a physical banner (the chain never reached APNs).

## Defects

No BLOCKER/HIGH/MEDIUM/LOW **product** defects were demonstrated by physical push testing. Testing did not start.

Infrastructure blockers (must clear before a re-run; **not** notification-catalog work):

1. **No push-capable iOS binary** — zero EAS iOS builds; Expo account has **no Apple team**; local Personal Team profile has **no `aps-environment`**.
2. **EAS internal-distribution credentials missing** — cloud `development-device` iOS stops at Apple ID / credential setup. Agent did not submit an Apple password.
3. **No `DevicePushToken`** — dispatcher cannot call Expo (`no_deliverable_device`).
4. **Paid Apple Developer team + APNs key on EAS** still not linked (`APPLE_TEAM_ID` unset; EAS Apple teams empty).
5. **Do not use** `preview`/`production` EAS profiles until real non-production HTTPS APIs exist (hosts still have no DNS). Correct UAT API remains local/LAN demo.
6. On-device `0.1.0` (2) is the **APNs-stripped** Personal Team client. Opening it would not satisfy this UAT.

Suggested re-run (operators):

1. Enroll / link a **paid** Apple Developer team on Expo (`eas credentials` / Apple ID) with Push Notifications + the device UDID.
2. From `apps/mobile`: `npx eas-cli build --profile development-device --platform ios` (keep `EXPO_PUBLIC_API_BASE_URL` on LAN demo, not `api.maheraghbar.jo`).
3. Install that IPA (not Expo Go, not the current Personal Team build).
4. Same Wi‑Fi as `192.168.1.15`; API `:4000`; Metro `--dev-client`.
5. Login `admin` / `123` → grant notifications → confirm `device_push_tokens` row (token **prefix** only in git).
6. Then execute freeze checklist §7–35 (foreground, background, **killed-app tap**, account switch, personas, prefs, IAM, locales).

Known client risk to watch on that re-run (not fixed here — not demonstrated on a real banner): `decideNotificationOpen` **drops** live taps while `unauthenticated`; killed-app logged-out depends on `getLastNotificationResponseAsync` rehydrate.

## Fixes this session

None. Freeze rules: only fix defects shown by physical push. None were shown.

Automated regression after a push fix: **not run** (no code fix).

## Verdict

**NOTIFICATIONS NOT READY — PHYSICAL PUSH BLOCKERS REMAIN**
