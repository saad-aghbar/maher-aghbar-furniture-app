'use client';

import { DepartmentSearchPicker } from '@/components/admin/department-search-picker';
import { Input } from '@maher/ui';
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
});

type Props = {
  value: CreateStageValues;
  onChange: (next: CreateStageValues) => void;
  showFlags?: boolean;
};

export function CreateStageForm({ value, onChange, showFlags = true }: Props) {
  const t = useTranslations('production');
  const patch = (partial: Partial<CreateStageValues>) => onChange({ ...value, ...partial });

  return (
    <div className="grid gap-3">
      <p className="text-xs text-text-tertiary">{t('workflow.namesHint')}</p>
      <Input
        label={t('workflow.nameEn')}
        value={value.nameEn}
        onChange={(e) => patch({ nameEn: e.target.value })}
      />
      <Input
        label={t('workflow.nameAr')}
        value={value.nameAr}
        onChange={(e) => patch({ nameAr: e.target.value })}
      />
      <Input
        label={`${t('workflow.nameHe')} (${t('workflow.hebrewOptional')})`}
        value={value.nameHe}
        onChange={(e) => patch({ nameHe: e.target.value })}
      />
      {showFlags ? (
        <>
          <DepartmentSearchPicker
            label={t('workflow.department')}
            value={value.departmentId}
            onChange={(id, dept) =>
              patch({ departmentId: id, departmentCode: dept?.code ?? '' })
            }
          />
          <Input
            label={t('workflow.durationHours')}
            type="number"
            min={0}
            step="0.25"
            value={value.hours}
            onChange={(e) => patch({ hours: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.requiresInspection}
              onChange={(e) => patch({ requiresInspection: e.target.checked })}
            />
            {t('workflow.requiresInspection')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.requiresPhotos}
              onChange={(e) => patch({ requiresPhotos: e.target.checked })}
            />
            {t('workflow.requiresPhotos')}
          </label>
        </>
      ) : null}
    </div>
  );
}
