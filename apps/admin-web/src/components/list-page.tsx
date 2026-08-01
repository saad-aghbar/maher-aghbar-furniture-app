'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSkeleton,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface ListPageProps<T> {
  title: string;
  queryKey: string[];
  fetchPath: string;
  columns: Column<T>[];
  emptyTitle: string;
  emptyDescription?: string;
  rowHref?: (row: T) => string;
  rowLink?: (row: T) => ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
}

export function ListPage<T extends { id: string }>({
  title,
  queryKey,
  fetchPath,
  columns,
  emptyTitle,
  emptyDescription,
  rowLink,
  toolbar,
  actions,
}: ListPageProps<T>) {
  const tCommon = useTranslations('common');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const json = await apiFetch<{ data?: T[] } | T[]>(fetchPath);
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-5">
          <Skeleton className="h-8 w-52" />
        </div>
        {toolbar ? <Skeleton className="h-10 w-full max-w-lg" /> : null}
        <TableSkeleton columns={columns.length} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={title}
        description={tCommon('loadFailed')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={title} actions={actions} />
      {toolbar}
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableHeaderCell key={col.key}>{col.header}</TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((col) => (
                  <TableCell key={col.key}>{rowLink ? rowLink(row) : col.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
