'use client';

import { AiChatPanel } from '@/components/ai-chat/ai-chat-panel';
import { useRouter } from '@/i18n/navigation';
import { PageHero } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function DealerAiChatPage() {
  const t = useTranslations('navigation');
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHero tone="soft" title={t('aiChat')} />
      <AiChatPanel surface="dealer" onNavigate={(href) => router.push(href)} />
    </div>
  );
}
