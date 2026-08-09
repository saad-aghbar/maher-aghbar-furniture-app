# Mobile risk register

**Date:** 2026-08-05  
**Scope:** Risks for connecting an Expo/React Native client to the existing ERP monorepo.  
**Companions:** [mobile-audit.md](./mobile-audit.md), [mobile-api-gap-analysis.md](./mobile-api-gap-analysis.md)

Severity: **Critical** / **High** / **Medium** / **Low**. Likelihood: **H** / **M** / **L**.

---

## Security

| ID | Risk | Sev | Lik | Mitigation |
|----|------|-----|-----|------------|
| S1 | Mobile relies on cookies (`SameSite=lax`, host-only) | High | H if misbuilt | Use `client: 'mobile'` + Bearer + SecureStore; never depend on cookie jars for native |
| S2 | Refresh token rotation; reused refresh fails | Medium | M | Always persist rotated refresh; single-flight refresh; logout-all on reuse anomalies |
| S3 | Public signed download URLs (`GET /uploads/download?token=`) | Medium | M | Short TTL (900s default); treat tokens as secrets; avoid logging URLs; catalog images use long TTL — scope carefully |
| S4 | Password-reset tokens in process memory | High | M in multi-instance | Do not ship mobile “forgot password” against prod until Redis (or DB) store + email exist |
| S5 | Invite / reset tokens logged to console | Medium | H in shared logs | Redact; implement real email; never show `devToken` in production builds |
| S6 | Webhook Public endpoints | Medium | L | Shared secrets required; keep off mobile clients; rotate secrets |
| S7 | CORS `credentials: true` + origin allowlist | Medium | M for LAN | Native Bearer bypasses CORS; Expo web / WebView must allowlist origins; do not use `*` |
| S8 | Helmet CSP disabled | Low | L | API JSON only; monitor if serving HTML later |
| S9 | MFA optional; lockout 5 / 15m | Medium | L | Enforce MFA for admins in policy; mobile must send `mfaCode` |
| S10 | Throttle 120 req / 60s global | Medium | M on busy floor | Batch UI; backoff; avoid tight poll loops |
| S11 | JWT access 15m in SecureStore | Medium | M on jailbroken | Prefer hardware-backed SecureStore; clear on logout-all |
| S12 | Docs/security drift (Argon2 vs bcrypt) | Low | H confusion | Trust code (bcryptjs); update security docs separately |

---

## Performance

| ID | Risk | Sev | Lik | Mitigation |
|----|------|-----|-----|------------|
| P1 | Permissions loaded from DB every authenticated request | Medium | H | Accept for v1; cache only with careful invalidation if needed later |
| P2 | Notification / email / SMS providers run inline in API | Medium | M | Keep mobile UX async; avoid triggering heavy fan-out from chatty clients |
| P3 | Upload `memoryStorage` 15MB | Medium | M | Compress images client-side; reject video; consider streaming/S3 later |
| P4 | Notification list hard-capped at 50 | Low | H | Cursor pagination later; poll with backoff |
| P5 | Document list take 100 | Low | M | Filter by entity ids where possible |
| P6 | Worker BullMQ queues largely stubs | Medium | H if assumed async | Do not design mobile UX around worker completion events that never fire |
| P7 | Sync geo / reverse geocode on deliveries | Low | M | Debounce location patches |

---

## Product / completeness

| ID | Risk | Sev | Lik | Mitigation |
|----|------|-----|-----|------------|
| F1 | OCR/AI defaults to **mock** without keys | High | H | Feature-flag AI screens; require real providers for demos |
| F2 | Push register without delivery | High | H | Poll inbox; schedule push sender before promising alerts |
| F3 | `apps/mobile` removed; leftover hooks remain | Medium | H | Rebuild intentionally; reuse permissions/i18n/auth mobile mode |
| F4 | Cycle-count needs `inventory.count`; worker role lacks it | Medium | M | Custom role or extend seed before shipping scanner |
| F5 | Stale docs (`presign`, preferences, email login) | Medium | H | Prefer inventory/gap docs + OpenAPI |
| F6 | No Prisma `migrations/` folder — `db push` | High for prod ops | H | Adopt migrate workflow before multi-env mobile launch |
| F7 | `@maher/validation` login schema out of sync (email/phone vs username) | Medium | M | Validate against API DTOs; fix shared schema later |
| F8 | Thin automated tests | Medium | H | Add API contract tests for auth mobile mode + uploads before mobile GA |

---

## Operational / connectivity

| ID | Risk | Sev | Lik | Mitigation |
|----|------|-----|-----|------------|
| O1 | Physical devices need LAN IP; API binds `0.0.0.0` | Medium | H | Document `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:4000`; cleartext HTTP only on trusted LAN |
| O2 | TLS / `COOKIE_SECURE` / production HTTPS | High | M | Terminate TLS; use HTTPS API URL in EAS profiles |
| O3 | Docker compose launch has no mobile service | Low | H | Expected; mobile is separate Expo process |
| O4 | CI has no mobile job (removed with app) | Medium | M | Re-add typecheck when `apps/mobile` returns |
| O5 | Pre-existing lint failure blocks `pnpm lint` | Medium | H today | Unused `Body` import in `low-stock-pr.webhook.controller.ts` (see audit verification) |
| O6 | MinIO optional; local disk uploads | Medium | M | Shared storage required if API and workers scale out |

---

## Residual acceptance for a first Expo slice

Acceptable for an internal pilot if:

1. Bearer + SecureStore auth with `client: 'mobile'`
2. Polling notifications (no push promise)
3. Compressed photo uploads ≤15MB
4. AI intake clearly labeled mock unless providers configured
5. Roles explicitly include any inventory-count features

Do **not** accept for external customer GA without durable password reset, TLS, push (or explicit “email/SMS only”), and migration-based DB deploys.
