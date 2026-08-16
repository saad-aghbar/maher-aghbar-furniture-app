'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { useRouter } from '@/i18n/navigation';
import {
  Alert,
  Button,
  ErrorState,
  Input,
  PageHero,
  Select,
  Skeleton,
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
      router.push('/employees/staff-types');
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isNew && detailQuery.isError && !detailQuery.data) {
    return (
      <ErrorState
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

  return (
    <div className="space-y-6">
      <PageHero
        title={isNew ? t('newStaffType') : readOnly ? t('view') : t('editStaffType')}
        description={
          isNew
            ? t('staffTypesDescription')
            : detailQuery.data
              ? localizedName(locale, detailQuery.data)
              : undefined
        }
        tone="soft"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => router.push('/employees/staff-types')}>
              {readOnly ? tCommon('back') : tCommon('cancel')}
            </Button>
            {!readOnly ? (
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {tCommon('save')}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {readOnly ? <Alert variant="info">{t('systemPresetReadOnly')}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-[var(--maher-radius-md)] border border-border bg-surface p-4">
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
          <TextArea
            label={`${t('descriptionEn')} (${t('optional')})`}
            value={form.descriptionEn}
            onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
            rows={3}
            disabled={readOnly}
          />
          <TextArea
            label={`${t('descriptionAr')} (${t('optional')})`}
            value={form.descriptionAr}
            onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
            rows={3}
            disabled={readOnly}
          />
          <TextArea
            label={`${t('descriptionHe')} (${t('optional')})`}
            value={form.descriptionHe}
            onChange={(e) => setForm((f) => ({ ...f, descriptionHe: e.target.value }))}
            rows={3}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={readOnly}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            {t('active')}
          </label>
          {detailQuery.data ? (
            <p className="text-sm text-text-secondary">
              {detailQuery.data.isSystem ? t('systemPreset') : t('custom')}
              {' · '}
              {t('usersAssignedCount', { n: assignedCount })}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-[var(--maher-radius-md)] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[min(100%,16rem)] flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPermissions')}
                withSearchIcon
              />
            </div>
            <Select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              aria-label={t('permissionGroupFilter')}
              className="w-48 shrink-0"
            >
              <option value="">{t('permissionGroupFilter')}</option>
              {(catalogGroups ?? []).map((g) => (
                <option key={g.group} value={g.group}>
                  {catalogLabel(g, locale)}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-sm text-text-secondary">
            {t('permissionCount', { n: form.permissionCodes.length })}
          </p>
          <div className="grid max-h-[70vh] gap-5 overflow-y-auto pe-1">
            {visibleGroups.map((group) => (
              <fieldset key={group.group} className="grid gap-2">
                <legend className="text-sm font-semibold text-brand">{catalogLabel(group, locale)}</legend>
                {group.permissions.map((perm) => {
                  const checked = form.permissionCodes.includes(perm.code);
                  const disabled = readOnly || !perm.assignableToStaff;
                  return (
                    <label
                      key={perm.code}
                      className={[
                        'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                        checked ? 'border-brand bg-[var(--maher-brand-soft)]' : 'border-border hover:border-brand/40',
                        disabled ? 'cursor-not-allowed opacity-60' : '',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleCode(perm.code, perm.assignableToStaff)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-text-primary">
                          {catalogLabel(perm, locale)}
                        </span>
                        <span className="block text-xs text-text-tertiary">
                          {locale === 'ar'
                            ? perm.descriptionAr
                            : locale === 'he'
                              ? perm.descriptionHe
                              : perm.descriptionEn}
                        </span>
                        {perm.riskLevel === 'sensitive' ? (
                          <span className="mt-1 inline-block text-[11px] text-amber-800">
                            {t('sensitivePermission')}
                          </span>
                        ) : null}
                        {disabled ? (
                          <span className="mt-1 inline-block text-[11px] text-text-tertiary">
                            {t('restrictedPermission')}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
