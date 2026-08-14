# Inventory test plan

## API

Warehouse enum backfill; class↔warehouse rejection; GRN into FG rejected; same-type transfer only; reservation then issue no double subtract; stage output once on retry; WIP consume once; FG only after QC pass; QC fail no FG; rework no duplicate FG; delivery issue once; failed delivery restore; return quarantined not sellable; return-to-stock once; scrap never available; optional/excluded stage follows snapshot; cancel releases raw reservation without destroying FG; cost strip; worker cannot manage warehouses.

## Mobile / web

Category counts; WIP/FG empty and real; warehouse create without code; EN/AR/HE; light/dark; RTL; Admin Web class views.

## i18n

EN/AR/HE key parity; no empty/TODO values; no raw enum or raw key leakage.

## Commands

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm smoke:lifecycle`, `pnpm smoke:workflow`, `pnpm smoke:scope`, Prisma validate/generate, mobile tests, Expo Doctor.
