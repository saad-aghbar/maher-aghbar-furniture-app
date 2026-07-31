# Database Model

Phase 0 data design for **Maher Al-Aghbar & Sons Furniture ERP**. PostgreSQL via Prisma. All monetary amounts use `Decimal(18,3)` (JOD). Primary keys are UUID (v7 preferred, v4 fallback). Business entities use soft delete via `archivedAt` (null = active).

## Conventions

| Rule | Implementation |
|------|----------------|
| Money | `Decimal(18,3)` — never `float`/`double` |
| IDs | UUID on all entities; FK columns suffixed `Id` |
| Timestamps | `createdAt`, `updatedAt` (UTC stored, Asia/Amman displayed) |
| Soft delete | `archivedAt TIMESTAMPTZ NULL`; queries default `archivedAt IS NULL` |
| Document numbers | Server-generated, type-prefixed (e.g. `SO-2026-00102`) |
| Audit | Critical mutations emit `AuditEvent` rows (append-only) |
| Multi-tenancy | Single company at launch; `branchId` nullable on operational records for future expansion |

## Entity catalog

### Identity & access

| Entity | Key fields | Notes |
|--------|------------|-------|
| **User** | `id`, `email`, `phone`, `passwordHash`, `displayName`, `locale`, `status`, `lastLoginAt`, `archivedAt` | Staff and portal users; customers linked via `Customer.userId` |
| **Role** | `id`, `code`, `name`, `description`, `archivedAt` | Seed roles: `SALES_REPRESENTATIVE`, `WAREHOUSE_MANAGER`, etc. |
| **Permission** | `id`, `code`, `category`, `description` | Granular codes (e.g. `quotation.approve`) |
| **UserRole** | `userId`, `roleId`, `assignedAt` | M:N; users may hold multiple roles |
| **RolePermission** | `roleId`, `permissionId` | M:N grant matrix |
| **Session** | `id`, `userId`, `refreshTokenHash`, `expiresAt`, `revokedAt`, `userAgent`, `ipAddress` | Refresh rotation |
| **Invitation** | `id`, `email`, `roleIds`, `tokenHash`, `expiresAt`, `acceptedAt` | Staff onboarding |

### CRM

| Entity | Key fields | Notes |
|--------|------------|-------|
| **Customer** | `id`, `userId?`, `type`, `legalName`, `tradeName`, `taxNumber`, `creditLimit`, `paymentTermsDays`, `preferredLocale`, `archivedAt` | Individual or company |
| **Contact** | `id`, `customerId`, `name`, `email`, `phone`, `isPrimary`, `archivedAt` | |
| **Address** | `id`, `customerId`, `label`, `line1`, `city`, `governorate`, `country`, `isDefault`, `archivedAt` | Delivery/billing |
| **Activity** | `id`, `customerId`, `type`, `subject`, `body`, `createdById`, `occurredAt` | Communication log |

### Commercial

| Entity | Key fields | Notes |
|--------|------------|-------|
| **Rfq** | `id`, `number`, `customerId`, `source`, `status`, `preferredLocale`, `archivedAt` | Multi-source intake |
| **RfqLineItem** | `id`, `rfqId`, `description`, `quantity`, `dimensionsJson`, `materialNotes`, `fabricNotes` | Furniture specs |
| **Quotation** | `id`, `number`, `rfqId?`, `customerId`, `version`, `status`, `validUntil`, `subtotal`, `taxAmount`, `total`, `currency`, `archivedAt` | Versioned |
| **QuotationLineItem** | `id`, `quotationId`, `description`, `quantity`, `unitPrice`, `taxRate`, `lineTotal`, `specJson` | |
| **QuotationApproval** | `id`, `quotationId`, `approverId`, `decision`, `comment`, `decidedAt` | Internal gate |
| **SalesOrder** | `id`, `number`, `quotationId`, `customerId`, `status`, `subtotal`, `taxAmount`, `total`, `depositAmount`, `archivedAt` | Created from accepted quote |
| **SalesOrderLineItem** | `id`, `salesOrderId`, `description`, `quantity`, `unitPrice`, `lineTotal`, `specJson` | Snapshot of quote lines |
| **Contract** | `id`, `number`, `salesOrderId`, `customerId`, `signedAt`, `documentId`, `archivedAt` | Wholesale B2B |

### Production & tasks

| Entity | Key fields | Notes |
|--------|------------|-------|
| **ProductionStageTemplate** | `id`, `code`, `name`, `sortOrder`, `archivedAt` | Configurable pipeline |
| **ProductionOrder** | `id`, `number`, `salesOrderId`, `status`, `priority`, `dueDate`, `archivedAt` | One or more per SO |
| **ProductionOrderStage** | `id`, `productionOrderId`, `stageTemplateId`, `status`, `startedAt`, `completedAt` | Stage instances |
| **ProductionTask** | `id`, `productionOrderId`, `stageId`, `assigneeId?`, `status`, `startedAt`, `completedAt`, `blockerReason`, `archivedAt` | Floor work units |
| **TaskTimeEntry** | `id`, `taskId`, `userId`, `action`, `occurredAt` | start/pause/block/complete |
| **QualityInspection** | `id`, `productionOrderId`, `inspectorId`, `status`, `checklistJson`, `result`, `defectNotes`, `inspectedAt` | QC gate |
| **Delivery** | `id`, `number`, `salesOrderId`, `status`, `scheduledDate`, `driverId?`, `podDocumentId?`, `deliveredAt` | Proof of delivery |

### Inventory & warehouse

| Entity | Key fields | Notes |
|--------|------------|-------|
| **Warehouse** | `id`, `code`, `name`, `address`, `isDefault`, `archivedAt` | Multi-warehouse |
| **InventoryItem** | `id`, `sku`, `name`, `category`, `unit`, `barcode`, `reorderLevel`, `archivedAt` | Master data |
| **InventoryBalance** | `id`, `itemId`, `warehouseId`, `quantityOnHand`, `quantityReserved` | **Derived cache**; source of truth is transactions |
| **InventoryTransaction** | `id`, `number`, `type`, `itemId`, `warehouseId`, `quantity`, `unitCost?`, `referenceType`, `referenceId`, `performedById`, `occurredAt` | RECEIPT, ISSUE, TRANSFER, ADJUST, COUNT |
| **InventoryReservation** | `id`, `itemId`, `warehouseId`, `quantity`, `referenceType`, `referenceId`, `releasedAt?` | Ties to SO/production |

### Purchasing

| Entity | Key fields | Notes |
|--------|------------|-------|
| **Supplier** | `id`, `code`, `name`, `contactEmail`, `paymentTermsDays`, `archivedAt` | |
| **PurchaseRequest** | `id`, `number`, `requestedById`, `status`, `archivedAt` | Internal PR |
| **PurchaseOrder** | `id`, `number`, `supplierId`, `status`, `subtotal`, `taxAmount`, `total`, `expectedDate`, `archivedAt` | |
| **PurchaseOrderLineItem** | `id`, `purchaseOrderId`, `itemId?`, `description`, `quantity`, `unitPrice`, `lineTotal` | |
| **GoodsReceipt** | `id`, `number`, `purchaseOrderId`, `warehouseId`, `receivedAt`, `receivedById` | Creates inventory RECEIPT txns |

### Financial

| Entity | Key fields | Notes |
|--------|------------|-------|
| **Invoice** | `id`, `number`, `salesOrderId`, `customerId`, `status`, `issueDate`, `dueDate`, `subtotal`, `taxAmount`, `total`, `amountPaid`, `archivedAt` | |
| **InvoiceLineItem** | `id`, `invoiceId`, `description`, `quantity`, `unitPrice`, `lineTotal` | |
| **Payment** | `id`, `number`, `invoiceId`, `customerId`, `method`, `amount`, `receivedAt`, `reference`, `recordedById` | |
| **CreditNote** | `id`, `number`, `invoiceId`, `amount`, `reason`, `issuedAt` | Returns/adjustments |

### Documents & AI

| Entity | Key fields | Notes |
|--------|------------|-------|
| **Document** | `id`, `filename`, `mimeType`, `sizeBytes`, `storageKey`, `visibilityScope`, `uploadedById`, `archivedAt` | DMS; signed URL access |
| **DocumentLink** | `id`, `documentId`, `entityType`, `entityId`, `label` | Polymorphic attachment |
| **AIExtractionJob** | `id`, `status`, `sourceDocumentId`, `detectedLanguage`, `provider`, `rawOutputJson`, `proposedEntityType`, `proposedPayloadJson`, `reviewedById?`, `reviewDecision`, `archivedAt` | Human review required |
| **Notification** | `id`, `userId`, `channel`, `template`, `payloadJson`, `sentAt`, `readAt` | In-app + outbound |

### Audit & settings

| Entity | Key fields | Notes |
|--------|------------|-------|
| **AuditEvent** | `id`, `actorId`, `action`, `entityType`, `entityId`, `beforeJson`, `afterJson`, `ipAddress`, `occurredAt` | Immutable |
| **Setting** | `id`, `key`, `valueJson`, `updatedById` | VAT rate, quote expiry, etc. |

## Relationships summary

```
User ──< UserRole >── Role ──< RolePermission >── Permission
User ──< Session
Customer ──< Contact, Address, Activity, Rfq, Quotation, SalesOrder, Invoice
Rfq ──< RfqLineItem ──> Quotation (optional)
Quotation ──< QuotationLineItem, QuotationApproval
Quotation ──> SalesOrder ──< SalesOrderLineItem
SalesOrder ──> ProductionOrder ──< ProductionOrderStage, ProductionTask, QualityInspection, Delivery
SalesOrder ──> Invoice ──< Payment
Supplier ──< PurchaseOrder ──< PurchaseOrderLineItem ──> GoodsReceipt ──> InventoryTransaction
InventoryItem ──< InventoryBalance (per Warehouse)
InventoryItem ──< InventoryTransaction
Document ──< DocumentLink (polymorphic)
Document ──> AIExtractionJob
AuditEvent ──> User (actor)
```

Cardinality highlights:

- One **Quotation** version chain per RFQ; accepted version spawns exactly one **SalesOrder** (unless voided and re-issued).
- **ProductionOrder**(s) reference one **SalesOrder**; tasks belong to stages on a production order.
- **InventoryBalance** is updated atomically with each **InventoryTransaction** in the same DB transaction.
- **Invoice** totals must reconcile with **SalesOrder**; **Payment** sums cannot exceed invoice balance.

## Core ERD

```mermaid
erDiagram
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : assigned
  Role ||--o{ RolePermission : grants
  Permission ||--o{ RolePermission : included

  User ||--o{ Session : maintains
  User ||--o{ AuditEvent : performs
  User ||--o| Customer : portal_account

  Customer ||--o{ Contact : has
  Customer ||--o{ Address : has
  Customer ||--o{ Quotation : receives
  Customer ||--o{ SalesOrder : places
  Customer ||--o{ Invoice : billed

  Quotation ||--o{ QuotationLineItem : contains
  Quotation ||--o{ QuotationApproval : requires
  Quotation ||--o| SalesOrder : converts_to

  SalesOrder ||--o{ SalesOrderLineItem : contains
  SalesOrder ||--o{ ProductionOrder : drives
  SalesOrder ||--o{ Delivery : fulfills
  SalesOrder ||--o{ Invoice : generates

  ProductionOrder ||--o{ ProductionOrderStage : tracks
  ProductionOrder ||--o{ ProductionTask : assigns
  ProductionOrder ||--o{ QualityInspection : gates

  ProductionTask }o--|| User : assignee

  Warehouse ||--o{ InventoryBalance : holds
  InventoryItem ||--o{ InventoryBalance : stocked
  InventoryItem ||--o{ InventoryTransaction : moves

  InventoryTransaction }o--|| Warehouse : at
  InventoryTransaction }o--|| User : performed_by

  Supplier ||--o{ PurchaseOrder : supplies
  PurchaseOrder ||--o{ PurchaseOrderLineItem : contains
  PurchaseOrder ||--o{ GoodsReceipt : receives

  Invoice ||--o{ InvoiceLineItem : contains
  Invoice ||--o{ Payment : settled_by

  Document ||--o{ DocumentLink : attached
  Document ||--o{ AIExtractionJob : processed_by
  AIExtractionJob }o--o| User : reviewed_by

  User {
    uuid id PK
    string email
    string passwordHash
    string locale
    timestamptz archivedAt
  }

  Role {
    uuid id PK
    string code UK
    string name
  }

  Permission {
    uuid id PK
    string code UK
    string category
  }

  Customer {
    uuid id PK
    uuid userId FK
    enum type
    decimal creditLimit
    timestamptz archivedAt
  }

  Quotation {
    uuid id PK
    string number UK
    uuid customerId FK
    int version
    enum status
    decimal total
    timestamptz archivedAt
  }

  SalesOrder {
    uuid id PK
    string number UK
    uuid quotationId FK
    enum status
    decimal total
    decimal depositAmount
  }

  ProductionOrder {
    uuid id PK
    string number UK
    uuid salesOrderId FK
    enum status
    date dueDate
  }

  ProductionTask {
    uuid id PK
    uuid productionOrderId FK
    uuid assigneeId FK
    enum status
    text blockerReason
  }

  Warehouse {
    uuid id PK
    string code UK
    string name
  }

  InventoryItem {
    uuid id PK
    string sku UK
    string unit
    decimal reorderLevel
  }

  InventoryBalance {
    uuid id PK
    uuid itemId FK
    uuid warehouseId FK
    decimal quantityOnHand
    decimal quantityReserved
  }

  InventoryTransaction {
    uuid id PK
    enum type
    uuid itemId FK
    uuid warehouseId FK
    decimal quantity
    uuid referenceId
  }

  Supplier {
    uuid id PK
    string code UK
    string name
  }

  PurchaseOrder {
    uuid id PK
    string number UK
    uuid supplierId FK
    enum status
    decimal total
  }

  QualityInspection {
    uuid id PK
    uuid productionOrderId FK
    uuid inspectorId FK
    enum result
  }

  Delivery {
    uuid id PK
    string number UK
    uuid salesOrderId FK
    enum status
    timestamptz deliveredAt
  }

  Invoice {
    uuid id PK
    string number UK
    uuid salesOrderId FK
    decimal total
    decimal amountPaid
    enum status
  }

  Payment {
    uuid id PK
    string number UK
    uuid invoiceId FK
    decimal amount
    enum method
  }

  Document {
    uuid id PK
    string storageKey
    enum visibilityScope
    bigint sizeBytes
  }

  AIExtractionJob {
    uuid id PK
    uuid sourceDocumentId FK
    enum status
    json proposedPayloadJson
    enum reviewDecision
  }

  AuditEvent {
    uuid id PK
    uuid actorId FK
    string action
    string entityType
    uuid entityId
    timestamptz occurredAt
  }
```

## Indexing strategy (Phase 1+)

- Unique: `User.email`, `InventoryItem.sku`, document numbers per type/year.
- FK indexes on all `*Id` columns used in joins and filters.
- Composite: `(entityType, entityId)` on `DocumentLink`, `AuditEvent`.
- Partial: `archivedAt IS NULL` on high-volume list queries.
- Full-text (later phase): customer name, SKU, document numbers for global search.

## Migration principles

1. Forward-only migrations in `packages/database/prisma/migrations`.
2. Seed data: roles, permissions, stage templates, default warehouse, admin user.
3. Balance reconciliation job validates `InventoryBalance` vs sum of transactions (nightly).
