'use client';

import { AiChatPanel } from '@/components/ai-chat/ai-chat-panel';
import { useRouter } from '@/i18n/navigation';

export default function DealerAiChatPage() {
  const router = useRouter();
  return <AiChatPanel surface="dealer" onNavigate={(href) => router.push(href)} />;
}
