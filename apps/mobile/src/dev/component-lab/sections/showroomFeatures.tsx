/**
 * Showroom feature demos — real cards with fixture models (no API).
 */
import { UrgentAlertCard } from '@/features/admin-home/components/UrgentAlertCard';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { DealerBalanceCard } from '@/features/dealer-ui/DealerBalanceCard';
import { InventoryFinishedOrderCard } from '@/features/inventory/components/InventoryFinishedOrderCard';
import { InventoryMaterialCard } from '@/features/inventory/components/InventoryMaterialCard';
import { InventorySemiOrderGroupCard } from '@/features/inventory/components/InventorySemiOrderGroupCard';
import type { FinishedOrderGroup } from '@/features/inventory/selectFinishedOrders';
import type { InventoryItemCardModel } from '@/features/inventory/selectInventory';
import type { SemiOrderGroup } from '@/features/inventory/selectSemiOrders';
import { InvoiceBoardCard } from '@/features/invoices/components/InvoiceBoardCard';
import type { InvoiceCardModel } from '@/features/invoices/selectInvoice';
import { NotificationBoardCard } from '@/features/notifications/components/NotificationBoardCard';
import type { NotificationCardModel } from '@/features/notifications/selectNotification';
import { ProductionLifecycleStrip } from '@/features/production/components/ProductionLifecycleStrip';
import { ProductionOrderCard } from '@/features/production/components/ProductionOrderCard';
import type { ProductionCardModel } from '@/features/production/selectProduction';
import { PurchaseOrderBoardCard } from '@/features/purchasing/components/PurchaseOrderBoardCard';
import { PurchaseRequestBoardCard } from '@/features/purchasing/components/PurchaseRequestBoardCard';
import type {
  PurchaseCardModel,
  PurchaseRequestCardModel,
} from '@/features/purchasing/selectPurchase';
import { AdminOrderCard } from '@/features/sales-orders/components/AdminOrderCard';
import { DealerOrderCard } from '@/features/sales-orders/components/DealerOrderCard';
import type {
  AdminOrderCardModel,
  DealerOrderCardModel,
} from '@/features/sales-orders/selectOrderCard';
import { IndustrialFloorTaskCard } from '@/features/tasks/components/IndustrialFloorTaskCard';
import { TodayProgressCard } from '@/features/worker-home/components/TodayProgressCard';
import type { ShowroomItem } from '../showroom/types';

const adminOrder = (over: Partial<AdminOrderCardModel> = {}): AdminOrderCardModel => ({
  id: 'so-show-1',
  number: 'SO-SHOW-001',
  status: 'IN_PRODUCTION',
  priority: 'NORMAL',
  title: 'Classic Sofa — Cream Fabric',
  imageUrl: null,
  dealerId: 'dealer-1',
  dealerName: 'Oasis Furniture',
  progressPercent: 42,
  progressLabel: 'Upholstery',
  deliveryDate: '2026-09-15',
  arrivedAt: null,
  externalOrderNumber: null,
  productionOrderNumbers: ['PO-SHOW-001'],
  manufacturingCost: 3200,
  sellerPrice: 8500,
  profit: 5300,
  quantity: 1,
  kind: 'order',
  ...over,
});

const dealerOrder = (over: Partial<DealerOrderCardModel> = {}): DealerOrderCardModel => ({
  id: 'so-dealer-1',
  number: 'SO-SHOW-D1',
  status: 'READY_FOR_DELIVERY',
  title: 'Dining Set',
  imageUrl: null,
  progressPercent: 90,
  progressLabel: 'Packaging',
  deliveryDate: '2026-09-20',
  arrivedAt: null,
  externalOrderNumber: 'EXT-88',
  sellerPrice: 12000,
  kind: 'order',
  quantity: 1,
  ...over,
});

const productionOrder = (over: Partial<ProductionCardModel> = {}): ProductionCardModel => ({
  id: 'po-1',
  number: 'PO-SHOW-001',
  title: 'Classic Sofa',
  dealerName: 'Oasis Furniture',
  imageUrl: null,
  priority: 'NORMAL',
  status: 'IN_PROGRESS',
  progressPercent: 55,
  progressLabel: 'Upholstery',
  isLate: false,
  deliveryLabel: '15 Sep',
  readinessReason: null,
  boardBucket: 'on_floor',
  salesOrderId: 'so-1',
  plannedStartDate: null,
  actualStartDate: null,
  releasedToFactoryAt: null,
  startDueHint: null,
  showStages: false,
  ...over,
});

const semiGroup = (): SemiOrderGroup => ({
  productionOrderId: 'po-semi-1',
  number: 'PO-SEMI-01',
  productDescription: 'Sofa frame kit',
  product: {
    id: 'prod-1',
    nameEn: 'Classic Sofa',
    nameAr: '',
    nameHe: '',
    imageUrl: null,
  } as NonNullable<SemiOrderGroup['product']>,
  kits: [],
  counts: {
    total: 4,
    active: 3,
    atStation: 1,
    inWarehouse: 1,
    received: 1,
    used: 1,
    cancelled: 0,
  },
});

const material = (over: Partial<InventoryItemCardModel> = {}): InventoryItemCardModel => ({
  id: 'mat-1',
  name: 'Beech plywood 18mm',
  nameEn: 'Beech plywood 18mm',
  nameAr: '',
  sku: 'PLY-18-B',
  scanCode: null,
  category: 'Wood',
  materialType: 'PLYWOOD',
  barcode: null,
  color: null,
  size: '18mm',
  customMeasurements: null,
  imageUrl: null,
  isAccessory: false,
  isActive: true,
  archivedAt: null,
  minStock: 20,
  standardCost: 85,
  quantityLabel: '42 sheets',
  onHand: 42,
  reservedQty: 6,
  freeQty: 36,
  quarantinedQty: 0,
  quarantined: false,
  unit: 'sheet',
  isLowStock: false,
  stockStatus: 'IN_STOCK',
  showCost: true,
  costLabel: '₪ 85',
  balances: [
    {
      warehouseId: 'wh-1',
      warehouseName: 'Main',
      availableQty: 42,
      reservedQty: 6,
      freeQty: 36,
      quantityLabel: '42',
    },
  ],
  ...over,
});

const finishedGroup = (): FinishedOrderGroup => ({
  salesOrderId: 'so-fg-1',
  salesOrderNumber: 'SO-FG-001',
  projectName: null,
  dealerNameEn: 'Oasis Furniture',
  dealerNameAr: null,
  dealerNameHe: null,
  productNameEn: 'Classic Sofa',
  productNameAr: '',
  productNameHe: null,
  productImageUrl: null,
  productionOrderIds: ['po-1'],
  productionOrderNumbers: ['PO-SHOW-001'],
  lots: [],
  unitsOnHand: 2,
  packageCount: 4,
  packagesPerUnit: 2,
  pieceLabels: [],
  packageSummary: '2× box A, 2× box B',
  warehouseIds: ['wh-1'],
  warehouseLabels: ['Finished goods'],
  multiWarehouse: false,
  daysWaiting: 3,
  deliveryId: null,
  deliveryStatus: null,
  deliveryNumber: null,
  deliveryDate: '2026-09-12',
  loadChecked: 0,
  loadTotal: 0,
  enteredAt: null,
  leftAt: null,
  leaveSortKey: 10,
});

const purchaseOrder = (over: Partial<PurchaseCardModel> = {}): PurchaseCardModel => ({
  id: 'po-buy-1',
  number: 'PPO-SHOW-01',
  supplierName: 'North Woods Supply',
  status: 'ORDERED',
  totalLabel: '₪ 4,200',
  expectedLabel: '10 Sep',
  lineCount: 5,
  warehouseLabel: 'Main',
  phaseLabelKey: null,
  progress: 0.4,
  attentionReason: null,
  primaryAction: null,
  ...over,
});

const purchaseRequest = (): PurchaseRequestCardModel => ({
  id: 'pr-1',
  number: 'PR-SHOW-01',
  status: 'OPEN',
  reason: 'Low stock — plywood',
  supplierName: 'North Woods Supply',
  offerCount: 2,
  linkedPoNumber: null,
  warehouseLabel: 'Main',
});

const invoice = (over: Partial<InvoiceCardModel> = {}): InvoiceCardModel => ({
  id: 'inv-1',
  number: 'INV-SHOW-01',
  dealerName: 'Oasis Furniture',
  status: 'ISSUED',
  outstanding: 4500,
  paid: 2000,
  total: 6500,
  availableCredit: 0,
  amountDue: 4500,
  outstandingLabel: '4,500',
  paidLabel: '2,000',
  totalLabel: '6,500',
  amountDueLabel: '4,500',
  availableCreditLabel: '0',
  dueDateLabel: '30 Sep 2026',
  invoiceDateLabel: '1 Sep 2026',
  factoryOrderNumber: 'SO-SHOW-001',
  dealerOrderNumber: null,
  isOverdue: false,
  ...over,
});

const notif = (over: Partial<NotificationCardModel> = {}): NotificationCardModel => ({
  id: 'n1',
  type: 'PRODUCTION',
  title: 'Stage ready',
  body: 'Upholstery can start on PO-SHOW-001.',
  unread: true,
  createdAt: new Date().toISOString(),
  linkUrl: null,
  ...over,
});

export function buildFeatureShowroomItems(): ShowroomItem[] {
  return [
    {
      id: 'feature.orders.admin-order-card',
      componentName: 'AdminOrderCard',
      section: 'ORDERS',
      role: 'Admin',
      sourceFile: 'src/features/sales-orders/components/AdminOrderCard.tsx',
      usedIn: ['Admin → Orders'],
      description: 'Admin orders board card.',
      layout: 'full',
      mode: 'inline',
      tags: ['AdminOrderCard', 'OrderBoardCard', 'orders'],
      contains: ['OrderBoardCard'],
      variants: [
        {
          label: 'DEFAULT',
          render: function AdminOrderDefault() {
            return <AdminOrderCard order={adminOrder()} onPress={() => undefined} />;
          },
        },
        {
          label: 'URGENT',
          render: function AdminOrderUrgent() {
            return (
              <AdminOrderCard
                order={adminOrder({ priority: 'URGENT', progressPercent: 12 })}
                onPress={() => undefined}
              />
            );
          },
        },
      ],
    },
    {
      id: 'feature.orders.dealer-order-card',
      componentName: 'DealerOrderCard',
      section: 'ORDERS',
      role: 'Dealer',
      sourceFile: 'src/features/sales-orders/components/DealerOrderCard.tsx',
      usedIn: ['Dealer → Orders'],
      description: 'Dealer-facing order card.',
      layout: 'full',
      mode: 'inline',
      tags: ['DealerOrderCard', 'orders', 'dealer'],
      render: function DealerOrderDemo() {
        return <DealerOrderCard order={dealerOrder()} onPress={() => undefined} />;
      },
    },
    {
      id: 'feature.production.production-order-card',
      componentName: 'ProductionOrderCard',
      section: 'PRODUCTION',
      role: 'Admin',
      sourceFile: 'src/features/production/components/ProductionOrderCard.tsx',
      usedIn: ['Admin → Production'],
      description: 'Production board card.',
      layout: 'full',
      mode: 'inline',
      tags: ['ProductionOrderCard', 'production'],
      variants: [
        {
          label: 'ON FLOOR',
          render: function ProdOnFloor() {
            return <ProductionOrderCard order={productionOrder()} onPress={() => undefined} />;
          },
        },
        {
          label: 'LATE',
          render: function ProdLate() {
            return (
              <ProductionOrderCard
                order={productionOrder({ isLate: true, priority: 'HIGH' })}
                onPress={() => undefined}
              />
            );
          },
        },
      ],
    },
    {
      id: 'feature.production.lifecycle-strip',
      componentName: 'ProductionLifecycleStrip',
      section: 'PRODUCTION',
      role: 'Admin',
      sourceFile: 'src/features/production/components/ProductionLifecycleStrip.tsx',
      usedIn: ['Production detail'],
      description: 'Order lifecycle strip.',
      layout: 'full',
      mode: 'inline',
      tags: ['ProductionLifecycleStrip', 'production'],
      variants: [
        {
          label: 'PRODUCTION',
          render: function LifecycleProd() {
            return (
              <ProductionLifecycleStrip poStatus="IN_PROGRESS" currentStageCode="UPHOLSTERY" />
            );
          },
        },
        {
          label: 'READY',
          render: function LifecycleReady() {
            return <ProductionLifecycleStrip poStatus="READY_FOR_DELIVERY" />;
          },
        },
      ],
    },
    {
      id: 'feature.worker.industrial-floor-task-card',
      componentName: 'IndustrialFloorTaskCard',
      section: 'WORKER',
      role: 'Worker',
      sourceFile: 'src/features/tasks/components/IndustrialFloorTaskCard.tsx',
      usedIn: ['Worker Today', 'Tasks'],
      description: 'Worker floor task card.',
      layout: 'full',
      mode: 'inline',
      tags: ['IndustrialFloorTaskCard', 'WorkerTaskCard', 'TaskCard', 'worker', 'task'],
      contains: ['WorkerTaskCard', 'TaskCard'],
      variants: [
        {
          label: 'DO NOW',
          render: function TaskDoNow() {
            return (
              <IndustrialFloorTaskCard
                task={{
                  id: 't1',
                  department: 'Carpentry',
                  productTitle: 'Classic Sofa',
                  orderNumber: 'PO-SHOW-001',
                  imageUrl: null,
                  priority: 'high',
                  deadline: 'Today',
                  emphasize: true,
                  isScheduledToday: true,
                }}
                showOpenButton={false}
              />
            );
          },
        },
        {
          label: 'DONE',
          render: function TaskDone() {
            return (
              <IndustrialFloorTaskCard
                task={{
                  id: 't2',
                  department: 'Packaging',
                  productTitle: 'Dining chair',
                  orderNumber: 'PO-SHOW-002',
                  imageUrl: null,
                  priority: 'medium',
                  deadline: null,
                  completed: true,
                }}
                showOpenButton={false}
              />
            );
          },
        },
      ],
    },
    {
      id: 'feature.worker.today-progress',
      componentName: 'TodayProgressCard',
      section: 'WORKER',
      role: 'Worker',
      sourceFile: 'src/features/worker-home/components/TodayProgressCard.tsx',
      usedIn: ['Worker Today'],
      description: 'Today progress ring + stamps.',
      layout: 'full',
      mode: 'inline',
      tags: ['TodayProgressCard', 'worker'],
      render: function TodayProgressDemo() {
        return (
          <TodayProgressCard
            progress={{
              completed: 3,
              inProgress: 2,
              remaining: 4,
              totalToday: 9,
              completedRatio: 3 / 9,
              percentCompleted: 33,
            }}
          />
        );
      },
    },
    {
      id: 'feature.inventory.material-card',
      componentName: 'InventoryMaterialCard',
      section: 'INVENTORY',
      role: 'Admin',
      sourceFile: 'src/features/inventory/components/InventoryMaterialCard.tsx',
      usedIn: ['Inventory → RAW'],
      description: 'Raw / material inventory row card.',
      layout: 'full',
      mode: 'inline',
      tags: ['InventoryMaterialCard', 'RAW', 'inventory'],
      variants: [
        {
          label: 'IN STOCK',
          render: function MatInStock() {
            return <InventoryMaterialCard item={material()} onPress={() => undefined} />;
          },
        },
        {
          label: 'LOW STOCK',
          render: function MatLow() {
            return (
              <InventoryMaterialCard
                item={material({
                  isLowStock: true,
                  stockStatus: 'LOW_STOCK',
                  onHand: 4,
                  freeQty: 4,
                  quantityLabel: '4 sheets',
                })}
                onPress={() => undefined}
              />
            );
          },
        },
      ],
    },
    {
      id: 'feature.inventory.semi-order-group-card',
      componentName: 'InventorySemiOrderGroupCard',
      section: 'SEMI',
      role: 'Admin',
      sourceFile: 'src/features/inventory/components/InventorySemiOrderGroupCard.tsx',
      usedIn: ['Inventory → SEMI'],
      description: 'SEMI order group board card.',
      layout: 'full',
      mode: 'inline',
      tags: ['InventorySemiOrderGroupCard', 'SEMI', 'inventory'],
      contains: ['InventorySemiOrderCard'],
      render: function SemiGroupDemo() {
        return <InventorySemiOrderGroupCard order={semiGroup()} onPress={() => undefined} />;
      },
    },
    {
      id: 'feature.inventory.finished-order-card',
      componentName: 'InventoryFinishedOrderCard',
      section: 'FINISHED',
      role: 'Admin',
      sourceFile: 'src/features/inventory/components/InventoryFinishedOrderCard.tsx',
      usedIn: ['Inventory → FINISHED'],
      description: 'Finished goods outbound order card.',
      layout: 'full',
      mode: 'inline',
      tags: ['InventoryFinishedOrderCard', 'FINISHED', 'inventory'],
      render: function FinishedDemo() {
        return <InventoryFinishedOrderCard order={finishedGroup()} onPress={() => undefined} />;
      },
    },
    {
      id: 'feature.purchasing.po-card',
      componentName: 'PurchaseOrderBoardCard',
      section: 'PURCHASING',
      role: 'Admin',
      sourceFile: 'src/features/purchasing/components/PurchaseOrderBoardCard.tsx',
      usedIn: ['Purchasing → POs'],
      description: 'Purchase order board card.',
      layout: 'full',
      mode: 'inline',
      tags: ['PurchaseOrderBoardCard', 'purchasing'],
      render: function PoCardDemo() {
        return <PurchaseOrderBoardCard order={purchaseOrder()} onPress={() => undefined} />;
      },
    },
    {
      id: 'feature.purchasing.pr-card',
      componentName: 'PurchaseRequestBoardCard',
      section: 'PURCHASING',
      role: 'Admin',
      sourceFile: 'src/features/purchasing/components/PurchaseRequestBoardCard.tsx',
      usedIn: ['Purchasing → Requests'],
      description: 'Purchase request board card.',
      layout: 'full',
      mode: 'inline',
      tags: ['PurchaseRequestBoardCard', 'purchasing'],
      render: function PrCardDemo() {
        return <PurchaseRequestBoardCard request={purchaseRequest()} onPress={() => undefined} />;
      },
    },
    {
      id: 'feature.finance.invoice-board-card',
      componentName: 'InvoiceBoardCard',
      section: 'FINANCE',
      role: 'Admin',
      sourceFile: 'src/features/invoices/components/InvoiceBoardCard.tsx',
      usedIn: ['Invoices'],
      description: 'Invoice floor card — amount due first.',
      layout: 'full',
      mode: 'inline',
      tags: ['InvoiceBoardCard', 'invoice', 'finance'],
      variants: [
        {
          label: 'DUE',
          render: function InvDue() {
            return <InvoiceBoardCard invoice={invoice()} onPress={() => undefined} />;
          },
        },
        {
          label: 'OVERDUE',
          render: function InvOverdue() {
            return (
              <InvoiceBoardCard
                invoice={invoice({ isOverdue: true, status: 'OVERDUE' })}
                onPress={() => undefined}
              />
            );
          },
        },
        {
          label: 'WITH CREDIT',
          render: function InvCredit() {
            return (
              <InvoiceBoardCard
                invoice={invoice({
                  availableCredit: 800,
                  availableCreditLabel: '800',
                  amountDue: 3700,
                  amountDueLabel: '3,700',
                })}
                onPress={() => undefined}
              />
            );
          },
        },
      ],
    },
    {
      id: 'feature.dealer.balance-card',
      componentName: 'DealerBalanceCard',
      section: 'DEALER',
      role: 'Dealer',
      sourceFile: 'src/features/dealer-ui/DealerBalanceCard.tsx',
      usedIn: ['Dealer home'],
      description: 'Dealer account balance surface.',
      layout: 'full',
      mode: 'inline',
      tags: ['DealerBalanceCard', 'dealer'],
      render: function DealerBalanceDemo() {
        return (
          <DealerBalanceCard
            label="Available credit"
            amountLabel="₪ 2,400"
            hint="Fixture — no live balance"
          />
        );
      },
    },
    {
      id: 'feature.management.urgent-alert',
      componentName: 'UrgentAlertCard',
      section: 'MANAGEMENT',
      role: 'Admin',
      sourceFile: 'src/features/admin-home/components/UrgentAlertCard.tsx',
      usedIn: ['Admin home'],
      description: 'Management attention alert.',
      layout: 'full',
      mode: 'inline',
      tags: ['UrgentAlertCard', 'management', 'admin-home'],
      render: function UrgentAlertDemo() {
        return <UrgentAlertCard alert={{ kind: 'late', count: 3 }} />;
      },
    },
    {
      id: 'feature.notifications.notification-board-card',
      componentName: 'NotificationBoardCard',
      section: 'NOTIFICATIONS',
      role: 'Shared',
      sourceFile: 'src/features/notifications/components/NotificationBoardCard.tsx',
      usedIn: ['Notifications inbox'],
      description: 'Notification board card.',
      layout: 'full',
      mode: 'inline',
      tags: ['NotificationBoardCard', 'notification'],
      variants: [
        {
          label: 'UNREAD',
          render: function NotifUnread() {
            return <NotificationBoardCard item={notif()} onPress={() => undefined} />;
          },
        },
        {
          label: 'READ',
          render: function NotifRead() {
            return (
              <NotificationBoardCard
                item={notif({ unread: false, title: 'Payment received' })}
                onPress={() => undefined}
              />
            );
          },
        },
      ],
    },
    {
      id: 'feature.catalog.product-card',
      componentName: 'ProductCard',
      section: 'PRODUCTS',
      role: 'Shared',
      sourceFile: 'src/features/catalog/components/ProductCard.tsx',
      usedIn: ['Catalog'],
      description: 'Catalog product card.',
      layout: 'full',
      mode: 'inline',
      tags: ['ProductCard', 'catalog'],
      render: function ProductCardDemo() {
        return (
          <ProductCard
            width={180}
            product={{
              id: 'p1',
              name: 'Classic Sofa',
              imageUrl: null,
              imageUrls: [],
              price: 8500,
              currency: 'ILS',
              isAvailable: true,
              categoryName: 'Sofas',
              dimensionHint: '220×90',
              galleryCount: 0,
            }}
            onPress={() => undefined}
          />
        );
      },
    },
    // Searchable aliases → parent demos (no empty preview)
    {
      id: 'alias.worker-task-card',
      componentName: 'WorkerTaskCard',
      section: 'WORKER',
      role: 'Worker',
      sourceFile: 'src/features/worker-home/components/WorkerTaskCard.tsx',
      usedIn: ['Worker Today'],
      description: 'Represented by IndustrialFloorTaskCard demo.',
      layout: 'full',
      mode: 'represented',
      tags: ['WorkerTaskCard'],
      representedIn: 'feature.worker.industrial-floor-task-card',
    },
    {
      id: 'alias.order-board-card',
      componentName: 'OrderBoardCard',
      section: 'ORDERS',
      role: 'Admin',
      sourceFile: 'src/features/sales-orders/components/OrderBoardCard.tsx',
      usedIn: ['Orders board'],
      description: 'Represented by AdminOrderCard demo.',
      layout: 'full',
      mode: 'represented',
      tags: ['OrderBoardCard'],
      representedIn: 'feature.orders.admin-order-card',
    },
    // Full screens
    {
      id: 'screen.dev.admin-home',
      componentName: 'AdminHomeDevPreview',
      section: 'FULL SCREENS',
      role: 'Admin',
      sourceFile: 'app/dev/admin-home.tsx',
      usedIn: ['Dev gallery'],
      description: 'Open admin home visual gallery.',
      layout: 'full',
      mode: 'screen',
      tags: ['AdminHome', 'screen'],
      screenHref: '/dev/admin-home',
    },
    {
      id: 'screen.dev.dealer-home',
      componentName: 'DealerHomeDevPreview',
      section: 'FULL SCREENS',
      role: 'Dealer',
      sourceFile: 'app/dev/dealer-home.tsx',
      usedIn: ['Dev gallery'],
      description: 'Open dealer home visual gallery.',
      layout: 'full',
      mode: 'screen',
      tags: ['DealerHome', 'screen'],
      screenHref: '/dev/dealer-home',
    },
    {
      id: 'screen.dev.worker-home',
      componentName: 'WorkerHomeDevPreview',
      section: 'FULL SCREENS',
      role: 'Worker',
      sourceFile: 'app/dev/worker-home.tsx',
      usedIn: ['Dev gallery'],
      description: 'Open worker home visual gallery.',
      layout: 'full',
      mode: 'screen',
      tags: ['WorkerHome', 'screen'],
      screenHref: '/dev/worker-home',
    },
    {
      id: 'screen.dev.orders',
      componentName: 'OrdersDevPreview',
      section: 'FULL SCREENS',
      role: 'Admin',
      sourceFile: 'app/dev/orders.tsx',
      usedIn: ['Dev gallery'],
      description: 'Open orders gallery.',
      layout: 'full',
      mode: 'screen',
      tags: ['Orders', 'screen'],
      screenHref: '/dev/orders',
    },
    {
      id: 'screen.dev.tasks',
      componentName: 'TasksDevPreview',
      section: 'FULL SCREENS',
      role: 'Worker',
      sourceFile: 'app/dev/tasks.tsx',
      usedIn: ['Dev gallery'],
      description: 'Open tasks gallery.',
      layout: 'full',
      mode: 'screen',
      tags: ['Tasks', 'screen'],
      screenHref: '/dev/tasks',
    },
    {
      id: 'screen.dev.catalog',
      componentName: 'CatalogDevPreview',
      section: 'FULL SCREENS',
      role: 'Shared',
      sourceFile: 'app/dev/catalog.tsx',
      usedIn: ['Dev gallery'],
      description: 'Open catalog gallery.',
      layout: 'full',
      mode: 'screen',
      tags: ['Catalog', 'screen'],
      screenHref: '/dev/catalog',
    },
  ];
}
