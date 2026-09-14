'use client';

import {
  localizeFloorNote,
  mgmtAttentionAction,
  mgmtAttentionTitle,
  mgmtAttentionWhy,
  mgmtBlockedWhy,
  mgmtEventLabel,
  mgmtFlowLabel,
  type MgmtTranslate,
} from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

export function useCatalogTranslate(): MgmtTranslate {
  const tMobile = useTranslations('mobile');
  const tStatuses = useTranslations('statuses');
  const tProduction = useTranslations('production');

  return (key, vars) => {
    try {
      if (key.startsWith('mobile.')) {
        return asString(tMobile(key.slice(7) as never, vars), key);
      }
      if (key.startsWith('statuses.')) {
        return asString(tStatuses(key.slice(9) as never, vars), key);
      }
      if (key.startsWith('production.')) {
        return asString(tProduction(key.slice(11) as never, vars), key);
      }
    } catch {
      return key;
    }
    return key;
  };
}

export function useMgmtCopy() {
  const locale = useLocale();
  const t = useCatalogTranslate();

  return {
    locale,
    t,
    flowLabel: (key: string, fallback: string) => mgmtFlowLabel(t, key, fallback),
    attentionTitle: (card: Parameters<typeof mgmtAttentionTitle>[1]) =>
      mgmtAttentionTitle(t, card),
    attentionWhy: (card: Parameters<typeof mgmtAttentionWhy>[2]) =>
      mgmtAttentionWhy(t, locale, card),
    attentionAction: (card: Parameters<typeof mgmtAttentionAction>[1]) =>
      mgmtAttentionAction(t, card),
    eventLabel: (event: Parameters<typeof mgmtEventLabel>[2]) =>
      mgmtEventLabel(t, locale, event),
    blockedWhy: (item: Parameters<typeof mgmtBlockedWhy>[2]) =>
      mgmtBlockedWhy(t, locale, item),
    floorNote: (raw: string | null | undefined) => localizeFloorNote(t, locale, raw),
  };
}
