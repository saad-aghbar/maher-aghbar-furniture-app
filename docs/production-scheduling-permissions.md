# Production Scheduling — Permissions

## New codes

| Code | Who | Purpose |
|---|---|---|
| `schedule.read` | Admin/ops | Read calendar, conflicts, at-risk |
| `schedule.manage` | Admin/ops | Generate, move, pin, recalculate |
| `schedule.approve` | Admin | Commit proposed schedule |
| `schedule.override` | Admin (elevated) | Force warning/conflict with reason |
| `schedule.settings.manage` | Admin | Factory calendar + scheduling settings |
| `schedule.capacity.read` | Admin | Capacity/resource view |
| `schedule.availability.own` | Dealer | Call availability for own cart/order |
| `schedule.read.own` | Dealer | Read own order schedule/promise |
| `schedule.request-change.own` | Dealer | Update preferred date / change request |

Workers: **no** schedule calendar permissions. Planned fields arrive via existing `production-task.read` / `update-own`.

## Enforcement

- Controllers use `@RequirePermissions` / ownership scopes — never role-string checks
- Dealer endpoints filter by `customerId` of actor
- Availability responses strip internals
- Override requires permission + explicit reason + audit

## Role grants (seed)

- ADMIN / PRODUCTION_MANAGER: all schedule.* except dealer-own (or all)
- SALES (if needed): schedule.read
- CUSTOMER / dealer roles: availability.own, read.own, request-change.own
- PRODUCTION_WORKER: none of schedule.*
