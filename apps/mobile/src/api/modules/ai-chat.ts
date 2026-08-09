import { apiDelete, apiGet, apiPost } from '../client';
import type { ChatAction, ChatContent, ChatMessage } from '@/features/ai-chatbot/types';

export type AiChatConversation = {
  id: string;
  locale: string;
  surface: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatConversationDetail = AiChatConversation & {
  messages: ChatMessage[];
};

export type SendMessageResult = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
};

export function createAiChatConversation(body?: { locale?: string; title?: string }) {
  return apiPost<AiChatConversation>('/ai-chat/conversations', body ?? {});
}

export function listAiChatConversations() {
  return apiGet<AiChatConversation[]>('/ai-chat/conversations');
}

export function getAiChatConversation(id: string) {
  return apiGet<AiChatConversationDetail>(`/ai-chat/conversations/${id}`);
}

export function archiveAiChatConversation(id: string) {
  return apiDelete<{ ok: boolean }>(`/ai-chat/conversations/${id}`);
}

export function sendAiChatMessage(
  conversationId: string,
  body: { text: string; clientMessageId?: string; locale?: string },
) {
  return apiPost<SendMessageResult>(
    `/ai-chat/conversations/${conversationId}/messages`,
    body,
    { timeoutMs: 90_000 },
  );
}

export type { ChatAction, ChatContent, ChatMessage };
