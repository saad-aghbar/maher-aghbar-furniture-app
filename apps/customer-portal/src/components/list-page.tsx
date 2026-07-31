'use client';

import { EmptyState, ErrorState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
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
}

export function ListPage<T extends { id: string }>({
  title,
  queryKey,
  fetchPath,
  columns,
  emptyTitle,
  emptyDescription,
  rowLink,
}: ListPageProps<T>) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${fetchPath}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = (await res.json()) as { data?: T[] } | T[];
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={title} description="Failed to load data" onRetry={() => refetch()} />;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
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
                  <TableCell key={col.key}>
                    {rowLink ? rowLink(row) : col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
