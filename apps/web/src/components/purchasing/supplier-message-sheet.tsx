'use client';

import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import { Alert, Button, Combobox, Sheet, Stamp, TextArea, useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface Supplier {
  id: string;
  code?: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
}

interface Draft {
  body: string;
  to: string | null;
  supplier: { id: string; name: string };
  procurementIds: string[];
}

interface SendResult extends Draft {
  whatsapp: { ok: boolean; to: string | null; body: string; error?: string };
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
}

/** wa.me deep link for the fallback "open WhatsApp" path. */
export function whatsappLink(to: string | null | undefined, body: string): string | null {
  const digits = (to ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

/**
 * SupplierMessageSheet — port of the mobile fabric WhatsApp flow. Pick the
 * supplier (defaults to the job's), get the drafted message from the API,
 * edit it, then send via WhatsApp Business; if the integration is off or
 * fails, open WhatsApp on this device with the same text.
 */
export function SupplierMessageSheet({
  open,
  onClose,
  procurementIds,
  defaultSupplierId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  procurementIds: string[];
  defaultSupplierId?: string | null;
  onSent?: () => void;
}) {
  const tp = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState<string | null>(defaultSupplierId ?? null);
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setSupplierId(defaultSupplierId ?? null);
    setBody('');
    setTouched(false);
    setLastResult(null);
  }, [open, defaultSupplierId]);

  const suppliers = useQuery({
    queryKey: ['suppliers-pick'],
    queryFn: () => apiFetch<{ data: Supplier[] }>('/api/v1/suppliers?pageSize=100&status=ACTIVE').then((r) => r.data),
    enabled: open,
    staleTime: 60_000,
  });
  const draft = useQuery({
    queryKey: ['fabric-whatsapp-draft', supplierId, ...procurementIds],
    enabled: open && Boolean(supplierId) && procurementIds.length > 0,
    queryFn: () => apiFetch<Draft>('/api/v1/fabric-procurements/draft-whatsapp', { method: 'POST', body: JSON.stringify({ ids: procurementIds, supplierId }) }),
  });
  useEffect(() => {
    if (draft.data && !touched) setBody(draft.data.body);
  }, [draft.data, touched]);

  const send = useMutation({
    mutationFn: () => apiFetch<SendResult>('/api/v1/fabric-procurements/send-whatsapp', { method: 'POST', body: JSON.stringify({ ids: procurementIds, supplierId, body: body.trim() || undefined }) }),
    onSuccess: async (res) => {
      setLastResult(res);
      await Promise.all([qc.invalidateQueries({ queryKey: ['fabric-procurements'] }), ...procurementIds.map((id) => qc.invalidateQueries({ queryKey: ['fabric-procurement', id] })), qc.invalidateQueries({ queryKey: ['order-fabric-tracker'] })]);
      if (res.whatsapp?.ok) {
        toast.success(tp('whatsappSent'), res.purchaseOrderNumber ?? undefined);
        onSent?.();
        onClose();
      } else {
        toast.error(tp('whatsappFailed'));
      }
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const to = draft.data?.to ?? null;
  const link = whatsappLink(to, body);
  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId) ?? null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tp('messageSupplier')}
      description={tp('messageSupplierHint')}
      closeLabel={tCommon('close')}
      widthClassName="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={send.isPending}>
            {tCommon('cancel')}
          </Button>
          {link ? (
            <Button variant="secondary" leadingIcon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(link, '_blank', 'noopener,noreferrer')} disabled={!body.trim()}>
              {tp('openInWhatsApp')}
            </Button>
          ) : null}
          <Button leadingIcon={<Send className="h-4 w-4 rtl:-scale-x-100" />} loading={send.isPending} disabled={!supplierId || !body.trim() || draft.isLoading} onClick={() => send.mutate()}>
            {tp('sendWhatsApp')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Combobox
          label={tp('supplier')}
          value={supplierId}
          onChange={(v) => {
            setSupplierId(v);
            setTouched(false);
          }}
          options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.nameAr || s.nameEn ? localizedName(locale, s, s.name) : s.name, description: [s.code, s.whatsappPhone ?? s.phone].filter(Boolean).join(' · ') }))}
          emptyText={kit.combobox.empty}
          loadingText={kit.combobox.loading}
          clearLabel={kit.combobox.clear}
          placeholder={tp('supplierRequired')}
        />
        {supplierId && draft.isSuccess && !to ? <Alert variant="warning">{tp('whatsappNoPhone')}</Alert> : null}
        {supplier || to ? (
          <p className="m-0 flex flex-wrap items-center gap-2 text-[12px] text-[var(--maher-text-tertiary)]">
            {to ? (
              <Stamp tone="success" size="sm">
                <span dir="ltr">{to}</span>
              </Stamp>
            ) : null}
            {procurementIds.length > 1 ? <Stamp tone="neutral" size="sm">{procurementIds.length}</Stamp> : null}
          </p>
        ) : null}
        <TextArea
          label={tp('messageBody')}
          autoGrow
          rows={8}
          maxRows={18}
          dir="auto"
          value={draft.isLoading && !body ? '…' : body}
          onChange={(e) => {
            setTouched(true);
            setBody(e.target.value);
          }}
          disabled={!supplierId || draft.isLoading}
        />
        {lastResult && !lastResult.whatsapp?.ok ? (
          <Alert variant="warning">
            {tp('whatsappFailed')}
            {lastResult.whatsapp?.error ? <span className="block text-[12px] opacity-80">{lastResult.whatsapp.error}</span> : null}
          </Alert>
        ) : null}
      </div>
    </Sheet>
  );
}
