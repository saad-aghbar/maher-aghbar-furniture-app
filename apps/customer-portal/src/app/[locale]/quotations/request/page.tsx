'use client';

import { apiFetch, apiUpload } from '@/lib/api-client';
import { useRouter } from '@/i18n/navigation';
import { Alert, Button, Card, Input, Select, TextArea } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const STEP_KEYS = [
  'stepProduct',
  'stepDimensions',
  'stepMaterials',
  'stepDelivery',
  'stepChannelAttachments',
  'stepReview',
] as const;

const CHANNELS = [
  { value: 'PORTAL', labelKey: 'channelPortal' as const },
  { value: 'WHATSAPP', labelKey: 'channelWhatsapp' as const },
  { value: 'EMAIL', labelKey: 'channelEmail' as const },
  { value: 'PDF', labelKey: 'channelPdf' as const },
  { value: 'PHONE', labelKey: 'channelPhone' as const },
];

export default function RequestQuotePage() {
  const t = useTranslations('navigation');
  const tQ = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [material, setMaterial] = useState('');
  const [fabric, setFabric] = useState('');
  const [color, setColor] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('PORTAL');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stepLabels = useMemo(
    () => STEP_KEYS.map((key) => tQ(key)),
    [tQ],
  );

  const channelLabel = CHANNELS.find((c) => c.value === source);

  async function submit() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const me = await apiFetch<{ customerId?: string }>('/api/v1/auth/me');
      if (!me.customerId) throw new Error('no customer');
      const created = await apiFetch<{ id: string }>('/api/v1/requests', {
        method: 'POST',
        body: JSON.stringify({
          customerId: me.customerId,
          source,
          requiredDeliveryDate: preferredDate || undefined,
          deliveryAddress: deliveryCity || undefined,
          notes: [
            notes,
            material ? `Material: ${material}` : '',
            fabric ? `Fabric: ${fabric}` : '',
            color ? `Color: ${color}` : '',
            deliveryCity ? `Delivery city: ${deliveryCity}` : '',
            preferredDate ? `Preferred date: ${preferredDate}` : '',
            `Channel: ${source}`,
          ]
            .filter(Boolean)
            .join('\n'),
          items: [
            {
              productName,
              quantity: Number(quantity),
              width: width ? Number(width) : undefined,
              height: height ? Number(height) : undefined,
              depth: depth ? Number(depth) : undefined,
              material: material || undefined,
              fabric: fabric || undefined,
              color: color || undefined,
            },
          ],
        }),
      });

      if (file) {
        const form = new FormData();
        form.append('file', file);
        await apiUpload(
          `/api/v1/uploads?category=RFQ_ATTACHMENT&requestId=${created.id}`,
          form,
        );
      }

      setSuccess(tQ('submittedOk'));
      setTimeout(() => router.push('/requests'), 1200);
    } catch {
      setError(tQ('submitFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('requestQuote')}</h1>
      <ol className="flex flex-wrap gap-2 text-xs text-text-secondary">
        {stepLabels.map((label, i) => (
          <li
            key={STEP_KEYS[i]}
            className={
              step === i + 1 ? 'font-semibold text-brand' : step > i + 1 ? 'text-text-primary' : ''
            }
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <Card
        title={tQ('stepTitle', {
          step: String(step),
          total: '6',
          label: stepLabels[step - 1] ?? '',
        })}
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          {step === 1 ? (
            <>
              <Input
                label={tc('product')}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
              <Input
                label={tc('quantity')}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Input label={tc('width')} value={width} onChange={(e) => setWidth(e.target.value)} />
              <Input label={tc('height')} value={height} onChange={(e) => setHeight(e.target.value)} />
              <Input label={tc('depth')} value={depth} onChange={(e) => setDepth(e.target.value)} />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Input label={tc('material')} value={material} onChange={(e) => setMaterial(e.target.value)} />
              <Input label={tc('fabric')} value={fabric} onChange={(e) => setFabric(e.target.value)} />
              <Input label={tc('color')} value={color} onChange={(e) => setColor(e.target.value)} />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <Input
                label={tQ('deliveryCity')}
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
              />
              <Input
                label={tQ('preferredDeliveryDate')}
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </>
          ) : null}
          {step === 5 ? (
            <>
              <Select
                label={tQ('channel')}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {tQ(c.labelKey)}
                  </option>
                ))}
              </Select>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {tQ('attachFile')}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <TextArea
                label={tc('notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </>
          ) : null}
          {step === 6 ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-text-secondary">{tc('product')}</dt>
                <dd className="font-medium">
                  {productName} × {quantity}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">{tQ('channel')}</dt>
                <dd className="font-medium">
                  {channelLabel ? tQ(channelLabel.labelKey) : source}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">{tQ('attachment')}</dt>
                <dd className="font-medium">{file?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">{tc('dims')}</dt>
                <dd className="font-medium">
                  {[width, height, depth].filter(Boolean).join(' × ') || '—'} cm
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">{tQ('stepDelivery')}</dt>
                <dd className="font-medium">
                  {deliveryCity || '—'} {preferredDate ? `(${preferredDate})` : ''}
                </dd>
              </div>
            </dl>
          ) : null}
          <div className="flex gap-3">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                {tCommon('previous')}
              </Button>
            ) : null}
            {step < 6 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && !productName.trim()}
              >
                {tCommon('next')}
              </Button>
            ) : (
              <Button onClick={submit} loading={loading}>
                {tCommon('submit')}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
