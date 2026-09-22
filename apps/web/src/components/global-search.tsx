'use client';

import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Input, ListRow, ListRows, Ltr, Modal, SectionTabs, Stamp, cn, type BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Boxes, FileText, Receipt, Search, ShoppingBag, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type SearchHitType = 'product' | 'sales_order' | 'request' | 'invoice' | 'customer' | 'inventory';

type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

const TYPE_ORDER: SearchHitType[] = ['sales_order', 'request', 'invoice', 'customer', 'product', 'inventory'];

const TYPE_TONE: Record<SearchHitType, BoardTone> = {
  product: 'brand',
  sales_order: 'info',
  request: 'warning',
  invoice: 'success',
  customer: 'neutral',
  inventory: 'neutral',
};

const TYPE_ICON: Record<SearchHitType, ReactNode> = {
  product: <Armchair className="h-4 w-4" />,
  sales_order: <ShoppingBag className="h-4 w-4" />,
  request: <FileText className="h-4 w-4" />,
  invoice: <Receipt className="h-4 w-4" />,
  customer: <Store className="h-4 w-4" />,
  inventory: <Boxes className="h-4 w-4" />,
};

function adminHref(hit: SearchHit): string {
  switch (hit.type) {
    case 'product':
      return `/admin/products/${hit.id}`;
    case 'sales_order':
      return `/admin/sales-orders/${hit.id}`;
    case 'request':
      return `/admin/requests/${hit.id}`;
    case 'invoice':
      return `/admin/invoices/${hit.id}`;
    case 'customer':
      return `/admin/customers/${hit.id}`;
    case 'inventory':
      return '/admin/inventory';
    default:
      return hit.href.startsWith('/') ? hit.href : `/${hit.href}`;
  }
}

/**
 * SearchDesk — the search box, a kind filter and results as ListRows grouped by kind.
 * Used inline on /admin/search and inside the topbar modal.
 */
export function SearchDesk({ onNavigate, autoFocus, embedded }: { onNavigate: (href: string) => void; autoFocus?: boolean; embedded?: boolean }) {
  const t = useTranslations('mobile');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState<SearchHitType | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q.trim()), 220);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  const query = useQuery({
    queryKey: ['global-search', debounced],
    enabled: debounced.length >= 1,
    queryFn: () => apiFetch<{ data: SearchHit[] }>(`/api/v1/search?q=${encodeURIComponent(debounced)}&pageSize=30`),
  });

  const hits = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const typeLabel = useMemo(() => (type: SearchHitType) => t(`search.types.${type}`), [t]);
  const counts = useMemo(() => {
    const c = new Map<SearchHitType, number>();
    for (const hit of hits) c.set(hit.type, (c.get(hit.type) ?? 0) + 1);
    return c;
  }, [hits]);
  const groups = useMemo(
    () =>
      TYPE_ORDER.filter((type) => (kind === 'all' || kind === type) && counts.get(type)).map((type) => ({
        type,
        items: hits.filter((h) => h.type === type),
      })),
    [hits, kind, counts],
  );

  const body =
    debounced.length < 1 ? (
      <Board.Empty title={t('search.hintTitle')} description={t('search.hintBody')} />
    ) : query.isLoading ? (
      <div className="px-5 py-4"><BoardSkeleton rows={4} className="border-0 shadow-none" /></div>
    ) : query.isError ? (
      <Board.Empty title={t('search.errorTitle')} description={t('search.errorBody')} />
    ) : hits.length === 0 ? (
      <Board.Empty title={t('search.emptyTitle')} description={t('search.emptyBody')} />
    ) : (
      groups.map((group) => (
        <section key={group.type} aria-label={typeLabel(group.type)}>
          <h3 className="flex items-center gap-2 px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">
            {typeLabel(group.type)}
            <Stamp tone={TYPE_TONE[group.type]} size="sm">{group.items.length}</Stamp>
          </h3>
          <ListRows>
            {group.items.map((hit) => {
              const href = adminHref(hit);
              return (
                <ListRow
                  key={`${hit.type}-${hit.id}`}
                  leading={<span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-tertiary)]">{TYPE_ICON[hit.type]}</span>}
                  title={hit.title}
                  meta={hit.subtitle ? <Ltr>{hit.subtitle}</Ltr> : undefined}
                  onClick={() => onNavigate(href)}
                />
              );
            })}
          </ListRows>
        </section>
      ))
    );

  return (
    <div className="space-y-4">
      <Input ref={inputRef} withSearchIcon value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.title')} autoComplete="off" />
      {hits.length ? (
        <SectionTabs
          aria-label={t('search.title')}
          value={kind}
          onChange={(id) => setKind(id as SearchHitType | 'all')}
          items={[{ id: 'all', label: t('search.title'), count: hits.length }, ...TYPE_ORDER.filter((type) => counts.get(type)).map((type) => ({ id: type, label: typeLabel(type), count: counts.get(type) }))]}
        />
      ) : null}
      {embedded ? <div className="min-h-[12rem]">{body}</div> : <Board tone="neutral">{body}</Board>}
    </div>
  );
}

export function GlobalSearch({ inverted }: { inverted?: boolean }) {
  const t = useTranslations('mobile');
  const router = useRouter();
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('search.title')}
        className={cn(
          'maher-press maher-search-trigger relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-card backdrop-blur-md',
          'hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          inverted ? 'border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15' : 'border-border bg-surface/80 text-text-secondary hover:border-brand/40 hover:text-brand',
        )}
      >
        <Search className="maher-search-trigger__icon h-4 w-4 text-brand" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('search.title')} description={t('search.hintBody')} size="lg" className="max-w-xl overflow-hidden">
        {open ? (
          <SearchDesk
            autoFocus
            embedded
            onNavigate={(href) => {
              setOpen(false);
              router.push(href);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}
