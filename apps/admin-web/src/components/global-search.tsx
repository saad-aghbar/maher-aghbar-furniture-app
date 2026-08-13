'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Badge, cn, EmptyState, Input, Modal, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

type SearchHitType = 'product' | 'sales_order' | 'request' | 'invoice' | 'customer' | 'inventory';

type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

const TYPE_BADGE: Record<SearchHitType, 'brand' | 'info' | 'warning' | 'success' | 'default'> = {
  product: 'brand',
  sales_order: 'info',
  request: 'warning',
  invoice: 'success',
  customer: 'default',
  inventory: 'default',
};

function adminHref(hit: SearchHit): string {
  switch (hit.type) {
    case 'product':
      return `/products/${hit.id}`;
    case 'sales_order':
      return `/sales-orders/${hit.id}`;
    case 'request':
      return `/requests/${hit.id}`;
    case 'invoice':
      return `/invoices/${hit.id}`;
    case 'customer':
      return `/customers/${hit.id}`;
    case 'inventory':
      return '/inventory';
    default:
      return hit.href.startsWith('/') ? hit.href : `/${hit.href}`;
  }
}

export function GlobalSearch({ inverted }: { inverted?: boolean }) {
  const t = useTranslations('mobile');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q.trim()), 220);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const query = useQuery({
    queryKey: ['global-search', debounced],
    enabled: open && debounced.length >= 1,
    queryFn: () =>
      apiFetch<{ data: SearchHit[] }>(
        `/api/v1/search?q=${encodeURIComponent(debounced)}&pageSize=20`,
      ),
  });

  const hits = query.data?.data ?? [];
  const typeLabel = useMemo(
    () => (type: SearchHitType) => t(`search.types.${type}`),
    [t],
  );

  function close() {
    setOpen(false);
    setQ('');
    setDebounced('');
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('search.title')}
        className={cn(
          'maher-press maher-search-trigger relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-card backdrop-blur-md',
          'hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          inverted
            ? 'border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15'
            : 'border-border bg-surface/80 text-text-secondary hover:border-brand/40 hover:text-brand',
        )}
      >
        <Search className="maher-search-trigger__icon h-4 w-4 text-brand" />
      </button>

      <Modal
        open={open}
        onClose={close}
        title={t('search.title')}
        description={t('search.hintBody')}
        size="lg"
        className="max-w-xl overflow-hidden"
      >
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-x-5 -top-4 h-24 bg-gradient-to-b from-[var(--maher-brand-soft)]/70 to-transparent"
            aria-hidden
          />
          <Input
            ref={inputRef}
            withSearchIcon
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.title')}
            autoComplete="off"
          />
        </div>

        <div className="mt-4 min-h-[12rem]">
          {debounced.length < 1 ? (
            <EmptyState title={t('search.hintTitle')} description={t('search.hintBody')} className="py-10" />
          ) : query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : query.isError ? (
            <EmptyState title={t('search.errorTitle')} description={t('search.errorBody')} className="py-10" />
          ) : hits.length === 0 ? (
            <EmptyState title={t('search.emptyTitle')} description={t('search.emptyBody')} className="py-10" />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {hits.map((hit) => {
                const href = adminHref(hit);
                return (
                  <li key={`${hit.type}-${hit.id}`}>
                    <Link
                      href={href}
                      onClick={() => go(href)}
                      className="maher-press flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--maher-brand-soft)]/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text-primary">
                          {hit.title}
                        </span>
                        {hit.subtitle ? (
                          <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                            {hit.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <Badge variant={TYPE_BADGE[hit.type]} className="shrink-0">
                        {typeLabel(hit.type)}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
