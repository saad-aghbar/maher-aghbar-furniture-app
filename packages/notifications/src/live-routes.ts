/**
 * Live Expo Router files that notification destinations may open.
 * Do not add a path here unless the file exists under apps/mobile/app.
 */
export const LIVE_EXPO_ROUTE_FILES = [
  '(app)/notifications/index.tsx',
  '(app)/(admin)/(tabs)/index.tsx',
  '(app)/(admin)/(tabs)/orders.tsx',
  '(app)/(admin)/(tabs)/production.tsx',
  '(app)/(admin)/(tabs)/inventory.tsx',
  '(app)/(admin)/orders/[id]/index.tsx',
  '(app)/(admin)/orders/[id]/production-setup/index.tsx',
  '(app)/(admin)/production/[id]/index.tsx',
  '(app)/(admin)/production/tasks/[id].tsx',
  '(app)/(admin)/production/problems.tsx',
  '(app)/(admin)/deliveries/[id].tsx',
  '(app)/(admin)/returns/[id].tsx',
  '(app)/(admin)/invoices/[id].tsx',
  '(app)/(admin)/purchasing/[id].tsx',
  '(app)/(admin)/purchasing/index.tsx',
  '(app)/(admin)/purchasing/fabric/[id].tsx',
  '(app)/(admin)/inventory/items/[id].tsx',
  '(app)/(admin)/inventory/low-stock.tsx',
  '(app)/(admin)/inventory/receive/[id].tsx',
  '(app)/(admin)/inventory/finished/[salesOrderId].tsx',
  '(app)/(admin)/requests/[id].tsx',
  '(app)/(admin)/quotations/[id].tsx',
  '(app)/(admin)/ai-intake/[id].tsx',
  '(app)/(admin)/dealers/[id]/index.tsx',
  '(app)/(admin)/users/index.tsx',
  '(app)/(admin)/scheduling/index.tsx',
  '(app)/(admin)/more/account.tsx',
  '(app)/(customer)/(tabs)/index.tsx',
  '(app)/(customer)/(tabs)/orders.tsx',
  '(app)/(customer)/(tabs)/schedule.tsx',
  '(app)/(customer)/(tabs)/account.tsx',
  '(app)/(customer)/orders/[id]/index.tsx',
  '(app)/(customer)/invoices/[id].tsx',
  '(app)/(customer)/returns/[id].tsx',
  '(app)/(customer)/quotations/[id].tsx',
  '(app)/(customer)/requests/[id].tsx',
  '(app)/(customer)/deliveries/[id].tsx',
  '(app)/(customer)/account/statement.tsx',
  '(app)/(customer)/account/payments.tsx',
  '(app)/(customer)/account/calendar.tsx',
  '(app)/(employee)/(tabs)/index.tsx',
  '(app)/(employee)/(tabs)/tasks.tsx',
  '(app)/(employee)/(tabs)/notifications.tsx',
  '(app)/(employee)/(tabs)/profile.tsx',
  '(app)/(employee)/tasks/[id]/index.tsx',
  '(app)/(employee)/tasks/[id]/take-in.tsx',
  '(app)/(employee)/deliveries/[id].tsx',
  '(app)/(employee)/orders/[salesOrderId].tsx',
  '(app)/(employee)/lane/[id].tsx',
] as const;

/** Href patterns produced by the mapper (params are `:id` / `:salesOrderId`). */
export const LIVE_EXPO_HREF_PATTERNS = [
  '/(app)/notifications',
  '/(app)/(admin)/(tabs)',
  '/(app)/(admin)/(tabs)/orders',
  '/(app)/(admin)/(tabs)/production',
  '/(app)/(admin)/(tabs)/inventory',
  '/(app)/(admin)/orders/:id',
  '/(app)/(admin)/orders/:id/production-setup',
  '/(app)/(admin)/production/:id',
  '/(app)/(admin)/production/tasks/:id',
  '/(app)/(admin)/production/problems',
  '/(app)/(admin)/deliveries/:id',
  '/(app)/(admin)/returns/:id',
  '/(app)/(admin)/invoices/:id',
  '/(app)/(admin)/purchasing/:id',
  '/(app)/(admin)/purchasing',
  '/(app)/(admin)/purchasing/fabric/:id',
  '/(app)/(admin)/inventory/items/:id',
  '/(app)/(admin)/inventory/low-stock',
  '/(app)/(admin)/inventory/receive/:id',
  '/(app)/(admin)/inventory/finished/:salesOrderId',
  '/(app)/(admin)/requests/:id',
  '/(app)/(admin)/quotations/:id',
  '/(app)/(admin)/ai-intake/:id',
  '/(app)/(admin)/dealers/:id',
  '/(app)/(admin)/users',
  '/(app)/(admin)/scheduling',
  '/(app)/(admin)/more/account',
  '/(app)/(customer)/(tabs)',
  '/(app)/(customer)/(tabs)/orders',
  '/(app)/(customer)/(tabs)/schedule',
  '/(app)/(customer)/(tabs)/account',
  '/(app)/(customer)/orders/:id',
  '/(app)/(customer)/invoices/:id',
  '/(app)/(customer)/returns/:id',
  '/(app)/(customer)/quotations/:id',
  '/(app)/(customer)/requests/:id',
  '/(app)/(customer)/deliveries/:id',
  '/(app)/(customer)/account/statement',
  '/(app)/(customer)/account/payments',
  '/(app)/(customer)/account/calendar',
  '/(app)/(employee)/(tabs)',
  '/(app)/(employee)/(tabs)/tasks',
  '/(app)/(employee)/(tabs)/notifications',
  '/(app)/(employee)/(tabs)/profile',
  '/(app)/(employee)/tasks/:id',
  '/(app)/(employee)/tasks/:id/take-in',
  '/(app)/(employee)/deliveries/:id',
  '/(app)/(employee)/orders/:salesOrderId',
  '/(app)/(employee)/lane/:id',
] as const;

export const SURFACE_HUB_HREF = {
  admin: '/(app)/(admin)/(tabs)',
  customer: '/(app)/(customer)/(tabs)',
  employee: '/(app)/(employee)/(tabs)',
} as const;

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split `:id` tokens first so escaping `(app)` groups cannot swallow param replacement. */
function patternToRegex(pattern: string): RegExp {
  const parts: string[] = [];
  const param = /:[A-Za-z_][A-Za-z0-9_]*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = param.exec(pattern)) !== null) {
    parts.push(escapeRegexLiteral(pattern.slice(lastIndex, match.index)));
    parts.push('[^/]+');
    lastIndex = match.index + match[0].length;
  }
  parts.push(escapeRegexLiteral(pattern.slice(lastIndex)));
  return new RegExp(`^${parts.join('')}$`);
}

const PATTERN_REGEX = LIVE_EXPO_HREF_PATTERNS.map((pattern) => ({
  pattern,
  re: patternToRegex(pattern),
}));

export function isLiveExpoHref(href: string): boolean {
  const path = href.split('?')[0] ?? href;
  return PATTERN_REGEX.some((row) => row.re.test(path));
}

export function assertLiveExpoHref(href: string): string {
  if (!isLiveExpoHref(href)) {
    throw new Error(`Notification href is not a live Expo route: ${href}`);
  }
  return href;
}

export function hrefForSurfaceGroup(href: string): 'admin' | 'customer' | 'employee' | 'shared' {
  if (href.includes('(admin)')) return 'admin';
  if (href.includes('(customer)')) return 'customer';
  if (href.includes('(employee)')) return 'employee';
  return 'shared';
}
