'use client';

import { PageHeader } from '@/components/admin/page-header';
import { ProductProductionSetup } from '@/components/catalog/product-production-setup';
import { ProductWorkflowTimes } from '@/components/workflow/product-workflow-times';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { localizedName } from '@maher/i18n';
import { Button, Card, Input, Select, TextArea, MotionSection, Alert } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type SpecGroup = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  isActive: boolean;
};
type SpecValue = {
  id: string;
  groupId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  isActive: boolean;
};

type VariantDetail = {
  id: string;
  productId: string;
  sku: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isDefault: boolean;
  isActive: boolean;
  basePrice?: number | string | null;
  measurements?: Array<{ key: string; labelAr?: string | null; labelEn?: string | null; value?: number | string | null; unit: string }>;
  composition?: Array<{ labelAr?: string | null; labelEn?: string | null; qty: number }>;
  includedItems?: Array<{ nameAr?: string | null; nameEn?: string | null; qty: number; width?: number | null; height?: number | null; unit?: string | null }>;
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
  workflowId?: string | null;
  options?: Array<{ specOptionValueId: string; specOptionValue?: { groupId: string } }>;
};

export default function ProductVariantEditorPage() {
  const params = useParams<{ id: string; variantId: string }>();
  const productId = params.id;
  const variantId = params.variantId;
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [measurements, setMeasurements] = useState<
    Array<{ key: string; labelAr: string; labelEn: string; value: string; unit: string }>
  >([]);
  const [composition, setComposition] = useState<Array<{ labelAr: string; labelEn: string; qty: string }>>([]);
  const [included, setIncluded] = useState<
    Array<{ nameAr: string; nameEn: string; qty: string; width: string; height: string; unit: string }>
  >([]);
  const [optionByGroup, setOptionByGroup] = useState<Record<string, string>>({});
  const [factoryNotesAr, setFactoryNotesAr] = useState('');
  const [factoryNotesEn, setFactoryNotesEn] = useState('');

  const variantQuery = useQuery({
    queryKey: ['product-variant', productId, variantId],
    queryFn: () => apiFetch<VariantDetail>(`/api/v1/products/${productId}/variants/${variantId}`),
  });
  const groupsQuery = useQuery({
    queryKey: ['spec-option-groups'],
    queryFn: () =>
      apiFetch<{ data: SpecGroup[] }>('/api/v1/spec-option-groups?pageSize=50').then((r) => r.data),
  });
  const valuesQuery = useQuery({
    queryKey: ['spec-option-values'],
    queryFn: () =>
      apiFetch<{ data: SpecValue[] }>('/api/v1/spec-option-values?pageSize=200').then((r) => r.data),
  });

  useEffect(() => {
    const v = variantQuery.data;
    if (!v) return;
    setCode(v.code);
    setNameAr(v.nameAr);
    setNameEn(v.nameEn);
    setBasePrice(v.basePrice != null ? String(v.basePrice) : '');
    setMeasurements(
      (v.measurements ?? []).map((m, i) => ({
        key: m.key || `m-${i}`,
        labelAr: m.labelAr ?? '',
        labelEn: m.labelEn ?? '',
        value: m.value == null ? '' : String(m.value),
        unit: m.unit || 'cm',
      })),
    );
    setComposition(
      (v.composition ?? []).map((r) => ({
        labelAr: r.labelAr ?? '',
        labelEn: r.labelEn ?? '',
        qty: String(r.qty ?? 1),
      })),
    );
    setIncluded(
      (v.includedItems ?? []).map((r) => ({
        nameAr: r.nameAr ?? '',
        nameEn: r.nameEn ?? '',
        qty: String(r.qty ?? 1),
        width: r.width != null ? String(r.width) : '',
        height: r.height != null ? String(r.height) : '',
        unit: r.unit || 'cm',
      })),
    );
    const map: Record<string, string> = {};
    for (const opt of v.options ?? []) {
      if (opt.specOptionValue?.groupId) map[opt.specOptionValue.groupId] = opt.specOptionValueId;
    }
    setOptionByGroup(map);
    setFactoryNotesAr(v.factoryNotesAr ?? '');
    setFactoryNotesEn(v.factoryNotesEn ?? '');
  }, [variantQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${productId}/variants/${variantId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameAr,
          nameEn: nameEn.trim() || undefined,
          basePrice: basePrice ? Number(basePrice) : null,
          measurements: measurements.map((m) => ({
            key: m.key,
            labelAr: m.labelAr,
            labelEn: m.labelEn,
            value: m.value === '' ? null : Number(m.value),
            unit: m.unit,
          })),
          composition: composition.map((r) => ({
            labelAr: r.labelAr,
            labelEn: r.labelEn,
            qty: Number(r.qty) || 1,
          })),
          includedItems: included.map((r) => ({
            nameAr: r.nameAr,
            nameEn: r.nameEn,
            qty: Number(r.qty) || 1,
            width: r.width ? Number(r.width) : null,
            height: r.height ? Number(r.height) : null,
            unit: r.unit,
          })),
          factoryNotesAr: factoryNotesAr || null,
          factoryNotesEn: factoryNotesEn || null,
          options: Object.values(optionByGroup)
            .filter(Boolean)
            .map((specOptionValueId) => ({ specOptionValueId })),
        }),
      }),
    onSuccess: async () => {
      setBanner(t('variantSaved'));
      setError(null);
      await qc.invalidateQueries({ queryKey: ['product-variant', productId, variantId] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? mutationErrorMessage(err) : tCommon('error'));
    },
  });

  const groups = groupsQuery.data ?? [];
  const values = valuesQuery.data ?? [];
  const workflowId = variantQuery.data?.workflowId ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={variantQuery.data ? localizedName(locale, variantQuery.data) : t('editVariant')}
        description={t('variantsHint')}
      />
      <p>
        <Link href={`/${locale}/products/${productId}`} className="text-sm text-brand">
          {t('variants')}
        </Link>
      </p>
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <MotionSection className="maher-form-section" as="div">
        <Card title={t('editVariant')}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={t('sku')} value={variantQuery.data?.sku ?? ''} disabled />
            <Input label={t('variantCode')} value={code} disabled />
            <Input label={t('variantNameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            <Input
              label={t('englishOptional')}
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
            />
            <Input label={t('basePrice')} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
          </div>
        </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
        <Card title={t('measurements')}>
          <p className="mb-3 text-sm text-text-secondary">{t('variantsHint')}</p>
          {measurements.map((row, index) => (
            <div key={row.key} className="mb-2 grid gap-2 md:grid-cols-4">
              <Input
                label={t('variantNameAr')}
                value={row.labelAr}
                onChange={(e) =>
                  setMeasurements((prev) => prev.map((m, i) => (i === index ? { ...m, labelAr: e.target.value } : m)))
                }
              />
              <Input
                label={t('measurementValue')}
                value={row.value}
                onChange={(e) =>
                  setMeasurements((prev) => prev.map((m, i) => (i === index ? { ...m, value: e.target.value } : m)))
                }
              />
              <Input
                label={t('measurementUnit')}
                value={row.unit}
                onChange={(e) =>
                  setMeasurements((prev) => prev.map((m, i) => (i === index ? { ...m, unit: e.target.value } : m)))
                }
              />
              <Button size="sm" variant="secondary" onClick={() => setMeasurements((prev) => prev.filter((_, i) => i !== index))}>
                {tCommon('delete')}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setMeasurements((prev) => [
                ...prev,
                { key: `m-${Date.now()}`, labelAr: '', labelEn: '', value: '', unit: 'cm' },
              ])
            }
          >
            {t('addMeasurementRow')}
          </Button>
        </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
        <Card title={t('composition')}>
          <p className="mb-3 text-sm text-text-secondary">{t('compositionHint')}</p>
          {composition.map((row, index) => (
            <div key={index} className="mb-2 grid gap-2 md:grid-cols-3">
              <Input
                label={t('variantNameAr')}
                value={row.labelAr}
                onChange={(e) =>
                  setComposition((prev) => prev.map((m, i) => (i === index ? { ...m, labelAr: e.target.value } : m)))
                }
              />
              <Input
                label={t('variantQty')}
                value={row.qty}
                onChange={(e) =>
                  setComposition((prev) => prev.map((m, i) => (i === index ? { ...m, qty: e.target.value } : m)))
                }
              />
              <Button size="sm" variant="secondary" onClick={() => setComposition((prev) => prev.filter((_, i) => i !== index))}>
                {tCommon('delete')}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setComposition((prev) => [...prev, { labelAr: '', labelEn: '', qty: '1' }])}
          >
            {t('addCompositionRow')}
          </Button>
        </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
        <Card title={t('variants')}>
          <div className="grid gap-3 md:grid-cols-2">
            {groups.filter((g) => g.isActive).map((group) => (
              <Select
                key={group.id}
                label={localizedName(locale, group)}
                value={optionByGroup[group.id] ?? ''}
                onChange={(e) => setOptionByGroup((prev) => ({ ...prev, [group.id]: e.target.value }))}
                options={[
                  { value: '', label: t('noSpecOption') },
                  ...values
                    .filter((v) => v.groupId === group.id && v.isActive)
                    .map((v) => ({ value: v.id, label: localizedName(locale, v) })),
                ]}
              />
            ))}
          </div>
        </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
        <Card title={t('includedItems')}>
          <p className="mb-3 text-sm text-text-secondary">{t('includedItemsHint')}</p>
          {included.map((row, index) => (
            <div key={index} className="mb-2 grid gap-2 md:grid-cols-5">
              <Input
                label={t('variantNameAr')}
                value={row.nameAr}
                onChange={(e) =>
                  setIncluded((prev) => prev.map((m, i) => (i === index ? { ...m, nameAr: e.target.value } : m)))
                }
              />
              <Input
                label={t('variantQty')}
                value={row.qty}
                onChange={(e) =>
                  setIncluded((prev) => prev.map((m, i) => (i === index ? { ...m, qty: e.target.value } : m)))
                }
              />
              <Input
                label={t('width')}
                value={row.width}
                onChange={(e) =>
                  setIncluded((prev) => prev.map((m, i) => (i === index ? { ...m, width: e.target.value } : m)))
                }
              />
              <Input
                label={t('measurementUnit')}
                value={row.unit}
                onChange={(e) =>
                  setIncluded((prev) => prev.map((m, i) => (i === index ? { ...m, unit: e.target.value } : m)))
                }
              />
              <Button size="sm" variant="secondary" onClick={() => setIncluded((prev) => prev.filter((_, i) => i !== index))}>
                {tCommon('delete')}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setIncluded((prev) => [...prev, { nameAr: '', nameEn: '', qty: '1', width: '', height: '', unit: 'cm' }])
            }
          >
            {t('addIncludedItem')}
          </Button>
        </Card>
      </MotionSection>

      <MotionSection className="maher-form-section" as="div">
        <Card title={t('factoryNotes')}>
          <p className="mb-2 text-sm text-text-secondary">{t('factoryNotesHint')}</p>
          <TextArea label={t('factoryNotesAr')} value={factoryNotesAr} onChange={(e) => setFactoryNotesAr(e.target.value)} rows={4} />
          <TextArea label={t('factoryNotesEn')} value={factoryNotesEn} onChange={(e) => setFactoryNotesEn(e.target.value)} rows={3} />
        </Card>
      </MotionSection>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {tCommon('save')}
      </Button>

      {workflowId ? (
        <MotionSection className="maher-form-section" as="div">
          <ProductWorkflowTimes productId={productId} workflowId={workflowId} variantId={variantId} />
        </MotionSection>
      ) : null}

      <MotionSection className="maher-form-section" as="div">
        <ProductProductionSetup productId={productId} variantId={variantId} />
      </MotionSection>
    </div>
  );
}
