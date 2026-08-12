# Production Scheduling — Test Plan

## Unit

- Working calendar: TZ, weekends, holidays, breaks, overtime windows
- DurationCalculator: all scaling modes
- Dependency graph: cycle detection, parallel C∥D, merge waits
- Priority + fairness sort stability
- Forward / backward planner
- Validator VALID/WARNING/CONFLICT
- Promise-state mapping
- Dealer change policy (pre-approval / change-request / locked)

## Integration

- 20 orders (Dealers A/B/C): no worker overlap, deps respected, overflow, deterministic
- Request 20 days out: backward placement, buffer, pending confirmation
- Impossible tomorrow: `requestedDateFeasible=false`, no committed lie
- Worker late / early: risk, replan future, preserve pinned/running
- Blocker MATERIAL_MISSING: delay dependents, keep independent branch
- Admin move: validate, version, audit
- Concurrency: no double-book; `409 SCHEDULE_STALE`
- Idempotency replay on generate/approve
- Dealer/worker security isolation
- Notification matrix (dealer date update → admin; approve → dealer; debounce)

## UI

- Admin schedule components
- Dealer availability + date change sheets (web + mobile)
- RTL ar/he + LTR en
- Permission-gated nav/actions

## Validation commands

`pnpm typecheck`, `lint`, `test`, `build`, `smoke:lifecycle`, Prisma validate/migrate, mobile typecheck/lint/tests, Expo Doctor, relevant E2E.

Label PRE-EXISTING vs INTRODUCED failures.
