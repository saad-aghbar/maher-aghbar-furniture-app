# Roles and Permissions

## Roles

| Role | Code | Typical access |
|------|------|----------------|
| Customer | `CUSTOMER` | Own portal data only |
| Sales Representative | `SALES_REPRESENTATIVE` | CRM, RFQ, draft quotations |
| Sales Manager | `SALES_MANAGER` | Approve/send quotations, sales oversight |
| Purchasing Employee | `PURCHASING_EMPLOYEE` | PR/PO draft, suppliers read |
| Purchasing Manager | `PURCHASING_MANAGER` | Approve POs, supplier manage |
| Warehouse Employee | `WAREHOUSE_EMPLOYEE` | Receive/issue/transfer/count |
| Warehouse Manager | `WAREHOUSE_MANAGER` | Adjustments, warehouse config |
| Production Worker | `PRODUCTION_WORKER` | Own tasks |
| Production Supervisor | `PRODUCTION_SUPERVISOR` | Assign, any-task update, production board |
| Quality Inspector | `QUALITY_INSPECTOR` | Inspections, rework |
| Delivery Employee | `DELIVERY_EMPLOYEE` | Delivery updates, POD |
| Accountant | `ACCOUNTANT` | Invoices, payments, statements |
| Finance Manager | `FINANCE_MANAGER` | Financial reports, voids |
| General Manager | `GENERAL_MANAGER` | Cross-module dashboards + approvals |
| System Administrator | `SYSTEM_ADMINISTRATOR` | Users, roles, settings, audit |

Users may hold **multiple roles**. Authorization is by **permission**, not role name alone.

## Permission catalog

Full list shipped in `packages/permissions/src/catalog.ts`. Categories:

- `customer.*`, `contact.manage`, `address.manage`
- `quotation.*` (read/create/update/submit/approve/send/accept/reject/revise)
- `sales-order.*`, `contract.*`
- `supplier.*`, `purchase-request.*`, `purchase-order.*`
- `inventory.*` (read/receive/issue/transfer/adjust/count)
- `production-order.*`, `production-task.*`
- `quality-inspection.*`
- `delivery.*`
- `invoice.*`, `payment.*`, `statement.read`
- `report.*.read`
- `user.manage`, `role.manage`, `settings.manage`, `audit.read`
- `document.*`, `ai-intake.*`, `notification.*`

## Role → permission matrix (summary)

| Permission group | CUST | SALES | SMGR | PUR | WH | WORKER | SUPV | QC | DEL | ACC | GM | ADMIN |
|------------------|------|-------|------|-----|----|--------|------|----|-----|-----|----|-------|
| customer CRUD | own | R/W | R/W | R | R | — | R | — | R | R | ALL | ALL |
| quotation approve/send | accept | create | YES | — | — | — | — | — | — | — | YES | ALL |
| inventory adjust | — | — | — | — | MGR | — | — | — | — | — | YES | ALL |
| production-task own | — | — | — | — | — | YES | YES | — | — | — | YES | ALL |
| quality perform | — | — | — | — | — | — | — | YES | — | — | YES | ALL |
| invoice/payment | — | R | R | — | — | — | — | — | — | YES | YES | ALL |
| financial reports | — | — | limited | — | — | — | — | — | — | YES | YES | ALL |
| user/role/settings | — | — | — | — | — | — | — | — | — | — | R | ALL |
| audit.read | — | — | — | — | — | — | — | — | — | — | YES | YES |

Exact grants are code-defined and seedable; frontend never trusts role labels alone.
