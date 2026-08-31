import type { Href } from 'expo-router';

/**
 * Map admin-web management-summary href (+ optional filter) to a mobile Expo Router Href.
 * Parses compound filters (`a=b&c=d`) into real query keys destination screens understand.
 */
export function mapMgmtHref(webHref: string, filter?: string): Href {
  const raw = (webHref || '').trim();
  if (!raw) return '/(app)/(admin)/(tabs)' as Href;

  let path = raw;
  let search = '';
  const qIdx = raw.indexOf('?');
  if (qIdx >= 0) {
    path = raw.slice(0, qIdx);
    search = raw.slice(qIdx + 1);
  }
  if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length);
  if (!path.startsWith('/')) path = `/${path}`;

  const params = new URLSearchParams(search);
  absorbFilter(params, filter);

  const detail = matchDetail(path);
  if (detail) {
    const qs = params.toString();
    return (qs ? `${detail}?${qs}` : detail) as Href;
  }

  const base = mapListRoot(path, params);
  const qs = params.toString();
  return (qs ? `${base}?${qs}` : base) as Href;
}

/** When `filter` looks like `a=b&c=d`, expand into params; otherwise keep as a single token. */
function absorbFilter(params: URLSearchParams, filter?: string) {
  if (!filter) return;
  const trimmed = filter.trim();
  if (!trimmed) return;

  if (looksLikeQueryPairs(trimmed)) {
    const extra = new URLSearchParams(trimmed);
    for (const [k, v] of extra.entries()) {
      if (!params.has(k)) params.set(k, v);
    }
    return;
  }

  if (!params.has('filter') && !params.has('focus') && !params.has('bucket')) {
    params.set('filter', trimmed);
  }
}

function looksLikeQueryPairs(value: string): boolean {
  if (!value.includes('=')) return false;
  // Single token filters like "WAITING_RETURN" have no `=`.
  // `lifecycle=ready` and `a=b&c=d` do.
  return /(?:^|&)[^=&\s]+=/.test(value);
}

function matchDetail(path: string): string | null {
  const patterns: Array<[RegExp, (id: string) => string]> = [
    [/^\/sales-orders\/([^/]+)/, (id) => `/(app)/(admin)/orders/${id}`],
    [/^\/orders\/([^/]+)/, (id) => `/(app)/(admin)/orders/${id}`],
    [/^\/production\/([^/]+)/, (id) => `/(app)/(admin)/production/${id}`],
    [/^\/invoices\/([^/]+)/, (id) => `/(app)/(admin)/invoices/${id}`],
    [/^\/returns\/([^/]+)/, (id) => `/(app)/(admin)/returns/${id}`],
    [/^\/purchasing\/([^/]+)/, (id) => `/(app)/(admin)/purchasing/${id}`],
    [/^\/requests\/([^/]+)/, (id) => `/(app)/(admin)/requests/${id}`],
    [/^\/customers\/([^/]+)/, (id) => `/(app)/(admin)/dealers/${id}`],
    [/^\/dealers\/([^/]+)/, (id) => `/(app)/(admin)/dealers/${id}`],
    [/^\/deliveries\/([^/]+)/, (id) => `/(app)/(admin)/deliveries/${id}`],
    [/^\/inventory\/items\/([^/]+)/, (id) => `/(app)/(admin)/inventory/items/${id}`],
  ];
  for (const [re, to] of patterns) {
    const m = path.match(re);
    if (m?.[1]) return to(m[1]);
  }
  return null;
}

function mapListRoot(path: string, params: URLSearchParams): string {
  const root = path.replace(/\/+$/, '') || '/';

  switch (root) {
    case '/inventory':
      remapInventoryParams(params);
      return '/(app)/(admin)/(tabs)/inventory';
    case '/orders':
    case '/sales-orders':
      remapOrdersParams(params);
      return '/(app)/(admin)/(tabs)/orders';
    case '/requests':
      // Commercial desk — RFQ inbox lives on Orders (not needs_attention).
      if (!params.has('desk')) params.set('desk', 'requests');
      params.delete('filter');
      return '/(app)/(admin)/(tabs)/orders';
    case '/production':
      remapProductionParams(params);
      return '/(app)/(admin)/(tabs)/production';
    case '/quality':
      remapQualityParams(params);
      return '/(app)/(admin)/(tabs)/production';
    case '/purchasing':
      remapPurchasingParams(params);
      return '/(app)/(admin)/purchasing';
    case '/invoices':
      remapInvoiceParams(params);
      return '/(app)/(admin)/invoices';
    case '/returns':
      remapReturnsParams(params);
      return '/(app)/(admin)/returns';
    case '/deliveries':
      remapDeliveriesParams(params);
      return '/(app)/(admin)/scheduling';
    case '/customers':
    case '/dealers':
      return '/(app)/(admin)/dealers';
    case '/scheduling':
      return '/(app)/(admin)/scheduling';
    case '/reports':
    case '/dashboard':
      return '/(app)/(admin)/reports';
    default:
      return '/(app)/(admin)/(tabs)';
  }
}

const PRODUCTION_BUCKET_ALIASES: Record<string, string> = {
  waiting: 'inspection_packaging',
  blocked: 'blocked',
  on_floor: 'on_floor',
  needs_setup: 'needs_setup',
  ready: 'ready_to_start',
  ready_to_start: 'ready_to_start',
  late: 'late',
  completed: 'completed',
  completedToday: 'completed',
  in_production: 'on_floor',
  inspection_packaging: 'inspection_packaging',
  packaging: 'inspection_packaging',
  // Compound / API lifecycle tokens
  'lifecycle=ready': 'ready_to_start',
  'lifecycle=active': 'on_floor',
  'lifecycle=inspection': 'inspection_packaging',
  'lifecycle=packaging': 'inspection_packaging',
  'section=blocked': 'blocked',
  'section=late': 'late',
  'section=inQueue': 'ready_to_start',
  'section=completedToday': 'completed',
  WAITING_FOR_MATERIALS: 'blocked',
  'status=WAITING_FOR_MATERIALS': 'blocked',
};

function setProductionBucket(params: URLSearchParams, bucket: string) {
  if (!params.has('bucket')) params.set('bucket', bucket);
  params.delete('filter');
  params.delete('lifecycle');
  params.delete('section');
  params.delete('status');
}

function remapProductionParams(params: URLSearchParams) {
  if (params.has('bucket')) {
    const b = params.get('bucket')!;
    const mapped = PRODUCTION_BUCKET_ALIASES[b] ?? b;
    params.set('bucket', mapped);
    params.delete('filter');
    return;
  }

  const lifecycle = params.get('lifecycle');
  if (lifecycle) {
    const map: Record<string, string> = {
      ready: 'ready_to_start',
      ready_to_start: 'ready_to_start',
      active: 'on_floor',
      on_floor: 'on_floor',
      inspection: 'inspection_packaging',
      packaging: 'inspection_packaging',
      blocked: 'blocked',
    };
    setProductionBucket(params, map[lifecycle] ?? 'on_floor');
    return;
  }

  const section = params.get('section');
  if (section) {
    const map: Record<string, string> = {
      blocked: 'blocked',
      late: 'late',
      inQueue: 'ready_to_start',
      completedToday: 'completed',
      on_floor: 'on_floor',
      needs_setup: 'needs_setup',
      ready_to_start: 'ready_to_start',
      inspection_packaging: 'inspection_packaging',
    };
    setProductionBucket(params, map[section] ?? section);
    return;
  }

  const status = params.get('status');
  if (status === 'WAITING_FOR_MATERIALS') {
    setProductionBucket(params, 'blocked');
    return;
  }

  const filter = params.get('filter');
  if (filter) {
    const bucket = PRODUCTION_BUCKET_ALIASES[filter] ?? filter;
    setProductionBucket(params, bucket);
  }
}

function remapQualityParams(params: URLSearchParams) {
  const filter = (params.get('filter') ?? params.get('quality') ?? 'waiting').trim();
  const qualityKeys = new Set(['waiting', 'fail', 'reinspection', 'passedToday']);
  const quality = qualityKeys.has(filter) ? filter : 'waiting';

  params.set('bucket', 'inspection_packaging');
  params.set('quality', quality);
  params.delete('filter');
}

function remapInventoryParams(params: URLSearchParams) {
  // Nested `filter=lowStock|handoff` inside compound inventory filters → dedicated keys.
  const nested = params.get('filter');
  if (nested === 'lowStock') {
    params.set('lowStock', 'true');
    params.delete('filter');
  } else if (nested === 'handoff') {
    params.set('handoff', 'true');
    params.delete('filter');
  }

  const lifecycle = params.get('lifecycle');
  if (lifecycle === 'materials' || lifecycle === 'semiFinished' || lifecycle === 'finished') {
    // keep as-is — InventorySignatureHome reads these
  }

  // tab=corrections already a first-class param
}

function remapOrdersParams(params: URLSearchParams) {
  const journey = params.get('journey');
  if (journey === 'preparing' || journey === 'ready_to_start' || journey === 'in_production') {
    if (!params.has('chip')) params.set('chip', journey);
    if (!params.has('focus')) params.set('focus', journey);
  }

  if (params.get('late') === 'true') {
    // Soft badge on home buckets — no Attention chip.
    params.set('late', 'true');
    params.delete('chip');
  }

  const setup = params.get('setup');
  if (setup) {
    if (!params.has('chip')) params.set('chip', 'preparing');
    params.set('setup', setup);
  }

  const disposition = params.get('disposition');
  if (disposition) {
    // Soft badge — land on All orders
    params.set('disposition', disposition);
    params.delete('chip');
  }

  const filter = params.get('filter');
  if (filter === 'inbox') {
    params.set('desk', 'requests');
    params.delete('filter');
  } else if (filter && looksLikeQueryPairs(filter)) {
    // already expanded by absorbFilter; leftover should not become chip
    params.delete('filter');
  } else if (filter && !params.has('chip') && !params.has('focus')) {
    params.set('chip', filter);
    params.delete('filter');
  }
}

function remapPurchasingParams(params: URLSearchParams) {
  const needs = params.get('needs');
  if (needs === 'purchasing') {
    params.set('tab', 'orders');
    params.set('focus', 'needs');
  }
  if (params.get('arriving') === 'today') {
    params.set('tab', 'orders');
    params.set('arriving', 'today');
  }
  if (params.get('late') === 'true') {
    params.set('tab', 'orders');
    params.set('late', 'true');
  }
  params.delete('filter');
}

function remapInvoiceParams(params: URLSearchParams) {
  if (params.get('overdue') === 'true') {
    params.set('chip', 'OVERDUE');
    params.delete('overdue');
    params.delete('filter');
    params.delete('open');
    return;
  }
  if (params.get('open') === 'true') {
    params.set('chip', 'OPEN');
    params.delete('open');
    params.delete('filter');
  }
}

function remapReturnsParams(params: URLSearchParams) {
  const physical = params.get('physical');
  if (physical) {
    // Physical lifecycle — keep `physical` for destination readers; also expose as chip when known.
    params.set('physical', physical);
    if (!params.has('chip')) params.set('chip', physical);
  }

  const approval = params.get('approval');
  if (approval) {
    params.set('chip', approval);
    params.delete('approval');
  }

  const filter = params.get('filter');
  if (filter && !params.has('chip') && !params.has('physical')) {
    params.set('chip', filter);
    params.delete('filter');
  } else if (filter) {
    params.delete('filter');
  }
}

function remapDeliveriesParams(params: URLSearchParams) {
  const section = params.get('section');
  if (section) {
    params.set('section', section);
  }
  // `when=today` kept as-is for scheduling readers
  params.delete('filter');
}
