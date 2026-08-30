# Piece 13 Mobile UX UAT Report

API: http://localhost:4000
Result: **PASS** (20/20)

## Notes
- This smoke proves **navigation/action wiring** via API surfaces mobile depends on.
- It is **NOT** a visual/handset pass. HANDSET VISUAL = PENDING.

## Steps
- PASS 1. admin login — status=201
- PASS 2. GET management-summary 200 — status=200
- PASS 3. Home Attention cards have why+action — count=12
- PASS 4. GET sales-orders 200 — status=200
- PASS 5. GET sales-order detail 200 — id=2d3032be-a42d-4ace-b0dd-b58226892f65
- PASS 6. GET production-orders 200 — status=200
- PASS 7. GET inventory items 200 — status=200
- PASS 8. Finished / SEMI board endpoint reachable — finished-lots status=200
- PASS 9. Quality inspection task list reachable — status=200
- PASS 10. GET returns 200 — status=200
- PASS 11. dealer oasis login — status=201
- PASS 12. GET dealer-home 200 — status=200
- PASS 13. dealer denied management-summary — status=403
- PASS 14. dealer GET sales-orders 200 — status=200
- PASS 15. dealer GET invoices 200 — status=200
- PASS 16. dealer GET returns reachable — status=200
- PASS 17. worker carpenter login — status=201
- PASS 18. worker GET mine tasks reachable — status=200
- PASS 19. worker denied management-summary — status=403
- PASS 20. sample SO status is enum (UI maps via presentStatus) — status=READY_FOR_PRODUCTION
