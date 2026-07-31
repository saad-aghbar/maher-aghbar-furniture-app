'use client';

import { apiFetch } from '@/lib/api-client';
import { Alert, Button, Card, Input, TextArea } from '@maher/ui';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const STEPS = [
  'Product',
  'Dimensions',
  'Materials',
  'Delivery',
  'Attachments notes',
  'Review & submit',
] as const;

export default function RequestQuotePage() {
  const t = useTranslations('navigation');
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const me = await apiFetch<{ customerId?: string }>('/api/v1/auth/me');
      if (!me.customerId) throw new Error('no customer');
      await apiFetch('/api/v1/requests', {
        method: 'POST',
        body: JSON.stringify({
          customerId: me.customerId,
          source: 'PORTAL',
          notes: [
            notes,
            material ? `Material: ${material}` : '',
            fabric ? `Fabric: ${fabric}` : '',
            color ? `Color: ${color}` : '',
            deliveryCity ? `Delivery city: ${deliveryCity}` : '',
            preferredDate ? `Preferred date: ${preferredDate}` : '',
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
      router.push('/dashboard');
    } catch {
      setError('Could not submit request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{t('requestQuote')}</h1>
      <ol className="flex flex-wrap gap-2 text-xs text-[var(--maher-text-secondary)]">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={
              step === i + 1 ? 'font-semibold text-brand' : step > i + 1 ? 'text-text-primary' : ''
            }
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <Card title={`Step ${step} / 6 — ${STEPS[step - 1]}`}>
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {step === 1 ? (
            <>
              <Input
                label="Product"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
              <Input
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Input label="Width (cm)" value={width} onChange={(e) => setWidth(e.target.value)} />
              <Input label="Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
              <Input label="Depth (cm)" value={depth} onChange={(e) => setDepth(e.target.value)} />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Input
                label="Material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
              <Input label="Fabric" value={fabric} onChange={(e) => setFabric(e.target.value)} />
              <Input label="Color" value={color} onChange={(e) => setColor(e.target.value)} />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <Input
                label="Delivery city"
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
              />
              <Input
                label="Preferred delivery date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </>
          ) : null}
          {step === 5 ? (
            <TextArea
              label="Notes / attachment refs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          ) : null}
          {step === 6 ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--maher-text-secondary)]">Product</dt>
                <dd className="font-medium">
                  {productName} × {quantity}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-secondary)]">Dimensions</dt>
                <dd className="font-medium">
                  {[width, height, depth].filter(Boolean).join(' × ') || '—'} cm
                </dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-secondary)]">Materials</dt>
                <dd className="font-medium">
                  {[material, fabric, color].filter(Boolean).join(' / ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-secondary)]">Delivery</dt>
                <dd className="font-medium">
                  {deliveryCity || '—'} {preferredDate ? `(${preferredDate})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--maher-text-secondary)]">Notes</dt>
                <dd className="font-medium whitespace-pre-wrap">{notes || '—'}</dd>
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
