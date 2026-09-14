import { localizeFloorNote } from './floorNote';

export type MgmtCopyParams = Record<string, string | number | boolean | null | undefined>;

export type MgmtTranslate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export type MgmtKeyedCard = {
  title?: string;
  why?: string;
  actionLabel?: string;
  titleKey?: string | null;
  whyKey?: string | null;
  actionKey?: string | null;
  whyParams?: MgmtCopyParams | null;
};

export type MgmtKeyedEvent = {
  label?: string;
  kind?: string | null;
  params?: MgmtCopyParams | null;
};

export type MgmtKeyedBlocked = {
  why?: string;
  whyKey?: string | null;
  whyParams?: MgmtCopyParams | null;
};

type MoneyFn = (amount: number) => string;

const FLOW_PREFIX = 'mobile.adminHome.mgmt.flow.';
const WHY_PREFIX = 'mobile.adminHome.mgmt.why.';
const ACTION_PREFIX = 'mobile.adminHome.mgmt.action.';
const TITLE_PREFIX = 'mobile.adminHome.mgmt.title.';
const ACTIVITY_PREFIX = 'mobile.adminHome.mgmt.activity.';
const BLOCKED_PREFIX = 'mobile.adminHome.mgmt.blocked.';
const BLOCKER_CAT_PREFIX = 'mobile.tasks.blocker.';

function squash(text: string): string {
  return text.trim().replace(/[—–]/g, '-').replace(/\s+/g, ' ');
}

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asVars(params?: MgmtCopyParams | null): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === false) continue;
    if (typeof value === 'boolean') continue;
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

function tr(
  t: MgmtTranslate,
  key: string,
  vars?: Record<string, string | number>,
  fallback = '',
): string {
  const value = vars ? t(key, vars) : t(key);
  if (!value || value === key) return fallback;
  return value;
}

const WHY_BY_ENGLISH: Record<string, string> = {
  'Past committed / required delivery - schedule marked late': 'lateDelivery',
  'Past committed delivery - needs reschedule or expedite': 'lateDelivery',
  'Quality failed - open rework or blocked inspection': 'qualityFailed',
  'Quality fail waiting for rework disposition': 'qualityFailed',
  'Approved return - waiting for physical receipt': 'returnWaiting',
  'Approved return still waiting pickup': 'returnWaiting',
  'Returned goods awaiting inspection / fate': 'returnInspect',
  'Production setup incomplete (SETUP_REQUIRED)': 'setupRequired',
  'Production setup incomplete': 'setupRequired',
  'Waiting for materials - production blocked': 'waitingMaterials',
  'Waiting for materials': 'waitingMaterials',
  'Waiting material - foam shortage': 'waitingMaterials',
  'Order on hold': 'orderOnHold',
  'Open blocker on floor task': 'openBlocker',
};

const ACTION_BY_ENGLISH: Record<string, string> = {
  'Review schedule': 'reviewSchedule',
  'Open quality': 'openQuality',
  'Confirm returned': 'confirmReturned',
  'Inspect return': 'inspectReturn',
  'Continue setup': 'continueSetup',
  'View materials': 'viewMaterials',
  'Open statement': 'openStatement',
  'Open inventory': 'openInventory',
  'Open order': 'openOrder',
  'Open return': 'openReturn',
};

const TITLE_BY_ENGLISH: Record<string, string> = {
  'Raw shortages': 'rawShortages',
};

function pickName(locale: string, params: MgmtCopyParams, t: MgmtTranslate): string {
  const nameAr = str(params.nameAr);
  const nameHe = str(params.nameHe);
  const nameEn = str(params.nameEn);
  const name = str(params.name);
  let picked = '';
  if (locale === 'ar') picked = nameAr || name || nameEn || nameHe;
  else if (locale === 'he') picked = nameHe || name || nameEn || nameAr;
  else picked = nameEn || name || nameAr || nameHe;
  if (!picked || picked === 'Dealer') {
    return tr(t, 'mobile.adminHome.activityEntity.Customer', undefined, picked || 'Dealer');
  }
  return picked;
}

const STAGE_NAME_TO_CODE: Record<string, string> = {
  painting: 'PAINTING',
  paint: 'PAINTING',
  carpentry: 'CARPENTRY',
  'material preparation': 'MATERIAL_PREP',
  packaging: 'PACKAGING',
  upholstery: 'UPHOLSTERY',
  assembly: 'ASSEMBLY',
  inspection: 'INSPECTION',
  'foam preparation': 'FOAM',
  foam: 'FOAM',
};

function pickStage(t: MgmtTranslate, locale: string, params: MgmtCopyParams): string {
  const rawCode =
    str(params.stageCode) ||
    STAGE_NAME_TO_CODE[(str(params.stageEn) || str(params.stage)).toLowerCase()];
  const code = rawCode === 'PAINT' ? 'PAINTING' : rawCode;
  if (code) {
    const fromLib = tr(t, `production.stageLibrary.${code}`, undefined, '');
    if (fromLib) return fromLib;
  }
  const ar = str(params.stageAr);
  const he = str(params.stageHe);
  const en = str(params.stageEn) || str(params.stage);
  if (locale === 'ar') return ar || en || he;
  if (locale === 'he') return he || en || ar;
  return en || ar || he;
}

function localizeStatus(t: MgmtTranslate, code: string): string {
  const key = `statuses.${code}`;
  return tr(t, key, undefined, code.replace(/_/g, ' '));
}

function formatAmount(
  raw: string | number | undefined,
  formatMoney?: MoneyFn,
): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && formatMoney) return formatMoney(raw);
  const n = Number(raw);
  if (formatMoney && Number.isFinite(n)) return formatMoney(n);
  return String(raw);
}

function inferWhyKey(why: string): { key: string; params?: Record<string, string> } | null {
  const exact = WHY_BY_ENGLISH[squash(why)];
  if (exact) return { key: exact };

  let m = why.match(/^(.+) has overdue balance (.+)$/i);
  if (m?.[1] && m[2]) return { key: 'overdueBalance', params: { name: m[1], amount: m[2] } };

  m = why.match(/^(\d+) raw items at or below min stock$/i);
  if (m?.[1]) return { key: 'rawShortages', params: { count: m[1] } };

  m = why.match(/^([A-Z][A-Z0-9_]+):\s*(.+)$/);
  if (m?.[1] && m[2]) return { key: 'blocker', params: { category: m[1], reason: m[2] } };

  return null;
}

export function inferMgmtEvent(label: string): { kind: string; params: Record<string, string> } | null {
  const text = label.trim();
  if (!text) return null;
  let m: RegExpMatchArray | null;

  m = text.match(/^Completed (.+) on (.+)$/i);
  if (m?.[1] && m[2]) return { kind: 'taskCompleted', params: { stage: m[1], number: m[2] } };

  m = text.match(/^(.+) started on (.+)$/i);
  if (m?.[1] && m[2]) return { kind: 'taskStarted', params: { stage: m[1], number: m[2] } };

  m = text.match(/^Truck departed (.+)$/i);
  if (m?.[1]) return { kind: 'truckDeparted', params: { number: m[1] } };

  m = text.match(/^Delivery (.+) updated$/i);
  if (m?.[1]) return { kind: 'deliveryUpdated', params: { number: m[1] } };

  m = text.match(/^QC (.+): (.+)$/i);
  if (m?.[1] && m[2]) return { kind: 'qc', params: { number: m[1], result: m[2] } };

  m = text.match(/^QC passed (.+)$/i);
  if (m?.[1]) return { kind: 'qc', params: { number: m[1], result: 'PASSED' } };

  m = text.match(/^GRN (.+) for (.+)$/i);
  if (m?.[1] && m[2]) return { kind: 'grn', params: { number: m[1], po: m[2] } };

  m = text.match(/^Payment (.+) from (.+)$/i);
  if (m?.[1] && m[2]) return { kind: 'payment', params: { number: m[1], name: m[2] } };

  m = text.match(/^Finished goods posted \((.+)\)$/i);
  if (m?.[1]) return { kind: 'finishedGoods', params: { number: m[1] } };

  if (/^Finished goods posted$/i.test(text)) {
    return { kind: 'finishedGoodsPlain', params: {} };
  }

  m = text.match(/^Return (\S+)\s*(?:→|->)\s*(\S+)$/i);
  if (m?.[1] && m[2]) return { kind: 'returnStatus', params: { number: m[1], status: m[2] } };

  m = text.match(/^(.+) status updated$/i);
  if (m?.[1]) return { kind: 'statusUpdated', params: { number: m[1] } };

  m = text.match(/^(.+) received materials$/i);
  if (m?.[1]) return { kind: 'materialsReceived', params: { number: m[1] } };

  m = text.match(/^Invoice (.+) issued$/i);
  if (m?.[1]) return { kind: 'invoiceIssued', params: { number: m[1] } };

  return null;
}

export function mgmtFlowLabel(t: MgmtTranslate, key: string, fallback = ''): string {
  return tr(t, `${FLOW_PREFIX}${key}`, undefined, fallback);
}

export function mgmtAttentionTitle(t: MgmtTranslate, card: MgmtKeyedCard): string {
  const fromKey = card.titleKey
    ? tr(t, `${TITLE_PREFIX}${card.titleKey}`, asVars(card.whyParams), '')
    : '';
  if (fromKey) return fromKey;
  const mapped = card.title ? TITLE_BY_ENGLISH[squash(card.title)] : undefined;
  if (mapped) {
    const labeled = tr(t, `${TITLE_PREFIX}${mapped}`, undefined, card.title ?? '');
    if (labeled) return labeled;
  }
  return card.title ?? '';
}

export function mgmtAttentionAction(t: MgmtTranslate, card: MgmtKeyedCard): string {
  const key = card.actionKey || (card.actionLabel ? ACTION_BY_ENGLISH[card.actionLabel] : undefined);
  if (key) {
    const labeled = tr(t, `${ACTION_PREFIX}${key}`, undefined, card.actionLabel ?? '');
    if (labeled) return labeled;
  }
  return card.actionLabel ?? '';
}

function composeBlockerWhy(
  t: MgmtTranslate,
  locale: string,
  params: MgmtCopyParams,
): string {
  const categoryCode = str(params.category);
  const category =
    tr(t, `${BLOCKER_CAT_PREFIX}${categoryCode}`, undefined, '') ||
    categoryCode.replace(/_/g, ' ');
  const reason = localizeFloorNote(t, locale, str(params.reason));
  if (category && reason) {
    return tr(t, `${WHY_PREFIX}blocker`, { category, reason }, `${category}: ${reason}`);
  }
  return reason || category;
}

export function mgmtAttentionWhy(
  t: MgmtTranslate,
  locale: string,
  card: MgmtKeyedCard,
  opts?: { formatMoney?: MoneyFn },
): string {
  const inferred = card.why ? inferWhyKey(card.why) : null;
  const key = card.whyKey || inferred?.key;
  const params: MgmtCopyParams = {
    ...inferred?.params,
    ...card.whyParams,
  };

  if (key === 'blocker') return composeBlockerWhy(t, locale, params);

  if (key) {
    const vars = asVars(params);
    if (key === 'overdueBalance') {
      vars.name = pickName(locale, params, t);
      vars.amount = formatAmount(
        (params.amount as string | number | undefined) ?? vars.amount,
        opts?.formatMoney,
      );
    }
    const labeled = tr(t, `${WHY_PREFIX}${key}`, vars, card.why ?? '');
    if (labeled) return labeled;
  }

  return card.why ?? '';
}

export function mgmtEventLabel(
  t: MgmtTranslate,
  locale: string,
  event: MgmtKeyedEvent,
): string {
  const inferred = event.label ? inferMgmtEvent(event.label) : null;
  const kind = event.kind || inferred?.kind;
  const params: MgmtCopyParams = { ...inferred?.params, ...event.params };

  if (kind) {
    const vars = asVars(params);
    if (kind === 'taskCompleted' || kind === 'taskStarted') {
      vars.stage = pickStage(t, locale, params);
    }
    if (kind === 'payment') {
      vars.name = pickName(locale, params, t);
    }
    if (kind === 'qc' && params.result != null) {
      vars.result = localizeStatus(t, str(params.result));
    }
    if (kind === 'returnStatus' && params.status != null) {
      vars.status = localizeStatus(t, str(params.status));
    }
    const activityKey = kind === 'finishedGoods' && !str(params.number)
      ? 'finishedGoodsPlain'
      : kind;
    const labeled = tr(t, `${ACTIVITY_PREFIX}${activityKey}`, vars, event.label ?? '');
    if (labeled) return labeled;
  }

  const fallback = event.label ?? '';
  if (locale !== 'en' && fallback && !/[\u0600-\u06FF\u0590-\u05FF]/.test(fallback)) {
    return tr(t, 'mobile.adminHome.activityVerb.fallback', undefined, fallback);
  }
  return fallback;
}

export function mgmtBlockedWhy(
  t: MgmtTranslate,
  locale: string,
  item: MgmtKeyedBlocked,
): string {
  const inferred = item.why ? inferWhyKey(item.why) : null;
  const key = item.whyKey || inferred?.key;
  const params: MgmtCopyParams = { ...inferred?.params, ...item.whyParams };

  if (key === 'blocker') return composeBlockerWhy(t, locale, params);

  if (key) {
    const labeled = tr(
      t,
      `${BLOCKED_PREFIX}${key}`,
      asVars(params),
      tr(t, `${WHY_PREFIX}${key}`, asVars(params), item.why ?? ''),
    );
    if (labeled) return labeled;
  }

  if (item.why) return localizeFloorNote(t, locale, item.why);
  return '';
}
