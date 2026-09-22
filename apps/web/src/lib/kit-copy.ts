'use client';

import type { AttachmentsCopy, DateFieldCopy, DateRangeCopy, ListToolbarCopy, PaginationCopy } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

/**
 * Pre-translated copy objects for the @maher/ui kit so pages never hand-wire
 * labels. One hook, memoised per locale.
 */
export function useKitCopy() {
  const t = useTranslations('common');
  const locale = useLocale();
  return useMemo(() => {
    const toolbar: ListToolbarCopy = { search: t('search'), filters: t('filters'), sort: t('sort'), clearSearch: t('clearSearch') };
    const pagination: PaginationCopy = { previous: t('previous'), next: t('next'), range: t.raw('paginationRange') as string, pageSize: t('rowsPerPage') };
    const date: DateFieldCopy = {
      placeholder: t('pickDate'),
      clear: t('clear'),
      today: t('today'),
      close: t('close'),
      prevMonth: t('prevMonth'),
      nextMonth: t('nextMonth'),
    };
    const range: DateRangeCopy = {
      placeholder: t('anyDates'),
      apply: t('apply'),
      clear: t('clear'),
      close: t('close'),
      prevMonth: t('prevMonth'),
      nextMonth: t('nextMonth'),
      presets: {
        today: t('presetToday'),
        week: t('presetWeek'),
        month: t('presetMonth'),
        last7: t('presetLast7'),
        last30: t('presetLast30'),
        last90: t('presetLast90'),
        ytd: t('presetYtd'),
      },
    };
    const attachments: AttachmentsCopy = { drop: t('dropFiles'), browse: t('browse'), remove: t('remove'), open: t('open') };
    const filters = { apply: t('filterApply'), clear: t('filterClear'), close: t('close'), title: t('filters') };
    const bulk = { label: t('selected'), clear: t('clear') };
    const combobox = { empty: t('noMatches'), loading: t('searching'), clear: t('clear') };
    const confirm = { confirm: t('confirm'), cancel: t('cancel'), reason: t('reason') };
    return { locale, toolbar, pagination, date, range, attachments, filters, bulk, combobox, confirm, unsaved: t('unsavedChanges') };
  }, [t, locale]);
}
