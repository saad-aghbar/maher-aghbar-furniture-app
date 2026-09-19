'use client';

import { Alert } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function OnlineRequiredBanner() {
  const t = useTranslations('auth');
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <div className="px-4 pt-3">
      <Alert variant="warning">{t('networkError')}</Alert>
    </div>
  );
}
