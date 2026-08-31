'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableNumericCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface PrDetail {
  id: string;
  number: string;
  status: string;
  reason?: string | null;
  lines: Array<{
    id: string;
    description: string;
    quantity: string | number;
    inventoryItemId?: string | null;
  }>;
  offers?: Array<{
    id: string;
    unitPrice: string | number;
    leadTimeDays?: number | null;
    qualityScore?: string | number | null;
    isSelected: boolean;
    supplier: { id: string; name: string; nameAr?: string | null; nameEn?: string | null };
  }>;
  purchaseOrder?: { id: string; number: string; status: string } | null;
}

export default function PurchaseRequestDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const router = useRouter();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [qualityScore, setQualityScore] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [whatsappBody, setWhatsappBody] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['purchase-request', params.id],
    queryFn: () => apiFetch<PrDetail>(`/api/v1/purchase-requests/${params.id}`),
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-pick-pr'],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; name: string; nameAr?: string; nameEn?: string }> }>(
        '/api/v1/suppliers?pageSize=100',
      ).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/purchase-requests/${params.id}/approve`, { method: 'POST' }),
    onSuccess: async () => {
      setApproveOpen(false);
      setBanner(tc('purchaseRequestApproved'));
      await qc.invalidateQueries({ queryKey: ['purchase-request', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const offerMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/purchase-requests/${params.id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          unitPrice: Number(unitPrice),
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
          qualityScore: qualityScore ? Number(qualityScore) : undefined,
          isSelected: true,
        }),
      }),
    onSuccess: async () => {
      setBanner(tc('addSupplierOffer'));
      setSupplierId('');
      setUnitPrice('');
      setLeadTimeDays('');
      await qc.invalidateQueries({ queryKey: ['purchase-request', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/v1/purchase-requests/${params.id}/convert`, {
        method: 'POST',
      }),
    onSuccess: async (po) => {
      setConvertOpen(false);
      setBanner(tc('convertToPo'));
      router.push(`/purchasing/${po.id}`);
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const sendToSupplierMutation = useMutation({
    mutationFn: () =>
      apiFetch<{
        purchaseOrder: { id: string };
        whatsapp: { ok: boolean; to: string | null; body: string; error?: string };
      }>(`/api/v1/purchase-requests/${params.id}/send-to-supplier`, {
        method: 'POST',
      }),
    onSuccess: async (result) => {
      setSendOpen(false);
      setWhatsappBody(result.whatsapp.body);
      if (result.whatsapp.ok && result.whatsapp.to) {
        setBanner(tc('whatsappSentOk', { to: result.whatsapp.to }));
      } else if (!result.whatsapp.to) {
        setBanner(tc('whatsappNoPhone'));
      } else {
        setBanner(tc('whatsappSentFailed'));
      }
      router.push(`/purchasing/${result.purchaseOrder.id}`);
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const selectOfferMutation = useMutation({
    mutationFn: (offerId: string) =>
      apiFetch(`/api/v1/purchase-requests/${params.id}/offers/${offerId}/select`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      setBanner(tc('selectedOffer'));
      await qc.invalidateQueries({ queryKey: ['purchase-request', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (detailQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={tNav('purchasing')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const data = detailQuery.data;
  const rankedOffers = [...(data.offers ?? [])].sort((a, b) => {
    const priceDiff = Number(a.unitPrice) - Number(b.unitPrice);
    if (priceDiff !== 0) return priceDiff;
    return Number(b.qualityScore ?? 0) - Number(a.qualityScore ?? 0);
  });
  const recommendedOfferId = rankedOffers[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/purchasing"
        title={data.number}
        description={data.reason ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/purchasing">
              <Button variant="ghost" size="sm">
                {tCommon('back')}
              </Button>
            </Link>
            <StatusBadge status={data.status} />
            {data.status === 'SUBMITTED' ? (
              <Button size="sm" onClick={() => setApproveOpen(true)}>
                {tCommon('approve')}
              </Button>
            ) : null}
            {data.status === 'APPROVED' && !data.purchaseOrder ? (
              <>
                <Button size="sm" onClick={() => setSendOpen(true)}>
                  {tc('sendToSupplier')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConvertOpen(true)}>
                  {tc('convertToPo')}
                </Button>
              </>
            ) : null}
            {data.purchaseOrder ? (
              <Link href={`/purchasing/${data.purchaseOrder.id}`}>
                <Button size="sm" variant="secondary">
                  {data.purchaseOrder.number}
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {whatsappBody ? (
        <Alert variant="info">
          <p className="font-medium">{tc('whatsappMessage')}</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm" dir="ltr">
            {whatsappBody}
          </pre>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(whatsappBody);
              setBanner(tc('copyWhatsapp'));
            }}
          >
            {tc('copyWhatsapp')}
          </Button>
        </Alert>
      ) : null}

      <Card title={tc('lineItems')}>
        {data.lines.length === 0 ? (
          <EmptyState title={tc('noLines')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('description')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableNumericCell>{String(line.quantity)}</TableNumericCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card title={tc('supplierComparison')}>
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <Select
            label={tc('supplier')}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {(suppliersQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {localizedName(locale, s)}
              </option>
            ))}
          </Select>
          <Input
            label={tc('unitPrice')}
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            dir="ltr"
          />
          <Input
            label={tc('leadTimeDays')}
            type="number"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            dir="ltr"
          />
          <Input
            label={tc('qualityScore')}
            type="number"
            value={qualityScore}
            onChange={(e) => setQualityScore(e.target.value)}
            dir="ltr"
            placeholder="0–5"
          />
          <div className="flex items-end">
            <Button
              loading={offerMutation.isPending}
              disabled={!supplierId || !unitPrice}
              onClick={() => offerMutation.mutate()}
            >
              {tCommon('add')}
            </Button>
          </div>
        </div>
        {rankedOffers.length === 0 ? (
          <p className="text-sm text-text-secondary">{tc('noSupplierOffers')}</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('rank')}</TableHeaderCell>
                <TableHeaderCell>{tc('supplier')}</TableHeaderCell>
                <TableHeaderCell>{tc('unitPrice')}</TableHeaderCell>
                <TableHeaderCell>{tc('leadTimeDays')}</TableHeaderCell>
                <TableHeaderCell>{tc('qualityScore')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankedOffers.map((offer, index) => (
                <TableRow key={offer.id}>
                  <TableNumericCell>{index + 1}</TableNumericCell>
                  <TableCell>
                    {localizedName(locale, offer.supplier)}
                    {offer.id === recommendedOfferId ? (
                      <span className="ms-2 text-xs text-brand">{tc('recommendedOffer')}</span>
                    ) : null}
                  </TableCell>
                  <TableNumericCell>{String(offer.unitPrice)}</TableNumericCell>
                  <TableNumericCell>{offer.leadTimeDays ?? '—'}</TableNumericCell>
                  <TableNumericCell>
                    {offer.qualityScore != null ? String(offer.qualityScore) : '—'}
                  </TableNumericCell>
                  <TableCell>
                    {offer.isSelected ? tc('selectedOffer') : '—'}
                  </TableCell>
                  <TableCell>
                    {!offer.isSelected ? (
                      <Button
                        size="sm"
                        variant="subtle"
                        loading={selectOfferMutation.isPending}
                        onClick={() => selectOfferMutation.mutate(offer.id)}
                      >
                        {tc('selectOffer')}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={approveOpen}
        title={tCommon('approve')}
        description={tc('approvePurchaseOrderConfirm')}
        loading={approveMutation.isPending}
        onClose={() => setApproveOpen(false)}
        onConfirm={() => approveMutation.mutate()}
      />
      <ConfirmDialog
        open={convertOpen}
        title={tc('convertToPo')}
        description={tc('convertToPoConfirm')}
        loading={convertMutation.isPending}
        onClose={() => setConvertOpen(false)}
        onConfirm={() => convertMutation.mutate()}
      />
      <ConfirmDialog
        open={sendOpen}
        title={tc('sendToSupplier')}
        description={tc('sendToSupplierConfirm')}
        loading={sendToSupplierMutation.isPending}
        onClose={() => setSendOpen(false)}
        onConfirm={() => sendToSupplierMutation.mutate()}
      />
    </div>
  );
}
