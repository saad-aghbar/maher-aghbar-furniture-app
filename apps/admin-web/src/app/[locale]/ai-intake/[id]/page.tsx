'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';

/** Old job URLs hop to the linked request (or the requests list). */
export default function AiIntakeJobRedirectPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ request?: { id: string } | null }>(`/api/v1/ai-intake/jobs/${params.id}`)
      .then((job) => {
        if (cancelled) return;
        if (job.request?.id) router.replace(`/requests/${job.request.id}`);
        else router.replace('/requests');
      })
      .catch(() => {
        if (!cancelled) router.replace('/requests');
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  return null;
}
