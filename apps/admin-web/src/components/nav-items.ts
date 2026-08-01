import {
  Armchair,
  BadgeCheck,
  Banknote,
  Bell,
  Blocks,
  Boxes,
  Building2,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  Layers,
  LayoutDashboard,
  Palette,
  Receipt,
  RotateCcw,
  Ruler,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    key: 'groupOverview',
    items: [
      { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
      { href: '/reports', key: 'reports', icon: Gauge },
    ],
  },
  {
    key: 'groupSales',
    items: [
      { href: '/customers', key: 'customers', icon: Users },
      { href: '/requests', key: 'rfqRequests', icon: FileText },
      { href: '/quotations', key: 'quotations', icon: ClipboardList },
      { href: '/sales-orders', key: 'salesOrders', icon: ShoppingCart },
      { href: '/ai-intake', key: 'aiIntake', icon: Sparkles },
    ],
  },
  {
    key: 'groupCatalog',
    items: [
      { href: '/products', key: 'products', icon: Armchair },
      { href: '/categories', key: 'categories', icon: Blocks },
      { href: '/materials', key: 'materials', icon: Layers },
      { href: '/fabrics', key: 'fabrics', icon: Palette },
      { href: '/colors', key: 'colors', icon: Palette },
      { href: '/units', key: 'units', icon: Ruler },
    ],
  },
  {
    key: 'groupOperations',
    items: [
      { href: '/production', key: 'production', icon: Factory },
      { href: '/production-stages', key: 'productionStages', icon: Wrench },
      { href: '/quality', key: 'quality', icon: BadgeCheck },
      { href: '/inventory', key: 'inventory', icon: Boxes },
      { href: '/warehouses', key: 'warehouses', icon: Warehouse },
      { href: '/purchasing', key: 'purchasing', icon: Receipt },
      { href: '/suppliers', key: 'suppliers', icon: Building2 },
      { href: '/deliveries', key: 'deliveries', icon: Truck },
    ],
  },
  {
    key: 'groupFinance',
    items: [
      { href: '/invoices', key: 'invoices', icon: Banknote },
      { href: '/contracts', key: 'contracts', icon: ScrollText },
      { href: '/payments', key: 'payments', icon: Banknote },
      { href: '/returns', key: 'returns', icon: RotateCcw },
      { href: '/documents', key: 'documents', icon: FileText },
      { href: '/notifications', key: 'notifications', icon: Bell },
    ],
  },
  {
    key: 'groupAdmin',
    items: [
      { href: '/users', key: 'users', icon: UserCog },
      { href: '/employees', key: 'employees', icon: Users },
      { href: '/departments', key: 'departments', icon: Building2 },
      { href: '/roles', key: 'roles', icon: ShieldCheck },
      { href: '/audit', key: 'audit', icon: ScrollText },
      { href: '/settings', key: 'settings', icon: Settings },
    ],
  },
];