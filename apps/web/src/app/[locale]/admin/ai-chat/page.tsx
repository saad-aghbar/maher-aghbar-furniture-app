'use client';

import { AiChatPanel } from '@/components/ai-chat/ai-chat-panel';
import { useRouter } from '@/i18n/navigation';

export default function AiChatPage() {
  const router = useRouter();
  return <AiChatPanel surface="admin" onNavigate={(href) => router.push(href)} />;
}
