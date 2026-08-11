# Dealer Mobile Screen Map

## Tab roots

| Tab | Route | Screen |
|-----|-------|--------|
| Home | `/(app)/(customer)/(tabs)/index` | `DealerHomeScreen` |
| Catalog | `/(app)/(customer)/(tabs)/catalog` | `CatalogScreen` |
| New Order (FAB) | `/(app)/(customer)/(tabs)/new-order` | `NewOrderScreen` |
| Orders | `/(app)/(customer)/(tabs)/orders` | `OrdersListScreen` `variant="dealer"` |
| Account | `/(app)/(customer)/(tabs)/account` | Premium Account hub (target) |

## Stack screens

| Route | Screen |
|-------|--------|
| `catalog/[id]` | `ProductDetailScreen` |
| `orders/[id]` | `OrderDetailScreen` dealer |
| `orders/[id]/flow` | `ProductionFlowScreen` `role="dealer"` |
| `requests/[id]` | `EditRequestScreen` |
| `invoices` / `invoices/[id]` | Invoice list/detail |
| `account/statement` | Statement / banking |
| `returns` / `returns/[id]` / `returns/create` | Returns |
| `ai-chat` | AI chatbot |
| `/(app)/notifications` | Shared inbox (customer deep-links) |
| `/(app)/search` | Global search |

## Active tab highlighting

- Nested catalog → Catalog
- Orders / flow → Orders
- Invoices, statement, returns, ai-chat → Account
- New-order / requests → treat as New Order destination (FAB pressed / no tab selected or soft highlight Catalog none)

## Do not map

- Admin `(admin)/**`
- Employee `(employee)/**`
- Admin CRM dealers list/detail
