# PIECE 13 — Mobile Visual Acceptance Matrix (§85)

> **Status:** Scaffold only. **Every box unchecked.**  
> **Handset / simulator observation:** **PENDING HANDSET**  
> Do **not** mark PASS from code existence alone. Do **not** claim visual PASS without observation.  
> **Related:** [PIECE13-MOBILE-UX-UI-AUDIT.md](./PIECE13-MOBILE-UX-UI-AUDIT.md) · [PIECE13-MOBILE-VISUAL-BASELINE.md](./PIECE13-MOBILE-VISUAL-BASELINE.md)

---

## 0. How to use

For each major screen below, when observed on handset or simulator:

1. Fill **Demo record** (account + concrete entity id).
2. Check boxes only after visual inspection against [baseline](./PIECE13-MOBILE-VISUAL-BASELINE.md).
3. If unobserved, leave unchecked and keep status **PENDING HANDSET**.
4. Screenshot folders (§86): `docs/evidence/piece13/<area>/` (create when capturing).

### Checklist legend (per screen)

```
[ ] route
[ ] role
[ ] demo record
[ ] header
[ ] hierarchy
[ ] imagery
[ ] cards
[ ] search
[ ] filters
[ ] primary CTA
[ ] sticky safe area
[ ] loading
[ ] empty
[ ] search empty
[ ] error
[ ] keyboard where relevant
[ ] small phone
[ ] large phone
[ ] EN
[ ] AR RTL
[ ] HE RTL
[ ] navigation/back
[ ] no raw enums
[ ] no DEV marker
[ ] no dead buttons
```

**Global status:** PENDING HANDSET

---

## 1. AUTH

### Login — `/(auth)/login` · ROLE ALL · Status: PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### MFA / Unlock / Session / Disabled / Offline — `/(auth)/mfa|unlock|session-expired|disabled|offline` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 2. ADMIN — Management Home & More

### Management Home — `/(admin)/(tabs)/` · ROLE ADMIN · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### More hub / Account / Settings — `/(admin)/(tabs)/more` · `more/account` · `more/settings` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 3. ADMIN — Orders / RFQ / Setup

### Orders list — `/(admin)/(tabs)/orders` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Order detail — `/(admin)/orders/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Order flow — `/(admin)/orders/[id]/flow` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Production setup home + line — `…/production-setup` · `…/lines/[lineId]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Customer request — `/(admin)/requests/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Quotation detail — `/(admin)/quotations/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Scheduling — `/(admin)/scheduling` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 4. ADMIN — Production / Workflow / Quality surfaces

### Production list — `/(admin)/(tabs)/production` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Production detail — `/(admin)/production/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Production flow — `/(admin)/production/[id]/flow` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Admin task detail — `/(admin)/production/tasks/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Workflow library / detail / stages — `production/workflow` · `[id]` · `stages` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 5. ADMIN — Inventory

### Inventory hub — `/(admin)/(tabs)/inventory` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Group / Item / SEMI / FIN — `inventory/[group]` · `items/[id]` · `semi/[orderId]` · `finished/[salesOrderId]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 6. ADMIN — Products / Purchasing / Invoices (reference)

### Products list + detail + setup + times — `/(admin)/products…` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Purchasing hub + PO/PR/SI detail — `/(admin)/purchasing…` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Invoices list + detail — `/(admin)/invoices…` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 7. ADMIN — Dealers / Users / Returns / Deliveries / AI

### Dealers list + detail — `/(admin)/dealers…` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Users + staff types — `/(admin)/users…` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Returns list + detail — `/(admin)/returns…` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Delivery detail — `/(admin)/deliveries/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### AI intake / chat — `/(admin)/ai-intake…` · `ai-chat` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 8. DEALER

### Home — `/(customer)/(tabs)/` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Catalog + product — `catalog` · `catalog/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Orders list + detail + flow — `orders` · `orders/[id]` · `orders/[id]/flow` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### New order — `/(customer)/(tabs)/new-order` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Schedule + Account hub — `schedule` · `account` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Quotations / Invoices / Returns / Request — dealer stacks · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Statement / Payments / Security / Calendar / AI chat · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 9. WORKER

### Today — `/(employee)/(tabs)/` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Tasks / Completed / Notifications / Profile — worker tabs · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Task detail — `/(employee)/tasks/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

### Delivery load — `/(employee)/deliveries/[id]` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 10. SHARED

### Notifications / Global search / Forbidden — `/(app)/notifications` · `search` · `_forbidden` · PENDING HANDSET

- [ ] route · [ ] role · [ ] demo record · [ ] header · [ ] hierarchy · [ ] imagery · [ ] cards · [ ] search · [ ] filters · [ ] primary CTA · [ ] sticky safe area · [ ] loading · [ ] empty · [ ] search empty · [ ] error · [ ] keyboard where relevant · [ ] small phone · [ ] large phone · [ ] EN · [ ] AR RTL · [ ] HE RTL · [ ] navigation/back · [ ] no raw enums · [ ] no DEV marker · [ ] no dead buttons

---

## 11. DEV (`__DEV__` only)

Galleries under `/dev/*` are **not** acceptance targets for production visual PASS. Confirm they remain gated:

- [ ] `__DEV__` redirect when production build
- [ ] No DEV markers leaking onto production routes (separate §72 check)

Status: PENDING HANDSET / N/A for production visual matrix

---

## 12. Screenshot evidence (§86)

| Area | Folder (when captured) | Status |
|------|------------------------|--------|
| Auth | `docs/evidence/piece13/auth/` | PENDING HANDSET |
| Admin Home | `docs/evidence/piece13/admin-home/` | PENDING HANDSET |
| Orders | `docs/evidence/piece13/orders/` | PENDING HANDSET |
| Production | `docs/evidence/piece13/production/` | PENDING HANDSET |
| Inventory | `docs/evidence/piece13/inventory/` | PENDING HANDSET |
| Purchasing / Products / Invoices | `docs/evidence/piece13/reference/` | PENDING HANDSET |
| Dealer | `docs/evidence/piece13/dealer/` | PENDING HANDSET |
| Worker | `docs/evidence/piece13/worker/` | PENDING HANDSET |
| Shared | `docs/evidence/piece13/shared/` | PENDING HANDSET |

---

## 13. Honesty gate

| Claim | Allowed when |
|-------|----------------|
| CODE COMPLETE | Primitives + area polish + docs (later phases) |
| AUTOMATED UAT | piece13 smoke + focused tests |
| **VISUALLY VERIFIED** | Only after boxes checked from handset/simulator observation |
| **PENDING HANDSET** | Default for this scaffold |
