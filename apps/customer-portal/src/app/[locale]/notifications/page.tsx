'use client';

import { apiFetch } from '@/lib/api-client';
import {
  Button,
  EmptyState,
  ErrorState,
  MotionSection,
  PageHero,
  Skeleton,
  StatusBadge,
  StaggerGrid,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

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
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();

  const inboxQuery = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => apiFetch<InboxItem[]>('/api/v1/notifications'),
  });

  const readAll = useMutation({
    mutationFn: () => apiFetch('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications-inbox'] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications-inbox'] });
    },
  });

  if (inboxQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (inboxQuery.isError) {
    return <ErrorState title={t('notifications')} onRetry={() => inboxQuery.refetch()} />;
  }

  const inbox = inboxQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        tone="soft"
        title={t('notifications')}
        description={tCommon('notificationsSubtitle')}
        actions={
          inbox.length ? (
            <Button
              variant="secondary"
              loading={readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              {tCommon('markAllRead')}
            </Button>
          ) : null
        }
      />

      {inbox.length === 0 ? (
        <MotionSection>
          <EmptyState title={tCommon('noNotifications')} />
        </MotionSection>
      ) : (
        <StaggerGrid className="space-y-3">
          {inbox.map((item) => {
            const title =
              locale === 'ar' && item.titleAr ? item.titleAr : item.titleEn;
            const body = locale === 'ar' && item.bodyAr ? item.bodyAr : item.bodyEn;
            return (
              <div
                key={item.id}
                className={`maher-list-card rounded-[var(--maher-radius-lg)] border border-border bg-surface p-4 shadow-card ${
                  item.readAt ? 'opacity-80' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">{title}</p>
                      {!item.readAt ? <StatusBadge status="UNREAD" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{body}</p>
                    <p className="mt-2 text-xs text-text-tertiary">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.readAt ? (
                    <Button
                      size="sm"
                      variant="subtle"
                      loading={markRead.isPending}
                      onClick={() => markRead.mutate(item.id)}
                    >
                      {tCommon('markRead')}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
