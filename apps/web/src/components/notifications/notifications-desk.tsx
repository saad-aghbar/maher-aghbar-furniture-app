'use client';

import { apiFetch } from '@/lib/api-client';
import { asRows } from '@/lib/paginated';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  useToast,
  Board,
  BoardSkeleton,
  Button,
  ErrorBoard,
  Figure,
  ListRow,
  ListRows,
  Ltr,
  SectionTabs,
  SegmentedControl,
  Sheet,
  Stamp,
  Switch,
  type BoardTone,
} from '@maher/ui';
import { localizedBody, localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, FileText, Inbox, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Template {
  id: string;
  code: string;
  channel: string;
  subjectEn?: string | null;
  subjectAr?: string | null;
  bodyEn: string;
  bodyAr: string;
}

interface InboxItem {
  id: string;
  type: string;
  titleEn: string;
  titleAr?: string | null;
  bodyEn: string;
  bodyAr?: string | null;
  readAt?: string | null;
  createdAt: string;
}

interface TopicsResponse {
  canPauseAllDevices: boolean;
  masterEnabled: boolean;
  groups: Array<{ id: string; name: string }>;
  topics: Array<{ code: string; group: string; name: string; hint: string; urgency: string; defaultOn: boolean; enabled: boolean }>;
}

type NotificationsTab = 'inbox' | 'prefs' | 'templates';

function kindTone(type: string): BoardTone {
  const key = type.toUpperCase();
  if (/(OVERDUE|FAIL|REJECT|PROBLEM|LATE|CONFLICT|SCRAP)/.test(key)) return 'error';
  if (/(LOW_STOCK|WAITING|PENDING|DUE|NEED|ATTENTION|REMIND)/.test(key)) return 'warning';
  if (/(DELIVER|PAID|COMPLETE|APPROVED|READY|RECEIVED)/.test(key)) return 'success';
  if (/(QUOT|ORDER|RFQ|INVOICE)/.test(key)) return 'brand';
  return 'info';
}

/** Inbox + preferences (+ templates for admins). Shared by the admin and dealer portals. */
export function NotificationsDesk({ surface = 'admin' }: { surface?: 'admin' | 'dealer' }) {
  const showTemplates = surface === 'admin';
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<NotificationsTab>('inbox');
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);
  const [previewLocale, setPreviewLocale] = useState<'ar' | 'en'>('ar');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const templatesQuery = useQuery({ queryKey: ['notification-templates'], queryFn: () => apiFetch<Template[]>('/api/v1/notifications/templates'), enabled: showTemplates });
  const inboxQuery = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => apiFetch<unknown>('/api/v1/notifications').then((json) => asRows<InboxItem>(json)),
  });
  const topicsQuery = useQuery({ queryKey: ['notification-topics'], queryFn: () => apiFetch<TopicsResponse>('/api/v1/notifications/topics'), retry: false });

  const readAll = useMutation({
    mutationFn: () => apiFetch('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const savePrefs = useMutation({
    mutationFn: (body: { topics?: Record<string, boolean>; masterEnabled?: boolean }) => apiFetch('/api/v1/notifications/preferences', { method: 'PUT', body: JSON.stringify(body) }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ['notification-topics'] });
      const previous = queryClient.getQueryData<TopicsResponse>(['notification-topics']);
      if (previous) {
        queryClient.setQueryData<TopicsResponse>(['notification-topics'], {
          ...previous,
          masterEnabled: body.masterEnabled ?? previous.masterEnabled,
          topics: previous.topics.map((topic) => (body.topics && topic.code in body.topics ? { ...topic, enabled: body.topics[topic.code]! } : topic)),
        });
      }
      return { previous };
    },
    onError: (err, _body, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['notification-topics'], ctx.previous);
      toast.error(mutationErrorMessage(err));
    },
    onSuccess: () => toast.success(tc('prefsSaved')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notification-topics'] }),
  });

  const inbox = useMemo(() => asRows<InboxItem>(inboxQuery.data), [inboxQuery.data]);
  const unread = inbox.filter((n) => !n.readAt).length;
  const groups = useMemo(() => {
    const rows = filter === 'unread' ? inbox.filter((n) => !n.readAt) : inbox;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const buckets: Array<{ id: string; label: string; items: InboxItem[] }> = [
      { id: 'today', label: tCommon('today'), items: [] },
      { id: 'yesterday', label: tCommon('yesterday'), items: [] },
      { id: 'earlier', label: tCommon('earlier'), items: [] },
    ];
    for (const n of rows) {
      const at = new Date(n.createdAt);
      (at >= startOfToday ? buckets[0] : at >= startOfYesterday ? buckets[1] : buckets[2])!.items.push(n);
    }
    return buckets.filter((b) => b.items.length);
  }, [inbox, filter, tCommon]);

  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if ((showTemplates && templatesQuery.isLoading && !templatesQuery.data) || (inboxQuery.isLoading && !inboxQuery.data)) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }
  if (inboxQuery.isError && !inboxQuery.data) {
    return (
      <ErrorBoard
        title={t('notifications')}
        description={tCommon('loadFailed')}
        onRetry={() => {
          templatesQuery.refetch();
          inboxQuery.refetch();
        }}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const templates = templatesQuery.data ?? [];
  const topics = topicsQuery.data;

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={unread ? 'brand' : 'neutral'} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('notifications')}</h1>
              <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{unread ? tc('unreadCount', { n: unread }) : tCommon('noNotifications')}</p>
            </div>
            {unread ? (
              <Button variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate()}>
                {tCommon('markAllRead')}
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-5 lg:min-w-[20rem]">
            <Figure size="sm" value={unread} label={tCommon('unread')} tone={unread ? 'brand' : 'neutral'} />
            <Figure size="sm" value={inbox.length} label={tc('inbox')} />
            <Figure size="sm" value={topics ? topics.topics.filter((x) => x.enabled).length : showTemplates ? templates.length : 0} label={topics ? tc('notificationPrefs') : showTemplates ? tc('templates') : tc('notificationPrefs')} tone="info" />
          </div>
        </div>
      </Board>

      <SectionTabs
        aria-label={t('notifications')}
        value={tab}
        onChange={(id) => setTab(id as NotificationsTab)}
        items={[
          { id: 'inbox', label: tc('inbox'), icon: <Inbox className="h-4 w-4" />, count: unread || undefined },
          { id: 'prefs', label: tc('notificationPrefs'), icon: <SlidersHorizontal className="h-4 w-4" /> },
          ...(showTemplates ? [{ id: 'templates', label: tc('templates'), icon: <FileText className="h-4 w-4" />, count: templates.length || undefined }] : []),
        ]}
      />

      {tab === 'inbox' ? (
        <Board tone="neutral">
          <Board.Header
            title={tc('inbox')}
            meta={
              <SegmentedControl<'all' | 'unread'>
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: tCommon('all') },
                  { value: 'unread', label: tCommon('unread') },
                ]}
              />
            }
          />
          {groups.length === 0 ? (
            <Board.Empty title={tCommon('noNotifications')} />
          ) : (
            groups.map((group) => (
              <section key={group.id} aria-label={group.label}>
                <h3 className="px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{group.label}</h3>
                <ListRows>
                  {group.items.map((n) => (
                    <ListRow
                      key={n.id}
                      tone={kindTone(n.type)}
                      title={
                        <span className="flex items-center gap-2">
                          <span className={n.readAt ? 'text-[var(--maher-text-secondary)]' : 'font-semibold'}>{localizedName(locale, { titleAr: n.titleAr, titleEn: n.titleEn })}</span>
                          {!n.readAt ? <span className="h-2 w-2 rounded-full bg-[var(--maher-brand)]" aria-label={tCommon('unread')} /> : null}
                        </span>
                      }
                      meta={<span className="line-clamp-2">{localizedBody(locale, { bodyAr: n.bodyAr, bodyEn: n.bodyEn })}</span>}
                      trailing={
                        <span className="flex items-center gap-2">
                          <Ltr className="text-[12px] text-[var(--maher-text-tertiary)]">{group.id === 'earlier' ? dateFmt.format(new Date(n.createdAt)) : timeFmt.format(new Date(n.createdAt))}</Ltr>
                          {!n.readAt ? (
                            <Button size="sm" variant="ghost" loading={markRead.isPending && markRead.variables === n.id} onClick={() => markRead.mutate(n.id)}>
                              {tCommon('markRead')}
                            </Button>
                          ) : null}
                        </span>
                      }
                      chevron={false}
                    />
                  ))}
                </ListRows>
              </section>
            ))
          )}
        </Board>
      ) : null}

      {tab === 'prefs' ? (
        topicsQuery.isLoading ? (
          <BoardSkeleton rows={6} />
        ) : !topics ? (
          <Alert variant="info">{tc('notificationsProvidersHint')}</Alert>
        ) : (
          <div className="space-y-5">
            {topics.canPauseAllDevices ? (
              <Board tone={topics.masterEnabled ? 'success' : 'warning'} wash="top">
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="flex items-center gap-3">
                    {topics.masterEnabled ? <Bell className="h-5 w-5 text-[var(--maher-success)]" /> : <BellOff className="h-5 w-5 text-[var(--maher-warning)]" />}
                    <span>
                      <span className="block text-[14px] font-semibold text-[var(--maher-text-primary)]">{tc('pauseAll')}</span>
                      <span className="block text-[12px] text-[var(--maher-text-tertiary)]">{tc('notificationPrefsHint')}</span>
                    </span>
                  </span>
                  <Switch checked={!topics.masterEnabled} onChange={(paused) => savePrefs.mutate({ masterEnabled: !paused })} aria-label={tc('pauseAll')} />
                </div>
              </Board>
            ) : (
              <p className="text-[14px] text-[var(--maher-text-secondary)]">{tc('notificationPrefsHint')}</p>
            )}
            <div className="maher-stagger grid gap-5 lg:grid-cols-2">
              {topics.groups.map((group) => {
                const items = topics.topics.filter((x) => x.group === group.id);
                if (!items.length) return null;
                const on = items.filter((x) => x.enabled).length;
                return (
                  <Board key={group.id} tone={on ? 'brand' : 'neutral'}>
                    <Board.Header title={group.name} meta={<Stamp tone={on ? 'brand' : 'neutral'} size="sm">{`${on}/${items.length}`}</Stamp>} />
                    <ul className="divide-y divide-[var(--maher-border)]">
                      {items.map((topic) => (
                        <li key={topic.code} className="flex items-center justify-between gap-4 px-5 py-3">
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[var(--maher-text-primary)]">
                              {topic.name}
                              {topic.urgency === 'urgent' ? <Stamp tone="error" size="sm">{tc('urgent')}</Stamp> : null}
                            </span>
                            {topic.hint ? <span className="mt-0.5 block text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{topic.hint}</span> : null}
                          </span>
                          <Switch checked={topic.enabled} disabled={!topics.masterEnabled && topics.canPauseAllDevices} onChange={(enabled) => savePrefs.mutate({ topics: { [topic.code]: enabled } })} aria-label={topic.name} />
                        </li>
                      ))}
                    </ul>
                  </Board>
                );
              })}
            </div>
          </div>
        )
      ) : null}

      {tab === 'templates' && showTemplates ? (
        <div className="space-y-4">
          <Alert variant="info">{tc('notificationsProvidersHint')}</Alert>
          <Board tone="neutral">
            <Board.Header title={tc('templates')} description={`${templates.length}`} />
            {templates.length === 0 ? (
              <Board.Empty title={tc('noTemplates')} />
            ) : (
              <ListRows>
                {templates.map((tpl) => (
                  <ListRow
                    key={tpl.id}
                    tone={tpl.channel.toUpperCase() === 'WHATSAPP' ? 'success' : tpl.channel.toUpperCase() === 'SMS' ? 'warning' : tpl.channel.toUpperCase() === 'PUSH' ? 'brand' : 'info'}
                    title={<Ltr className="font-semibold">{tpl.code}</Ltr>}
                    meta={localizedName(locale, { nameAr: tpl.subjectAr ?? '', nameEn: tpl.subjectEn ?? '' }) || '—'}
                    trailing={<Stamp tone="neutral" size="sm"><Ltr>{tpl.channel}</Ltr></Stamp>}
                    onClick={() => {
                      setPreviewLocale('ar');
                      setPreviewTpl(tpl);
                    }}
                  />
                ))}
              </ListRows>
            )}
          </Board>
        </div>
      ) : null}

      <Sheet
        open={!!previewTpl}
        onClose={() => setPreviewTpl(null)}
        title={tc('previewTemplate')}
        description={previewTpl ? <Ltr>{previewTpl.code}</Ltr> : undefined}
        tone="info"
        closeLabel={tCommon('close')}
        footer={
          <Button variant="ghost" onClick={() => setPreviewTpl(null)}>
            {tCommon('close')}
          </Button>
        }
      >
        {previewTpl ? (
          <div className="space-y-4">
            <SegmentedControl<'ar' | 'en'>
              fill
              value={previewLocale}
              onChange={setPreviewLocale}
              options={[
                { value: 'ar', label: 'العربية' },
                { value: 'en', label: 'English' },
              ]}
            />
            <Board tone="neutral" className="shadow-none">
              <Board.Header title={(previewLocale === 'ar' ? previewTpl.subjectAr : previewTpl.subjectEn) ?? '—'} description={tc('subject')} />
              <Board.Body>
                <p className="whitespace-pre-wrap text-[14px] leading-6 text-[var(--maher-text-primary)]" dir={previewLocale === 'ar' ? 'rtl' : 'ltr'}>
                  {previewLocale === 'ar' ? previewTpl.bodyAr : previewTpl.bodyEn}
                </p>
              </Board.Body>
            </Board>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
