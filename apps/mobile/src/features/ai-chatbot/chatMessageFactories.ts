import type { ChatMessage } from './types';

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function userTextMessage(text: string): ChatMessage {
  return {
    id: id('u'),
    role: 'user',
    createdAt: new Date().toISOString(),
    blocks: [{ type: 'text', markdown: text }],
  };
}

export function thinkingMessage(): ChatMessage {
  return {
    id: id('t'),
    role: 'assistant',
    createdAt: new Date().toISOString(),
    blocks: [{ type: 'thinking' }],
  };
}
