# Dealer order editing rules

Dealers edit **Requests for Quotation (RFQ)** after submission — not sales-order cost fields.

## Rules (server-authoritative)

1. **3-day window** — After `submittedAt` (falls back to `createdAt` for legacy rows), dealers may edit permitted fields for **3 days**. `DRAFT` / `NEEDS_INFORMATION` stay editable without the window.
2. **Countdown** — `GET /requests/:id` returns `editPolicy` with `serverNow`, `editWindowEndsAt`, `remainingMs`. Mobile countdown anchors on `editWindowEndsAt` (not the device clock for authorization).
3. **Full lock** — After the window, updates return **409** `{ code: 'ORDER_LOCKED' }`.
4. **Fabric production lock** — If linked production is in upholstery/assembly/packaging (or progress ≥ 40%), fabric fields lock immediately. Updates that change fabric return **409** `{ code: 'FABRIC_LOCKED' }`.
5. **Backend enforces every rule** — Client flags (`forceUnlock`, `canEdit`, `serverNow`, etc.) are rejected.
6. **UI explains locks** — Locked fields use muted styling + reason text from `editPolicy.lockReasons` / API error messages.
7. **Notes / dimensions** — While fabric is locked but the edit window is open, notes and dimensions may still be updated; fabric values are preserved server-side.

## Audit

Accepted dealer updates write `audit_events` with `action: request.update` (and `request.submit` on submit), including before/after snapshots and server timestamp.

## Key code

- Policy: `apps/api/src/modules/requests/dealer-edit-policy.ts`
- Enforcement: `RequestsService.update` / `submit` / `getById`
- Tests: `apps/api/src/modules/requests/__tests__/dealer-edit-policy.spec.ts`, `requests.update-dealer-edit.spec.ts`
- Mobile: `EditRequestScreen`, route `/(app)/(customer)/requests/[id]`
