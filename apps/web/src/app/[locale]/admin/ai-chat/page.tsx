'use client';

import { PageHeader } from '@/components/admin/page-header';
import { AiChatPanel } from '@/components/ai-chat/ai-chat-panel';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function AiChatPage() {
  const t = useTranslations('navigation');
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader title={t('aiChat')} />
      <AiChatPanel surface="admin" onNavigate={(href) => router.push(href)} />
    </div>
  );
}
