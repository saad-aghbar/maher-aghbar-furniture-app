import classifications from './file-classifications.json';
import { FoundationsDemo, richDemoRenderers } from '../sections/sharedDemos';
import { featureDemoRenderers } from '../sections/featureDemos';
import type { FileAuditRow, LabRegistryEntry, LabRole } from './types';

const allRichRenderers: Record<string, LabRegistryEntry['render']> = {
  ...richDemoRenderers,
  ...featureDemoRenderers,
};

type ClassRow = {
  classification: FileAuditRow['classification'];
  registryIds: string[];
  exportNames?: string[];
  notes?: string;
};

const DOMAIN_USAGE: Record<string, { usedIn: string[]; openUsageTarget?: string; role: LabRole }> =
  {
    production: {
      usedIn: ['Admin → Production'],
      openUsageTarget: '/dev/tasks',
      role: 'Admin',
    },
    'production-flow': {
      usedIn: ['Admin → Production flow'],
      openUsageTarget: '/dev/tasks',
      role: 'Admin',
    },
    inventory: {
      usedIn: ['Admin → Inventory'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    'sales-orders': {
      usedIn: ['Admin → Orders'],
      openUsageTarget: '/dev/orders',
      role: 'Admin',
    },
    requests: {
      usedIn: ['Admin → Customer requests'],
      openUsageTarget: '/dev/orders',
      role: 'Admin',
    },
    quotations: {
      usedIn: ['Admin → Quotations'],
      openUsageTarget: '/dev/orders',
      role: 'Admin',
    },
    'dealer-home': {
      usedIn: ['Dealer → Home'],
      openUsageTarget: '/dev/dealer-home',
      role: 'Dealer',
    },
    'dealer-ui': {
      usedIn: ['Dealer surfaces'],
      openUsageTarget: '/dev/dealer-home',
      role: 'Dealer',
    },
    dealers: {
      usedIn: ['Admin → Dealers'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    'worker-home': {
      usedIn: ['Worker → Today'],
      openUsageTarget: '/dev/worker-home',
      role: 'Worker',
    },
    tasks: {
      usedIn: ['Worker → Tasks'],
      openUsageTarget: '/dev/tasks',
      role: 'Worker',
    },
    'worker-profile': {
      usedIn: ['Worker → Profile'],
      openUsageTarget: '/dev/worker-home',
      role: 'Worker',
    },
    catalog: {
      usedIn: ['Catalog / Products'],
      openUsageTarget: '/dev/catalog',
      role: 'Shared',
    },
    notifications: {
      usedIn: ['Notifications inbox'],
      openUsageTarget: '/dev/admin-home',
      role: 'Shared',
    },
    invoices: {
      usedIn: ['Finance → Invoices'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    purchasing: {
      usedIn: ['Purchasing'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    quality: {
      usedIn: ['Quality'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    deliveries: {
      usedIn: ['Deliveries'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    'delivery-load': {
      usedIn: ['Delivery load'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    returns: {
      usedIn: ['Returns'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    workflow: {
      usedIn: ['Workflow'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    'admin-home': {
      usedIn: ['Admin Home / Management'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    more: {
      usedIn: ['More hub'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    account: {
      usedIn: ['Dealer Account'],
      openUsageTarget: '/dev/dealer-home',
      role: 'Dealer',
    },
    auth: {
      usedIn: ['Auth / Login'],
      openUsageTarget: '/(auth)/login',
      role: 'Shared',
    },
    'ai-chatbot': {
      usedIn: ['AI chatbot'],
      openUsageTarget: '/dev/admin-home',
      role: 'Shared',
    },
    'ai-intake': {
      usedIn: ['AI intake'],
      openUsageTarget: '/dev/admin-home',
      role: 'Shared',
    },
    scheduling: {
      usedIn: ['Scheduling'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    search: {
      usedIn: ['Global search'],
      openUsageTarget: '/dev/admin-home',
      role: 'Shared',
    },
    users: {
      usedIn: ['Users admin'],
      openUsageTarget: '/dev/admin-home',
      role: 'Admin',
    },
    pdf: {
      usedIn: ['PDF viewers'],
      openUsageTarget: '/dev/admin-home',
      role: 'Shared',
    },
    profile: {
      usedIn: ['Profile'],
      openUsageTarget: '/dev/admin-home',
      role: 'Shared',
    },
  };

const EXISTING_DEV_SCREENS: LabRegistryEntry[] = [
  {
    id: 'screen.dev.admin-home',
    componentName: 'AdminHomeDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Admin',
    sourceFile: 'app/dev/admin-home.tsx',
    usedIn: ['Dev → Admin Home'],
    openUsageTarget: '/dev/admin-home',
    description: 'Existing admin home visual gallery.',
    interactive: true,
    tags: ['screen', 'admin', 'home'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.dealer-home',
    componentName: 'DealerHomeDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Dealer',
    sourceFile: 'app/dev/dealer-home.tsx',
    usedIn: ['Dev → Dealer Home'],
    openUsageTarget: '/dev/dealer-home',
    description: 'Existing dealer home visual gallery.',
    interactive: true,
    tags: ['screen', 'dealer'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.worker-home',
    componentName: 'WorkerHomeDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Worker',
    sourceFile: 'app/dev/worker-home.tsx',
    usedIn: ['Dev → Worker Home'],
    openUsageTarget: '/dev/worker-home',
    description: 'Existing worker home visual gallery.',
    interactive: true,
    tags: ['screen', 'worker'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.orders',
    componentName: 'OrdersDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Admin',
    sourceFile: 'app/dev/orders.tsx',
    usedIn: ['Dev → Orders'],
    openUsageTarget: '/dev/orders',
    description: 'Orders list gallery.',
    interactive: true,
    tags: ['screen', 'orders'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.order-detail',
    componentName: 'OrderDetailDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Admin',
    sourceFile: 'app/dev/order-detail.tsx',
    usedIn: ['Dev → Order detail'],
    openUsageTarget: '/dev/order-detail',
    description: 'Order detail gallery.',
    interactive: true,
    tags: ['screen', 'orders'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.tasks',
    componentName: 'TasksDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Worker',
    sourceFile: 'app/dev/tasks.tsx',
    usedIn: ['Dev → Tasks'],
    openUsageTarget: '/dev/tasks',
    description: 'Worker tasks gallery.',
    interactive: true,
    tags: ['screen', 'tasks'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.task-detail',
    componentName: 'TaskDetailDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Worker',
    sourceFile: 'app/dev/task-detail.tsx',
    usedIn: ['Dev → Task detail'],
    openUsageTarget: '/dev/task-detail',
    description: 'Task detail gallery.',
    interactive: true,
    tags: ['screen', 'tasks'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.catalog',
    componentName: 'CatalogDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Shared',
    sourceFile: 'app/dev/catalog.tsx',
    usedIn: ['Dev → Catalog'],
    openUsageTarget: '/dev/catalog',
    description: 'Catalog gallery.',
    interactive: true,
    tags: ['screen', 'catalog'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.product-detail',
    componentName: 'ProductDetailDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Shared',
    sourceFile: 'app/dev/product-detail.tsx',
    usedIn: ['Dev → Product detail'],
    openUsageTarget: '/dev/product-detail',
    description: 'Product detail gallery.',
    interactive: true,
    tags: ['screen', 'catalog'],
    representation: 'screen-link',
  },
  {
    id: 'screen.dev.new-order',
    componentName: 'NewOrderDevPreview',
    category: 'Full Screens',
    subcategory: 'Dev scenarios',
    role: 'Dealer',
    sourceFile: 'app/dev/new-order.tsx',
    usedIn: ['Dev → New order'],
    openUsageTarget: '/dev/new-order',
    description: 'New order gallery.',
    interactive: true,
    tags: ['screen', 'orders'],
    representation: 'screen-link',
  },
];

function categoryForPath(path: string): { category: string; subcategory?: string; role: LabRole } {
  if (path.startsWith('src/components/')) {
    const part = path.split('/')[2] ?? 'shared';
    return { category: 'Shared UI', subcategory: part, role: 'Shared' };
  }
  if (path.startsWith('src/motion/')) {
    return { category: 'States', subcategory: 'Motion', role: 'Shared' };
  }
  if (path.startsWith('app/')) {
    return { category: 'Full Screens', subcategory: 'Routes', role: 'Shared' };
  }
  const domain = path.match(/^src\/features\/([^/]+)/)?.[1];
  if (domain) {
    const meta = DOMAIN_USAGE[domain];
    const pretty = domain
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return {
      category: 'Features',
      subcategory: pretty,
      role: meta?.role ?? 'Shared',
    };
  }
  return { category: 'Features', role: 'Shared' };
}

function buildFromClassifications(): LabRegistryEntry[] {
  const map = classifications as Record<string, ClassRow>;
  const entries: LabRegistryEntry[] = [];
  const seen = new Set<string>();

  for (const [path, row] of Object.entries(map)) {
    if (row.classification === 'EXCLUDED_NON_VISUAL') continue;
    const { category, subcategory, role } = categoryForPath(path);
    const domain = path.match(/^src\/features\/([^/]+)/)?.[1];
    const domainMeta = domain ? DOMAIN_USAGE[domain] : undefined;

    const ids =
      row.registryIds.length > 0
        ? row.registryIds
        : [`file.${path.replace(/[/.]/g, '-')}`];

    ids.forEach((id, index) => {
      if (seen.has(id)) return;
      seen.add(id);
      const exportName =
        row.exportNames?.[index] ??
        row.exportNames?.[0] ??
        path.split('/').pop()?.replace('.tsx', '') ??
        id;
      const hasRich = Boolean(allRichRenderers[id]);
      entries.push({
        id,
        componentName: exportName,
        category: id === 'lab.foundations' ? 'Foundations' : category,
        subcategory,
        role: domainMeta?.role ?? role,
        sourceFile: path,
        usedIn: domainMeta?.usedIn ?? [category],
        openUsageTarget: domainMeta?.openUsageTarget,
        description:
          row.classification === 'REGISTERED'
            ? `Visual component from ${path}`
            : row.classification === 'SCREEN_LINK'
              ? `Screen / route — open usage for surrounding layout.`
              : `Feature visual represented under ${domain ?? 'parent'} — open usage for layout context.`,
        variants: hasRich
          ? id.includes('notification-board')
            ? ['unread', 'read']
            : ['default']
          : undefined,
        interactive: hasRich || Boolean(domainMeta?.openUsageTarget),
        tags: [
          category.toLowerCase(),
          subcategory?.toLowerCase() ?? '',
          role.toLowerCase(),
          exportName.toLowerCase(),
          path.toLowerCase(),
          row.classification.toLowerCase(),
        ].filter(Boolean),
        representation:
          hasRich || row.classification === 'REGISTERED'
            ? 'direct'
            : row.classification === 'SCREEN_LINK'
              ? 'screen-link'
              : 'parent',
        render: hasRich ? allRichRenderers[id] : undefined,
      });
    });
  }

  return entries;
}

const foundationsEntry: LabRegistryEntry = {
  id: 'lab.foundations',
  componentName: 'Foundations',
  displayName: 'Design foundations',
  category: 'Foundations',
  role: 'Shared',
  sourceFile: 'src/theme',
  usedIn: ['Entire app'],
  description: 'Typography, semantic colors, spacing, radius from live theme tokens.',
  interactive: true,
  tags: ['foundations', 'theme', 'tokens', 'typography', 'colors'],
  representation: 'direct',
  render: () => (
    <FoundationsDemo
      variant="default"
      resetKey={0}
      rolePreview="All"
    />
  ),
};

let cached: LabRegistryEntry[] | null = null;

export function getLabRegistry(): LabRegistryEntry[] {
  if (cached) return cached;
  const fromFiles = buildFromClassifications();
  // Attach rich renderers that may use slightly different id keys
  for (const entry of fromFiles) {
    if (!entry.render && allRichRenderers[entry.id]) {
      entry.render = allRichRenderers[entry.id];
      entry.interactive = true;
      entry.representation = 'direct';
    }
  }
  cached = [foundationsEntry, ...EXISTING_DEV_SCREENS, ...fromFiles];
  return cached;
}

export function getLabEntry(id: string): LabRegistryEntry | undefined {
  return getLabRegistry().find((e) => e.id === id);
}

export function getFileAuditRows(): FileAuditRow[] {
  const map = classifications as Record<string, ClassRow>;
  return Object.entries(map).map(([path, row]) => ({
    path,
    classification: row.classification,
    exportNames: row.exportNames ?? [],
    registryIds: row.registryIds,
    notes: row.notes,
  }));
}

export function getAuditStats() {
  const rows = getFileAuditRows();
  const stats = {
    totalFiles: rows.length,
    registered: 0,
    representedByParent: 0,
    screenLink: 0,
    excludedNonVisual: 0,
    unclassified: 0,
  };
  for (const r of rows) {
    if (r.classification === 'REGISTERED') stats.registered += 1;
    else if (r.classification === 'REPRESENTED_BY_PARENT') stats.representedByParent += 1;
    else if (r.classification === 'SCREEN_LINK') stats.screenLink += 1;
    else if (r.classification === 'EXCLUDED_NON_VISUAL') stats.excludedNonVisual += 1;
    else stats.unclassified += 1;
  }
  return stats;
}

export function filterRegistry(
  entries: LabRegistryEntry[],
  opts: {
    query?: string;
    role?: LabRole | 'All';
    category?: string;
    reviewFilter?: string;
    reviews?: Record<string, { state: string }>;
  },
): LabRegistryEntry[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  return entries.filter((e) => {
    if (opts.role && opts.role !== 'All' && e.role !== opts.role) return false;
    if (opts.category && opts.category !== 'All' && e.category !== opts.category) return false;
    if (opts.reviewFilter && opts.reviewFilter !== 'All' && opts.reviews) {
      const state = opts.reviews[e.id]?.state ?? 'unset';
      if (state !== opts.reviewFilter) return false;
    }
    if (!q) return true;
    const hay = [
      e.id,
      e.componentName,
      e.displayName ?? '',
      e.category,
      e.subcategory ?? '',
      e.role,
      e.sourceFile,
      e.description,
      ...e.tags,
      ...e.usedIn,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
