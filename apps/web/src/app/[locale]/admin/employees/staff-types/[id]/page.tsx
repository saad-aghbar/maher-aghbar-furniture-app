'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useRouter } from '@/i18n/navigation';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  DetailHero,
  ErrorBoard,
  Figure,
  FormFooter,
  FormSection,
  Input,
  Meter,
  Select,
  Stamp,
  StatusChips,
  Switch,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { expandPermissionDependencies } from '@maher/permissions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { StaffTypeRow } from '../page';

type CatalogGroup = {
  group: string;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  permissions: Array<{
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe: string;
    descriptionEn: string;
    descriptionAr: string;
    descriptionHe: string;
    riskLevel: string;
    assignableToStaff: boolean;
  }>;
};

type FormState = {
  nameEn: string;
  nameAr: string;
  nameHe: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionHe: string;
  iconKey: string;
  isActive: boolean;
  permissionCodes: string[];
};

const ICON_OPTIONS = [
  'cube-outline',
  'cart-outline',
  'clipboard-outline',
  'construct-outline',
  'people-outline',
  'car-outline',
  'cash-outline',
  'document-text-outline',
];

const emptyForm = (): FormState => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  descriptionEn: '',
  descriptionAr: '',
  descriptionHe: '',
  iconKey: 'people-outline',
  isActive: true,
  permissionCodes: [],
});

function formFromRow(row: StaffTypeRow): FormState {
  return {
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameHe: row.nameHe ?? '',
    descriptionEn: row.descriptionEn ?? '',
    descriptionAr: row.descriptionAr ?? '',
    descriptionHe: row.descriptionHe ?? '',
    iconKey: row.iconKey ?? 'people-outline',
    isActive: row.isActive,
    permissionCodes: (row.permissions ?? []).map((p) => p.permission.code),
  };
}

function catalogLabel(
  row: { nameEn: string; nameAr: string; nameHe: string },
  locale: string,
): string {
  if (locale === 'ar') return row.nameAr;
  if (locale === 'he') return row.nameHe;
  return row.nameEn;
}

export default function StaffTypeEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const locale = useLocale();
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const tVal = useTranslations('validation');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [hydrated, setHydrated] = useState(isNew);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const detailQuery = useQuery({
    queryKey: ['staff-type', id],
    queryFn: () => apiFetch<StaffTypeRow>(`/api/v1/staff-types/${id}`),
    enabled: !isNew,
  });

  const catalogQuery = useQuery({
    queryKey: ['permission-catalog-staff'],
    queryFn: () => apiFetch<CatalogGroup[]>('/api/v1/roles/permission-catalog?staff=true'),
  });

  useEffect(() => {
    if (detailQuery.data && !hydrated) {
      setForm(formFromRow(detailQuery.data));
      setHydrated(true);
    }
  }, [detailQuery.data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.nameEn.trim() || !form.nameAr.trim()) {
        throw new ApiClientError(tVal('nameRequired'), 400);
      }
      const permissionCodes = expandPermissionDependencies(form.permissionCodes);
      const body = {
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        nameHe: form.nameHe.trim() || undefined,
        descriptionEn: form.descriptionEn.trim() || undefined,
        descriptionAr: form.descriptionAr.trim() || undefined,
        descriptionHe: form.descriptionHe.trim() || undefined,
        iconKey: form.iconKey || null,
        isActive: form.isActive,
        permissionCodes,
      };
      if (isNew) {
        return apiFetch<StaffTypeRow>('/api/v1/staff-types', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      return apiFetch<StaffTypeRow>(`/api/v1/staff-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (row) => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-types'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-type', row.id] }),
        queryClient.invalidateQueries({ queryKey: ['auth-me'] }),
        queryClient.invalidateQueries({ queryKey: ['roles'] }),
      ]);
      router.push('/admin/employees/staff-types');
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const needle = search.trim().toLowerCase();
  const catalogGroups = catalogQuery.data;
  const visibleGroups = useMemo(() => {
    const groups = catalogGroups ?? [];
    return groups
      .filter((g) => !groupFilter || g.group === groupFilter)
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter((p) => {
          if (!needle) return true;
          const hay = `${p.code} ${p.nameEn} ${p.nameAr} ${p.nameHe} ${p.descriptionEn} ${p.descriptionAr} ${p.descriptionHe}`.toLowerCase();
          return hay.includes(needle);
        }),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [catalogGroups, groupFilter, needle]);

  const assignedCount = detailQuery.data?._count?.users ?? 0;
  const readOnly = Boolean(!isNew && detailQuery.data?.isSystem);

  if (!isNew && detailQuery.isLoading && !detailQuery.data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <BoardSkeleton rows={6} />
          <BoardSkeleton rows={8} />
        </div>
      </div>
    );
  }

  if (!isNew && detailQuery.isError && !detailQuery.data) {
    return (
      <ErrorBoard
        title={t('editStaffType')}
        description={tCommon('loadFailed')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  function toggleCode(code: string, assignable: boolean) {
    if (readOnly || !assignable) return;
    setForm((f) => {
      const has = f.permissionCodes.includes(code);
      const next = has ? f.permissionCodes.filter((c) => c !== code) : [...f.permissionCodes, code];
      return { ...f, permissionCodes: expandPermissionDependencies(next) };
    });
  }

  const totalAssignable = (catalogGroups ?? []).reduce((acc, g) => acc + g.permissions.filter((p) => p.assignableToStaff).length, 0);
  const sensitiveCount = (catalogGroups ?? []).reduce((acc, g) => acc + g.permissions.filter((p) => p.riskLevel === 'sensitive' && form.permissionCodes.includes(p.code)).length, 0);
  const heroTone = readOnly ? 'brand' : form.isActive ? 'info' : 'neutral';

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        tone={heroTone}
        back={{ label: t('staffTypesTitle'), onClick: () => router.push('/admin/employees/staff-types') }}
        title={isNew ? t('newStaffType') : detailQuery.data ? localizedName(locale, detailQuery.data) : t('editStaffType')}
        subtitle={isNew ? t('staffTypesDescription') : detailQuery.data?.isSystem ? t('systemPreset') : t('custom')}
        status={isNew ? undefined : { label: form.isActive ? t('active') : t('inactive'), tone: form.isActive ? 'success' : 'neutral' }}
        code={detailQuery.data?.code}
        facts={[
          { label: t('permissions'), value: `${form.permissionCodes.length}` },
          ...(isNew ? [] : [{ label: t('usersAssigned'), value: `${assignedCount}` }]),
          ...(sensitiveCount ? [{ label: t('sensitivePermission'), value: `${sensitiveCount}`, tone: 'warning' as const }] : []),
        ]}
        primary={!readOnly ? (
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {tCommon('save')}
          </Button>
        ) : undefined}
        actions={
          <Button variant="ghost" onClick={() => router.push('/admin/employees/staff-types')}>
            {readOnly ? tCommon('back') : tCommon('cancel')}
          </Button>
        }
      >
        <Meter value={form.permissionCodes.length} max={Math.max(1, totalAssignable)} tone={heroTone} label={t('permissions')} valueLabel={`${form.permissionCodes.length} / ${totalAssignable}`} />
      </DetailHero>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {readOnly ? <Alert variant="info">{t('systemPresetReadOnly')}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <FormSection title={readOnly ? t('view') : t('editStaffType')} columns={1} meta={<Switch checked={form.isActive} disabled={readOnly} onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} label={t('active')} />}>
            <Input
              label={`${t('nameEn')} *`}
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              required
              disabled={readOnly}
            />
            <Input
              label={`${t('nameAr')} *`}
              value={form.nameAr}
              onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
              required
              disabled={readOnly}
            />
            <Input
              label={`${t('nameHe')} (${t('optional')})`}
              value={form.nameHe}
              onChange={(e) => setForm((f) => ({ ...f, nameHe: e.target.value }))}
              disabled={readOnly}
            />
            <Select
              label={t('icon')}
              value={form.iconKey}
              onChange={(e) => setForm((f) => ({ ...f, iconKey: e.target.value }))}
              disabled={readOnly}
            >
              {ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon.replace('-outline', '')}
                </option>
              ))}
            </Select>
          </FormSection>
          <FormSection title={t('descriptionEn')} description={t('optional')} columns={1} tone="neutral">
            <TextArea autoGrow
              label={t('descriptionEn')}
              value={form.descriptionEn}
              onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
              rows={2}
              disabled={readOnly}
            />
            <TextArea autoGrow
              label={t('descriptionAr')}
              value={form.descriptionAr}
              onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
              rows={2}
              disabled={readOnly}
            />
            <TextArea autoGrow
              label={t('descriptionHe')}
              value={form.descriptionHe}
              onChange={(e) => setForm((f) => ({ ...f, descriptionHe: e.target.value }))}
              rows={2}
              disabled={readOnly}
            />
          </FormSection>
        </div>

        <Board tone={heroTone} className="min-w-0">
          <Board.Header
            title={t('permissions')}
            description={t('permissionCount', { n: form.permissionCodes.length })}
            meta={
              <div className="hidden gap-4 sm:flex">
                <Figure size="sm" value={form.permissionCodes.length} label={t('permissions')} tone={heroTone} />
                <Figure size="sm" value={sensitiveCount} label={t('sensitivePermission')} tone={sensitiveCount ? 'warning' : 'neutral'} />
              </div>
            }
          />
          <Board.Body className="space-y-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPermissions')}
              withSearchIcon
            />
            <StatusChips
              aria-label={t('permissionGroupFilter')}
              value={groupFilter || 'all'}
              onChange={(id) => setGroupFilter(id === 'all' ? '' : id)}
              items={[
                { id: 'all', label: tCommon('all'), count: form.permissionCodes.length },
                ...(catalogGroups ?? []).map((g) => ({
                  id: g.group,
                  label: catalogLabel(g, locale),
                  count: g.permissions.filter((p) => form.permissionCodes.includes(p.code)).length,
                })),
              ]}
            />
            <div className="grid max-h-[68vh] gap-5 overflow-y-auto pe-1">
              {visibleGroups.length === 0 ? (
                <Board.Empty title={tCommon('noResults')} />
              ) : null}
              {visibleGroups.map((group) => {
                const groupOn = group.permissions.filter((p) => form.permissionCodes.includes(p.code)).length;
                const groupAssignable = group.permissions.filter((p) => p.assignableToStaff);
                const allOn = groupAssignable.length > 0 && groupAssignable.every((p) => form.permissionCodes.includes(p.code));
                return (
                  <section key={group.group} className="grid gap-1" aria-label={catalogLabel(group, locale)}>
                    <header className="flex items-center justify-between gap-3 px-1 py-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--maher-text-primary)]">{catalogLabel(group, locale)}</span>
                        <Stamp tone={groupOn ? heroTone : 'neutral'} size="sm">{`${groupOn}/${group.permissions.length}`}</Stamp>
                      </span>
                      {!readOnly && groupAssignable.length > 1 ? (
                        <Switch
                          checked={allOn}
                          aria-label={catalogLabel(group, locale)}
                          onChange={(checked) =>
                            setForm((f) => {
                              const codes = groupAssignable.map((p) => p.code);
                              const next = checked ? Array.from(new Set([...f.permissionCodes, ...codes])) : f.permissionCodes.filter((c) => !codes.includes(c));
                              return { ...f, permissionCodes: expandPermissionDependencies(next) };
                            })
                          }
                        />
                      ) : null}
                    </header>
                    <ul className="overflow-hidden rounded-[14px] border border-[var(--maher-border)] divide-y divide-[var(--maher-border)]">
                      {group.permissions.map((perm) => {
                        const checked = form.permissionCodes.includes(perm.code);
                        const disabled = readOnly || !perm.assignableToStaff;
                        const description = locale === 'ar' ? perm.descriptionAr : locale === 'he' ? perm.descriptionHe : perm.descriptionEn;
                        return (
                          <li key={perm.code} className={['flex items-center justify-between gap-3 px-3 py-2.5 transition-colors', checked ? 'bg-[var(--maher-surface-muted)]' : '', disabled ? 'opacity-60' : ''].join(' ')}>
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[13px] font-medium text-[var(--maher-text-primary)]">{catalogLabel(perm, locale)}</span>
                                {perm.riskLevel === 'sensitive' ? <Stamp tone="warning" size="sm">{t('sensitivePermission')}</Stamp> : null}
                                {!perm.assignableToStaff ? <Stamp tone="neutral" size="sm">{t('restrictedPermission')}</Stamp> : null}
                              </span>
                              {description ? <span className="mt-0.5 block text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{description}</span> : null}
                            </span>
                            <Switch checked={checked} disabled={disabled} aria-label={catalogLabel(perm, locale)} onChange={() => toggleCode(perm.code, perm.assignableToStaff)} />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </Board.Body>
        </Board>
      </div>

      {!readOnly ? (
        <FormFooter
          primary={<Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{tCommon('save')}</Button>}
          secondary={<Button variant="ghost" onClick={() => router.push('/admin/employees/staff-types')}>{tCommon('cancel')}</Button>}
          error={error}
        />
      ) : null}
    </div>
  );
}
