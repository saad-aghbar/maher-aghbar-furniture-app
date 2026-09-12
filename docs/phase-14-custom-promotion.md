# Phase 14 — Custom order to catalog promotion

**Date:** 2026-09-12

`POST /products/from-order-line/:lineId` and `POST /products/:id/variants/from-order-line/:lineId` copy `orderSpec` plus production-setup materials into a new catalog product or variant, including dims, orientation, included items, and option-library links. The sales-order line snapshot is never mutated. The new catalog row starts inactive so factory review can finish names and prices. Entry points live on the admin order detail (mobile + admin web).
