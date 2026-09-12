# Phase 8 — Per-worker labor rate

**Date:** 2026-09-12

Every floor worker can now carry a versioned hourly rate on their user record. Saving a new rate closes the open `LaborRate` row (`effectiveTo = now`) and inserts a new `userId`-scoped row, so past work still costs at the rate that was in effect then.

## Surfaces

- `CreateUserDto` / `UpdateUserDto` accept `hourlyRate`; `userSelect` presents the current open rate
- Admin-web employees modal and mobile Create / Edit user sheets show the field next to stage skills
- Seed and demo people backfill a placeholder 25 JOD/hour rate; `prisma/scripts/backfill-worker-hourly-rates.ts` does the same for a live database
- Cost & Performance Labor slot lists live worker rates (hours and labor money still wait for Phase 9)

## Tests

- Rate history: editing a rate closes the old row; `resolveHourlyRate` still returns the closed rate for a past `at`
- `user.manage` is required to create or update a user (and therefore a rate); dealers 404 on `cost/labor-rates`
- Create / Edit user sheet geometry and submit wires `hourlyRate`
