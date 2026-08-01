'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@maher/ui';
import { localizedBody, localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

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

export default function NotificationsPage() {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);
  const [previewLocale, setPreviewLocale] = useState<'ar' | 'en'>('ar');

  const templatesQuery = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => apiFetch<Template[]>('/api/v1/notifications/templates'),
  });
  const inboxQuery = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => apiFetch<InboxItem[]>('/api/v1/notifications'),
  });

  const readAll = useMutation({
    mutationFn: () => apiFetch('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] });
    },
  });

  if (templatesQuery.isLoading || inboxQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (templatesQuery.isError || inboxQuery.isError) {
    return (
      <ErrorState
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
  const inbox = inboxQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('notifications')}
        actions={
          inbox.length ? (
            <Button variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate()}>
              {tCommon('markAllRead')}
            </Button>
          ) : null
        }
      />
      <Alert variant="info">{tc('notificationsProvidersHint')}</Alert>

      <Tabs defaultValue="inbox">
        <TabList>
          <Tab value="inbox">{tc('inbox')}</Tab>
          <Tab value="templates">{tc('templates')}</Tab>
        </TabList>
        <TabPanel value="inbox">
          {inbox.length === 0 ? (
            <EmptyState title={tCommon('noNotifications')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tc('type')}</TableHeaderCell>
                  <TableHeaderCell>{tc('title')}</TableHeaderCell>
                  <TableHeaderCell>{tc('body')}</TableHeaderCell>
                  <TableHeaderCell>{tc('read')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inbox.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <span dir="ltr">{n.type}</span>
                    </TableCell>
                    <TableCell>
                      {localizedName(locale, {
                        titleAr: n.titleAr,
                        titleEn: n.titleEn,
                      })}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {localizedBody(locale, {
                        bodyAr: n.bodyAr,
                        bodyEn: n.bodyEn,
                      })}
                    </TableCell>
                    <TableCell>{n.readAt ? tCommon('yes') : tCommon('no')}</TableCell>
                    <TableCell>
                      <span dir="ltr">{new Date(n.createdAt).toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      {!n.readAt ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={markRead.isPending}
                          onClick={() => markRead.mutate(n.id)}
                        >
                          {tCommon('markRead')}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
        <TabPanel value="templates">
          {templates.length === 0 ? (
            <EmptyState title={tc('noTemplates')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tc('code')}</TableHeaderCell>
                  <TableHeaderCell>{tc('channel')}</TableHeaderCell>
                  <TableHeaderCell>{tc('subjectAr')}</TableHeaderCell>
                  <TableHeaderCell>{tc('subjectEn')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <span dir="ltr">{tpl.code}</span>
                    </TableCell>
                    <TableCell>
                      <span dir="ltr">{tpl.channel}</span>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">{tpl.subjectAr ?? '—'}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{tpl.subjectEn ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPreviewLocale('ar');
                          setPreviewTpl(tpl);
                        }}
                      >
                        {tc('previewTemplate')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </Tabs>

      <Modal
        open={!!previewTpl}
        onClose={() => setPreviewTpl(null)}
        title={previewTpl ? `${tc('previewTemplate')} — ${previewTpl.code}` : tc('previewTemplate')}
        className="max-w-lg"
        footer={
          <Button variant="ghost" onClick={() => setPreviewTpl(null)}>
            {tCommon('close')}
          </Button>
        }
      >
        {previewTpl ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={previewLocale === 'ar' ? 'primary' : 'secondary'}
                onClick={() => setPreviewLocale('ar')}
              >
                العربية
              </Button>
              <Button
                size="sm"
                variant={previewLocale === 'en' ? 'primary' : 'secondary'}
                onClick={() => setPreviewLocale('en')}
              >
                English
              </Button>
            </div>
            <div className="space-y-2 rounded border border-[var(--maher-border)] p-3">
              <p className="text-xs text-[var(--maher-text-secondary)]">{tc('subject')}</p>
              <p className="font-medium" dir={previewLocale === 'ar' ? 'rtl' : 'ltr'}>
                {(previewLocale === 'ar' ? previewTpl.subjectAr : previewTpl.subjectEn) ?? '—'}
              </p>
              <p className="text-xs text-[var(--maher-text-secondary)]">{tc('body')}</p>
              <p className="whitespace-pre-wrap text-sm" dir={previewLocale === 'ar' ? 'rtl' : 'ltr'}>
                {previewLocale === 'ar' ? previewTpl.bodyAr : previewTpl.bodyEn}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
