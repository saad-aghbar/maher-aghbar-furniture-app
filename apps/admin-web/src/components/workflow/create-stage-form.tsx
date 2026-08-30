'use client';

import type { ReactNode } from 'react';
import { DepartmentSearchPicker } from '@/components/admin/department-search-picker';
import { Input, cn } from '@maher/ui';
import { Check, Box, ShieldCheck, Camera, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type CreateStageValues = {
  nameEn: string;
  nameAr: string;
  nameHe: string;
  departmentId: string;
  departmentCode: string;
  hours: string;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  schedulingResourceMode: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';
  resourceSlots: string;
};

export const emptyCreateStageValues = (): CreateStageValues => ({
  nameEn: '',
  nameAr: '',
  nameHe: '',
  departmentId: '',
  departmentCode: '',
  hours: '',
  requiresInspection: false,
  requiresPhotos: false,
  schedulingResourceMode: 'WORKER_CONSTRAINED',
  resourceSlots: '1',
});

type Props = {
  value: CreateStageValues;
  onChange: (next: CreateStageValues) => void;
  showFlags?: boolean;
  readOnly?: boolean;
  /** Opening/finishing stages keep their names; everything else stays editable. */
  lockNames?: boolean;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]">
      <h3 className="border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
        {title}
      </h3>
      <div className="grid gap-3 p-4">{children}</div>
    </section>
  );
}

function FlagRow({
  icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition',
        checked
          ? 'border-brand bg-[var(--maher-brand-soft)]'
          : 'border-[var(--maher-border)] bg-[var(--maher-surface-muted)]/60',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        <span className="mt-0.5 block text-xs text-text-secondary">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[var(--maher-brand)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function ScheduleChoice({
  selected,
  disabled,
  icon,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 text-start transition',
        selected
          ? 'border-brand bg-[var(--maher-brand-soft)] shadow-[var(--maher-shadow-sm)]'
          : 'border-[var(--maher-border)] bg-[var(--maher-surface)] hover:border-brand/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
          selected
            ? 'border-brand bg-brand text-white'
            : 'border-[var(--maher-border)] bg-[var(--maher-surface-muted)] text-brand',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-text-secondary">{hint}</span>
      </span>
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-brand bg-brand text-white' : 'border-[var(--maher-border-strong)]',
        )}
      >
        {selected ? <Check className="h-3 w-3" aria-hidden /> : null}
      </span>
    </button>
  );
}

export function CreateStageForm({
  value,
  onChange,
  showFlags = true,
  readOnly = false,
  lockNames = false,
}: Props) {
  const t = useTranslations('production');
  const namesLocked = readOnly || lockNames;
  const patch = (partial: Partial<CreateStageValues>) => {
    if (readOnly) return;
    if (lockNames) {
      const { nameEn: _en, nameAr: _ar, nameHe: _he, ...rest } = partial;
      if (Object.keys(rest).length === 0) return;
      onChange({ ...value, ...rest });
      return;
    }
    onChange({ ...value, ...partial });
  };
  const slots = Math.max(1, Math.min(20, Number(value.resourceSlots) || 1));

  return (
    <div className="grid gap-4">
      {lockNames ? (
        <p className="rounded-xl border border-[var(--maher-border)] bg-[var(--maher-brand-soft)]/50 px-3 py-2 text-sm text-text-secondary">
          {t('workflow.cannotRenameLockedStage')}
        </p>
      ) : readOnly ? (
        <p className="rounded-xl border border-[var(--maher-border)] bg-[var(--maher-brand-soft)]/50 px-3 py-2 text-sm text-text-secondary">
          {t('workflow.cannotEditLockedStage')}
        </p>
      ) : null}

      <Section title={t('workflow.namesSection')}>
        <p className="text-xs text-text-secondary">{t('workflow.namesHint')}</p>
        <Input
          label={t('workflow.nameEn')}
          value={value.nameEn}
          disabled={namesLocked}
          onChange={(e) => patch({ nameEn: e.target.value })}
        />
        <Input
          label={t('workflow.nameAr')}
          value={value.nameAr}
          disabled={namesLocked}
          onChange={(e) => patch({ nameAr: e.target.value })}
        />
        <Input
          label={`${t('workflow.nameHe')} (${t('workflow.hebrewOptional')})`}
          value={value.nameHe}
          disabled={namesLocked}
          onChange={(e) => patch({ nameHe: e.target.value })}
        />
      </Section>

      {showFlags ? (
        <>
          <Section title={t('workflow.departmentTimeSection')}>
            <DepartmentSearchPicker
              label={t('workflow.department')}
              value={value.departmentId}
              disabled={readOnly}
              onChange={(id, dept) =>
                patch({ departmentId: id, departmentCode: dept?.code ?? '' })
              }
            />
            <Input
              label={t('workflow.typicalHours')}
              type="number"
              min={0}
              step="0.25"
              placeholder="4"
              hint={t('workflow.durationHoursHint')}
              value={value.hours}
              disabled={readOnly}
              onChange={(e) => patch({ hours: e.target.value })}
            />
            <FlagRow
              icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              label={t('workflow.requiresInspection')}
              hint={t('workflow.requiresInspectionHint')}
              checked={value.requiresInspection}
              disabled={readOnly}
              onChange={(next) => patch({ requiresInspection: next })}
            />
            <FlagRow
              icon={<Camera className="h-4 w-4" aria-hidden />}
              label={t('workflow.requiresPhotos')}
              hint={t('workflow.requiresPhotosHint')}
              checked={value.requiresPhotos}
              disabled={readOnly}
              onChange={(next) => patch({ requiresPhotos: next })}
            />
          </Section>

          <Section title={t('workflow.schedulingSection')}>
            <fieldset className="grid gap-3" disabled={readOnly}>
              <legend className="text-sm font-medium text-text-primary">
                {t('workflow.howScheduled')}
              </legend>
              <ScheduleChoice
                selected={value.schedulingResourceMode === 'WORKER_CONSTRAINED'}
                disabled={readOnly}
                icon={<Users className="h-4 w-4" aria-hidden />}
                title={t('workflow.scheduleByWorkers')}
                hint={t('workflow.scheduleByWorkersHint')}
                onSelect={() => patch({ schedulingResourceMode: 'WORKER_CONSTRAINED' })}
              />
              <ScheduleChoice
                selected={value.schedulingResourceMode === 'RESOURCE_CONSTRAINED'}
                disabled={readOnly}
                icon={<Box className="h-4 w-4" aria-hidden />}
                title={t('workflow.scheduleByResource')}
                hint={t('workflow.scheduleByResourceHint')}
                onSelect={() => patch({ schedulingResourceMode: 'RESOURCE_CONSTRAINED' })}
              />
              {value.schedulingResourceMode === 'RESOURCE_CONSTRAINED' ? (
                <div className="rounded-xl border border-brand bg-[var(--maher-brand-soft)] p-3">
                  <p className="text-sm font-medium text-text-primary">{t('workflow.resourceSlots')}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={readOnly || slots <= 1}
                      aria-label={`${t('workflow.resourceSlots')} −`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40"
                      onClick={() => patch({ resourceSlots: String(slots - 1) })}
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-lg font-semibold">{slots}</span>
                    <button
                      type="button"
                      disabled={readOnly || slots >= 20}
                      aria-label={`${t('workflow.resourceSlots')} +`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40"
                      onClick={() => patch({ resourceSlots: String(slots + 1) })}
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">{t('workflow.resourceSlotsHint')}</p>
                </div>
              ) : (
                <p className="text-xs text-text-secondary">{t('workflow.scheduleByWorkersNote')}</p>
              )}
            </fieldset>
          </Section>
        </>
      ) : null}
    </div>
  );
}
