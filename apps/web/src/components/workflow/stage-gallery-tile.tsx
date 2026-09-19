'use client';

import { cn } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { Camera, ChevronLeft, ChevronRight, Clock, Box, Lock, Package, ShieldCheck, Truck, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export type StageGalleryRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  estimatedHours?: number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED' | null;
};

type Props = {
  row: StageGalleryRow;
  locked?: boolean;
  featured?: boolean;
  index?: number;
  caption?: string;
  onClick: () => void;
};

function StageIcon({
  row,
  locked,
}: {
  row: StageGalleryRow;
  locked: boolean;
}) {
  const cls = 'h-5 w-5';
  if (row.code === 'MATERIAL_PREP') return <Package className={cls} aria-hidden />;
  if (row.code === 'INSPECTION') return <ShieldCheck className={cls} aria-hidden />;
  if (row.code === 'PACKAGING') return <Box className={cls} aria-hidden />;
  if (row.code === 'DELIVERY') return <Truck className={cls} aria-hidden />;
  if (row.schedulingResourceMode === 'RESOURCE_CONSTRAINED') return <Box className={cls} aria-hidden />;
  if (locked) return <Lock className={cls} aria-hidden />;
  return <Users className={cls} aria-hidden />;
}

export function StageGalleryTile({
  row,
  locked = false,
  featured = false,
  index = 0,
  caption,
  onClick,
}: Props) {
  const t = useTranslations('production');
  const locale = useLocale();
  const rtl = locale === 'ar' || locale === 'he';
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  const primary = localizedName(locale, row);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        'maher-animate-rise group relative flex w-full flex-col overflow-hidden rounded-[1.35rem] border p-5 text-start transition',
        'hover:-translate-y-0.5 hover:shadow-[var(--maher-shadow-md)]',
        locked
          ? 'border-brand/20 bg-[var(--maher-brand-soft)] hover:border-brand/40'
          : 'border-[var(--maher-border)] bg-[var(--maher-surface)] hover:border-brand/35',
        featured && 'sm:min-h-[9.5rem]',
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-y-0 w-20 opacity-60',
          rtl ? 'end-0' : 'start-0',
          locked ? 'bg-transparent' : 'bg-[var(--maher-brand-soft)]',
        )}
        aria-hidden
      />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-brand">
          <StageIcon row={row} locked={locked} />
        </span>
        <div className="min-w-0 flex-1">
          {caption ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              {caption}
            </p>
          ) : null}
          <p className="text-lg font-semibold leading-snug text-text-primary">{primary}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-text-tertiary transition group-hover:text-brand">
          {locked ? <Lock className="h-3.5 w-3.5 text-brand" aria-hidden /> : <Chevron className="h-4 w-4" aria-hidden />}
        </span>
      </div>
      {row.estimatedHours || row.requiresInspection || row.requiresPhotos ? (
        <div className="relative mt-4 flex flex-wrap items-center gap-2 ps-[4.25rem]">
          {row.estimatedHours ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-2.5 py-1 text-xs font-medium text-brand">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {row.estimatedHours} {t('workflow.durationHours')}
            </span>
          ) : null}
          {row.requiresPhotos ? (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-brand"
              title={t('workflow.requiresPhotos')}
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          {row.requiresInspection ? (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-brand"
              title={t('workflow.requiresInspection')}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
