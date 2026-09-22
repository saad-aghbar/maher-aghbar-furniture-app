'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import type { AuthUser } from '@maher/types';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  DataBoard,
  FormFooter,
  FormSection,
  Input,
  Ledger,
  LedgerRow,
  Ltr,
  QrDisplay,
  Stamp,
  useToast,
  type DataColumn,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface SessionRow {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
}

function describeAgent(ua: string | null | undefined, unknown: string) {
  if (!ua) return { label: unknown, mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad|Expo|okhttp/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : /Expo|okhttp/i.test(ua) ? 'Maher app' : ua.split(' ')[0] ?? unknown;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: [browser, os].filter(Boolean).join(' · '), mobile };
}

/**
 * SecurityDesk — password, MFA (QR + confirm) and signed-in devices.
 * Shared by admin account, dealer security and worker profile pages.
 */
export function SecurityDesk({ showPassword = true }: { showPassword?: boolean }) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaOtpauth, setMfaOtpauth] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<SessionRow | null>(null);

  const me = useQuery({ queryKey: ['auth-me'], queryFn: () => apiFetch<AuthUser & { mfaEnabled?: boolean; mfaPending?: boolean }>('/api/v1/auth/me') });
  const sessions = useQuery({ queryKey: ['auth-sessions'], queryFn: () => apiFetch<SessionRow[]>('/api/v1/auth/sessions') });

  const changePassword = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
    onSuccess: () => {
      setCurrent('');
      setNew('');
      setPasswordError(null);
      toast.success(t('passwordChanged'));
      void queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
    onError: (err) => setPasswordError(mutationErrorMessage(err) || t('passwordChangeFailed')),
  });
  const mfaEnable = useMutation({
    mutationFn: () => apiFetch<{ secret: string; otpauthUrl: string }>('/api/v1/auth/mfa/enable', { method: 'POST', body: '{}' }),
    onSuccess: (data) => {
      setMfaError(null);
      setMfaSecret(data.secret);
      setMfaOtpauth(data.otpauthUrl);
    },
    onError: (err) => setMfaError(mutationErrorMessage(err)),
  });
  const mfaConfirm = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ code: mfaCode.trim() }) }),
    onSuccess: async () => {
      setMfaError(null);
      setMfaSecret(null);
      setMfaOtpauth(null);
      setMfaCode('');
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      toast.success(t('mfaEnabled'));
    },
    onError: (err) => setMfaError(mutationErrorMessage(err) || t('mfaInvalid')),
  });
  const mfaDisable = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/mfa/disable', { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setMfaError(null);
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      toast.info(t('mfaDisabled'));
    },
    onError: (err) => setMfaError(mutationErrorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setRevoking(null);
      await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const rows = sessions.data ?? [];
  const newest = rows[0]?.id;
  const mfaOn = Boolean(me.data?.mfaEnabled);

  const columns: DataColumn<SessionRow>[] = [
    {
      key: 'device',
      header: t('sessions'),
      cell: (row) => {
        const agent = describeAgent(row.userAgent, t('unknownDevice'));
        return (
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-tertiary)]">{agent.mobile ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold text-[var(--maher-text-primary)]">
                {agent.label}
                {row.id === newest ? <Stamp tone="success" size="sm">{t('thisDevice')}</Stamp> : null}
              </span>
              {row.ipAddress ? <Ltr className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">{row.ipAddress}</Ltr> : null}
            </span>
          </span>
        );
      },
    },
    { key: 'signedIn', header: t('signedIn'), hideBelow: 'md', cell: (row) => <Ltr>{fmt.format(new Date(row.createdAt))}</Ltr> },
    { key: 'expires', header: t('expires'), hideBelow: 'lg', cell: (row) => <Ltr className="text-[var(--maher-text-secondary)]">{fmt.format(new Date(row.expiresAt))}</Ltr> },
    {
      key: 'actions',
      header: '',
      numeric: true,
      width: '120px',
      cell: (row) => (
        <Button size="sm" variant="ghost" leadingIcon={<LogOut className="h-3.5 w-3.5" />} onClick={() => setRevoking(row)}>
          {t('revoke')}
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-7">
        {showPassword ? (
          <FormSection title={t('changePassword')} description={t('passwordHint')} columns={2} tone={passwordError ? 'error' : 'brand'}>
            <Input label={t('currentPassword')} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
            <Input label={t('newPassword')} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
            <div className="md:col-span-2">
              <FormFooter
                className="mt-0 border-0 p-0"
                error={passwordError}
                primary={
                  <Button loading={changePassword.isPending} disabled={!currentPassword || newPassword.length < 8} onClick={() => changePassword.mutate()}>
                    {t('changePassword')}
                  </Button>
                }
              />
            </div>
          </FormSection>
        ) : null}

        {sessions.isLoading && !sessions.data ? (
          <BoardSkeleton rows={3} />
        ) : (
          <DataBoard<SessionRow>
            aria-label={t('sessions')}
            title={t('sessions')}
            description={t('sessionsHint')}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            mobileRow={(row) => ({ title: describeAgent(row.userAgent, t('unknownDevice')).label, meta: fmt.format(new Date(row.createdAt)), trailing: <Button size="sm" variant="ghost" onClick={() => setRevoking(row)}>{t('revoke')}</Button> })}
            empty={<Board.Empty title={t('unknownDevice')} />}
          />
        )}
      </div>

      <div className="xl:col-span-5">
        <Board tone={mfaOn ? 'success' : 'warning'} wash="top">
          <Board.Header title={t('mfaSetup')} description={t('mfaSetupHint')} meta={<Stamp tone={mfaOn ? 'success' : me.data?.mfaPending ? 'warning' : 'neutral'} size="sm">{mfaOn ? t('mfaEnabled') : me.data?.mfaPending ? t('mfaConfirm') : t('mfaDisabled')}</Stamp>} />
          <Board.Body className="space-y-4">
            {mfaError ? <Alert variant="error">{mfaError}</Alert> : null}
            {mfaOtpauth ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <QrDisplay value={mfaOtpauth} size={184} caption={t('mfaSecret')} />
                </div>
                <Ledger>
                  <LedgerRow
                    label={t('mfaSecret')}
                    value={<Ltr wrap className="font-mono text-[12px]">{mfaSecret}</Ltr>}
                    icon={
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (mfaSecret) void navigator.clipboard?.writeText(mfaSecret).then(() => toast.success(tCommon('copied')));
                        }}
                      >
                        {t('mfaCopySecret')}
                      </Button>
                    }
                  />
                </Ledger>
                <Input label={t('mfaCode')} hint={t('mfaRequired')} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
              </div>
            ) : null}
          </Board.Body>
          <Board.Footer>
            {mfaOtpauth ? (
              <Button loading={mfaConfirm.isPending} disabled={mfaCode.trim().length < 6} onClick={() => mfaConfirm.mutate()}>
                {t('mfaConfirm')}
              </Button>
            ) : mfaOn ? (
              <Button variant="secondary" loading={mfaDisable.isPending} onClick={() => mfaDisable.mutate()}>
                {t('mfaDisable')}
              </Button>
            ) : (
              <Button loading={mfaEnable.isPending} onClick={() => mfaEnable.mutate()}>
                {t('mfaEnable')}
              </Button>
            )}
          </Board.Footer>
        </Board>
      </div>

      <ConfirmDialog
        open={Boolean(revoking)}
        title={t('revoke')}
        description={t('revokeConfirm')}
        confirmLabel={t('revoke')}
        danger
        loading={revoke.isPending}
        onClose={() => !revoke.isPending && setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
    </div>
  );
}
