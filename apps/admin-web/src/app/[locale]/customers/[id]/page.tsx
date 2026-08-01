'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

const PHONE_E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CustomerDetail {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  customerType: string;
  companyName?: string | null;
  notes?: string | null;
  preferredLanguage?: string | null;
  activeOrdersCount?: number;
  contacts?: Array<{ id: string; name: string; phone?: string; email?: string; position?: string }>;
  addresses?: Array<{
    id: string;
    label: string;
    city: string;
    street?: string;
    country: string;
    isDefaultDelivery: boolean;
    isDefaultBilling: boolean;
  }>;
}

interface EditForm {
  nameAr: string;
  nameEn: string;
  nameHe: string;
  customerType: string;
  companyName: string;
  phone: string;
  fax: string;
  email: string;
  preferredLanguage: string;
  notes: string;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('customers');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', position: '' });
  const [addressForm, setAddressForm] = useState({
    label: 'Delivery',
    city: '',
    street: '',
    country: 'JO',
    isDefaultDelivery: true,
    isDefaultBilling: false,
  });
  const [noteSummary, setNoteSummary] = useState('');
  const [subError, setSubError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer', params.id],
    queryFn: () => apiFetch<CustomerDetail>(`/api/v1/customers/${params.id}`),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['customer', params.id] });
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editForm) return;
      if (!editForm.nameAr.trim() && !editForm.nameEn.trim() && !editForm.nameHe.trim()) {
        throw new ApiClientError(t('nameRequired'), 400);
      }
      if (editForm.phone.trim() && !PHONE_E164.test(editForm.phone.trim())) {
        throw new ApiClientError(t('invalidPhone'), 400);
      }
      if (editForm.fax.trim() && !PHONE_E164.test(editForm.fax.trim())) {
        throw new ApiClientError(t('invalidFax'), 400);
      }
      if (editForm.email.trim() && !EMAIL_RE.test(editForm.email.trim())) {
        throw new ApiClientError(t('invalidEmail'), 400);
      }
      return apiFetch(`/api/v1/customers/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameAr: editForm.nameAr.trim(),
          nameEn: editForm.nameEn.trim(),
          nameHe: editForm.nameHe.trim(),
          customerType: editForm.customerType,
          companyName: editForm.companyName.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          fax: editForm.fax.trim() || undefined,
          email: editForm.email.trim() || undefined,
          preferredLanguage: editForm.preferredLanguage,
          notes: editForm.notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setEditError(null);
      await invalidate();
      setEditOpen(false);
      setBanner(t('updated'));
    },
    onError: (err) => setEditError(mutationErrorMessage(err)),
  });

  const contactMutation = useMutation({
    mutationFn: () => {
      if (!contactForm.name.trim()) throw new ApiClientError('Contact name is required.', 400);
      return apiFetch(`/api/v1/customers/${params.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          name: contactForm.name.trim(),
          phone: contactForm.phone.trim() || undefined,
          email: contactForm.email.trim() || undefined,
          position: contactForm.position.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setSubError(null);
      await invalidate();
      setContactOpen(false);
      setContactForm({ name: '', phone: '', email: '', position: '' });
      setBanner(t('contactCreated'));
    },
    onError: (err) => setSubError(mutationErrorMessage(err)),
  });

  const addressMutation = useMutation({
    mutationFn: () => {
      if (!addressForm.city.trim() || !addressForm.label.trim()) {
        throw new ApiClientError('Label and city are required.', 400);
      }
      return apiFetch(`/api/v1/customers/${params.id}/addresses`, {
        method: 'POST',
        body: JSON.stringify({
          ...addressForm,
          city: addressForm.city.trim(),
          street: addressForm.street.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setSubError(null);
      await invalidate();
      setAddressOpen(false);
      setBanner(t('addressCreated'));
    },
    onError: (err) => setSubError(mutationErrorMessage(err)),
  });

  const noteMutation = useMutation({
    mutationFn: () => {
      if (!noteSummary.trim()) throw new ApiClientError('Summary is required.', 400);
      return apiFetch(`/api/v1/customers/${params.id}/communications`, {
        method: 'POST',
        body: JSON.stringify({ type: 'NOTE', summary: noteSummary.trim() }),
      });
    },
    onSuccess: async () => {
      setSubError(null);
      await invalidate();
      setNoteOpen(false);
      setNoteSummary('');
      setBanner(t('noteCreated'));
    },
    onError: (err) => setSubError(mutationErrorMessage(err)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) {
    return (
      <ErrorState title={t('detail')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />
    );
  }

  const entityNameLabel =
    (editForm?.customerType ?? data.customerType) === 'INDIVIDUAL'
      ? t('individualName')
      : t('companyName');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            {tCommon('back')}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{localizedName(locale, data)}</h1>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              window.open(`${API_URL}/api/v1/statements/${params.id}/pdf`, '_blank');
            }}
          >
            {tNav('statement')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditForm({
                nameAr: data.nameAr ?? '',
                nameEn: data.nameEn ?? '',
                nameHe: data.nameHe ?? '',
                customerType: data.customerType,
                companyName: data.companyName ?? '',
                phone: data.phone ?? '',
                fax: data.fax ?? '',
                email: data.email ?? '',
                preferredLanguage: data.preferredLanguage ?? 'ar',
                notes: data.notes ?? '',
              });
              setEditError(null);
              setEditOpen(true);
            }}
          >
            {t('edit')}
          </Button>
        </div>
      </div>

      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <Card title={t('detail')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('code')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.code}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('type')}</dt>
            <dd className="font-medium">
              {data.customerType === 'INDIVIDUAL' ? t('individual') : t('company')}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('activeOrders')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.activeOrdersCount ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{entityNameLabel}</dt>
            <dd className="font-medium">{data.companyName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('email')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.email ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('phone')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.phone ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('fax')}</dt>
            <dd className="font-medium" dir="ltr">
              {data.fax ?? '—'}
            </dd>
          </div>
          {data.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-[var(--maher-text-secondary)]">{t('notes')}</dt>
              <dd className="font-medium">{data.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card
        title={t('contacts')}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setSubError(null);
              setContactOpen(true);
            }}
          >
            {t('addContact')}
          </Button>
        }
      >
        {(data.contacts ?? []).length === 0 ? (
          <p className="text-sm text-[var(--maher-text-secondary)]">—</p>
        ) : (
          <ul className="space-y-2">
            {(data.contacts ?? []).map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium">{c.name}</span>
                {c.position ? ` · ${c.position}` : ''}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.email ? ` · ${c.email}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('addresses')}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setSubError(null);
              setAddressOpen(true);
            }}
          >
            {t('addAddress')}
          </Button>
        }
      >
        {(data.addresses ?? []).length === 0 ? (
          <p className="text-sm text-[var(--maher-text-secondary)]">—</p>
        ) : (
          <ul className="space-y-2">
            {(data.addresses ?? []).map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{a.label}</span>
                {`: ${a.city}${a.street ? `, ${a.street}` : ''}, ${a.country}`}
                {a.isDefaultDelivery ? ` · ${t('defaultDelivery')}` : ''}
                {a.isDefaultBilling ? ` · ${t('defaultBilling')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setSubError(null);
            setNoteOpen(true);
          }}
        >
          {t('addNote')}
        </Button>
      </div>

      <Modal
        open={editOpen}
        onClose={() => !saveMutation.isPending && setEditOpen(false)}
        title={t('edit')}
        footer={
          <>
            <Button variant="ghost" disabled={saveMutation.isPending} onClick={() => setEditOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        {editForm ? (
          <div className="grid gap-3">
            {editError ? <Alert variant="error">{editError}</Alert> : null}
            <Input
              label={t('nameAr')}
              value={editForm.nameAr}
              onChange={(e) => setEditForm({ ...editForm, nameAr: e.target.value })}
            />
            <Input
              label={t('nameEn')}
              value={editForm.nameEn}
              onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
            />
            <Input
              label={t('nameHe')}
              value={editForm.nameHe}
              onChange={(e) => setEditForm({ ...editForm, nameHe: e.target.value })}
            />
            <Select
              label={t('type')}
              value={editForm.customerType}
              onChange={(e) => setEditForm({ ...editForm, customerType: e.target.value })}
            >
              <option value="COMPANY">{t('company')}</option>
              <option value="INDIVIDUAL">{t('individual')}</option>
            </Select>
            <Input
              label={entityNameLabel}
              value={editForm.companyName}
              onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
            />
            <Input
              label={t('phone')}
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              hint={t('phoneHint')}
              dir="ltr"
            />
            <Input
              label={t('fax')}
              value={editForm.fax}
              onChange={(e) => setEditForm({ ...editForm, fax: e.target.value })}
              dir="ltr"
            />
            <Input
              label={t('email')}
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              dir="ltr"
            />
            <Select
              label={t('language')}
              value={editForm.preferredLanguage}
              onChange={(e) => setEditForm({ ...editForm, preferredLanguage: e.target.value })}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="he">עברית</option>
            </Select>
            <Input
              label={t('notes')}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={contactOpen}
        onClose={() => !contactMutation.isPending && setContactOpen(false)}
        title={t('addContact')}
        footer={
          <>
            <Button variant="ghost" disabled={contactMutation.isPending} onClick={() => setContactOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={contactMutation.isPending} onClick={() => contactMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {subError ? <Alert variant="error">{subError}</Alert> : null}
          <Input
            label={`${t('contactName')} *`}
            value={contactForm.name}
            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
          />
          <Input
            label={t('position')}
            value={contactForm.position}
            onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
          />
          <Input
            label={t('phone')}
            value={contactForm.phone}
            onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
          />
          <Input
            label={t('email')}
            value={contactForm.email}
            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={addressOpen}
        onClose={() => !addressMutation.isPending && setAddressOpen(false)}
        title={t('addAddress')}
        footer={
          <>
            <Button variant="ghost" disabled={addressMutation.isPending} onClick={() => setAddressOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={addressMutation.isPending} onClick={() => addressMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {subError ? <Alert variant="error">{subError}</Alert> : null}
          <Input
            label={`${t('label')} *`}
            value={addressForm.label}
            onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
          />
          <Input
            label={`${t('city')} *`}
            value={addressForm.city}
            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
          />
          <Input
            label={t('street')}
            value={addressForm.street}
            onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
          />
          <Input
            label={t('country')}
            value={addressForm.country}
            onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addressForm.isDefaultDelivery}
              onChange={(e) =>
                setAddressForm({ ...addressForm, isDefaultDelivery: e.target.checked })
              }
            />
            {t('defaultDelivery')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addressForm.isDefaultBilling}
              onChange={(e) =>
                setAddressForm({ ...addressForm, isDefaultBilling: e.target.checked })
              }
            />
            {t('defaultBilling')}
          </label>
        </div>
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => !noteMutation.isPending && setNoteOpen(false)}
        title={t('addNote')}
        footer={
          <>
            <Button variant="ghost" disabled={noteMutation.isPending} onClick={() => setNoteOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={noteMutation.isPending} onClick={() => noteMutation.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {subError ? <Alert variant="error">{subError}</Alert> : null}
          <Input
            label={`${t('noteSummary')} *`}
            value={noteSummary}
            onChange={(e) => setNoteSummary(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
