'use client';

import { DeliveryLocationMapLazy } from '@/components/delivery-location-map-lazy';
import { Card, Ltr } from '@maher/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export interface DealerOrderItemFields {
  id?: string;
  productName?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  notes?: string | null;
  customMeasurements?: Array<{ label: string; value: string }> | null;
}

export interface DealerOrderDetailsProps {
  externalOrderNumber?: string | null;
  notes?: string | null;
  endCustomerName?: string | null;
  endCustomerPhone?: string | null;
  endCustomerFax?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  items?: DealerOrderItemFields[];
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 font-medium text-text-primary">{children}</dd>
    </div>
  );
}

function display(value: string | number | null | undefined) {
  if (value == null) return '—';
  const text = String(value).trim();
  if (!text) return '—';
  // Never show internal UUIDs that were wrongly saved as names
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return '—';
  }
  return text;
}

export function DealerOrderDetails({
  externalOrderNumber,
  notes,
  endCustomerName,
  endCustomerPhone,
  endCustomerFax,
  deliveryAddress,
  deliveryLat,
  deliveryLng,
  items = [],
}: DealerOrderDetailsProps) {
  const tc = useTranslations('catalog');
  const lines = items.length > 0 ? items : [{}];
  const hasPin =
    typeof deliveryLat === 'number' &&
    Number.isFinite(deliveryLat) &&
    typeof deliveryLng === 'number' &&
    Number.isFinite(deliveryLng);

  return (
    <div className="maher-stagger space-y-6">
      {lines.map((item, index) => {
        const customs =
          item.customMeasurements && Array.isArray(item.customMeasurements)
            ? item.customMeasurements.filter((m) => m?.label?.trim() || m?.value?.trim())
            : [];
        const key = item.id ?? `item-${index}`;
        const sectionSuffix = lines.length > 1 ? ` (${index + 1})` : '';

        return (
          <div key={key} className="space-y-6">
            <Card title={`${tc('orderSection')}${sectionSuffix}`} className="maher-form-section">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Field label={tc('dealerCustomerOrderNumber')}>
                  <Ltr>{display(externalOrderNumber)}</Ltr>
                </Field>
                <Field label={tc('modelName')}>{display(item.productName)}</Field>
                <Field label={tc('quantity')}>
                  <span dir="ltr">{display(item.quantity)}</span>
                </Field>
                <Field label={tc('width')}>
                  <span dir="ltr">{display(item.width)}</span>
                </Field>
                <Field label={tc('height')}>
                  <span dir="ltr">{display(item.height)}</span>
                </Field>
                <Field label={tc('depth')}>
                  <span dir="ltr">{display(item.depth)}</span>
                </Field>
                {customs.length > 0 ? (
                  <div className="sm:col-span-2">
                    <dt className="text-text-tertiary">{tc('addDimension')}</dt>
                    <dd className="mt-1 space-y-1">
                      {customs.map((m, i) => (
                        <div key={`${m.label}-${i}`} className="font-medium">
                          {m.label || '—'}: <span dir="ltr">{display(m.value)}</span>
                        </div>
                      ))}
                    </dd>
                  </div>
                ) : null}
                <Field label={tc('orderNotes')} className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">
                    {display(item.notes || (lines.length === 1 ? notes : null))}
                  </span>
                </Field>
              </dl>
            </Card>

            <Card title={`${tc('fabricSection')}${sectionSuffix}`} className="maher-form-section">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Field label={tc('fabricName')} className="sm:col-span-2">
                  {item.fabricType || item.fabricColor
                    ? [item.fabricType, item.fabricColor].filter(Boolean).join(' · ')
                    : '—'}
                </Field>
                <Field label={tc('fabricDescription')} className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{display(item.description)}</span>
                </Field>
              </dl>
            </Card>
          </div>
        );
      })}

      <Card title={tc('customerSection')} className="maher-form-section">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label={tc('endCustomerName')}>{display(endCustomerName)}</Field>
          <Field label={tc('endCustomerPhone')}>
            <span dir="ltr">{display(endCustomerPhone)}</span>
          </Field>
          <Field label={tc('endCustomerFax')}>
            <span dir="ltr">{display(endCustomerFax)}</span>
          </Field>
          <Field label={tc('deliveryAddress')} className="sm:col-span-2">
            <span className="whitespace-pre-wrap">{display(deliveryAddress)}</span>
          </Field>
        </dl>
        {hasPin ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <DeliveryLocationMapLazy
              lat={deliveryLat!}
              lng={deliveryLng!}
              disabled
              onChange={() => undefined}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
