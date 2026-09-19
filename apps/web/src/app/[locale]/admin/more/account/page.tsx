'use client';

import { apiFetch } from '@/lib/api-client';
import type { AuthUser } from '@maher/types';
import { Button, FloorBoard, Input, PageHero } from '@maher/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function AdminAccountPage() {
  const t = useTranslations('auth');
  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const change = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHero title={t('changePassword')} />
      <FloorBoard header={<p>{me.data?.name}</p>}>
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]" dir="ltr">
            {me.data?.username}
          </p>
          <Input label={t('currentPassword')} type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          <Input label={t('newPassword')} type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
          <Button onClick={() => change.mutate()} loading={change.isPending}>
            {t('changePassword')}
          </Button>
        </div>
      </FloorBoard>
    </div>
  );
}
