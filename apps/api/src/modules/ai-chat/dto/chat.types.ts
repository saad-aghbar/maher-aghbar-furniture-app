/**
 * Chat UI contract — mirrors apps/mobile ai-chatbot types.
 * Server returns already-localized board labels.
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'brand' | 'warning' | 'success';
};

export type ChatTableColumn = { key: string; label: string; align?: 'start' | 'end' };
export type ChatTableRow = Record<string, string>;

export type ChatEntityCard = {
  kind: 'order' | 'dealer' | 'invoice' | 'product' | 'task';
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  amount?: string;
  href?: string;
};

export type ChatListItem = {
  title: string;
  subtitle?: string;
  trailing?: string;
  tone?: 'default' | 'warning' | 'success';
};

export type ChatBarPoint = {
  label: string;
  value: number;
  display?: string;
};

export type ChatAction = {
  id: string;
  label: string;
  href?: string;
};

export type ChatContent =
  | { type: 'text'; markdown: string }
  | { type: 'thinking' }
  | { type: 'metrics'; title?: string; items: ChatMetric[] }
  | {
      type: 'table';
      title?: string;
      columns: ChatTableColumn[];
      rows: ChatTableRow[];
      caption?: string;
    }
  | { type: 'entities'; title?: string; items: ChatEntityCard[] }
  | { type: 'list'; title?: string; items: ChatListItem[] }
  | {
      type: 'chart';
      title?: string;
      unit?: string;
      points: ChatBarPoint[];
      caption?: string;
    }
  | { type: 'clarification'; question: string; options?: ChatAction[] }
  | { type: 'error'; title: string; body: string }
  | { type: 'sources'; lines: string[] };

export type ChatMessageDto = {
  id: string;
  role: ChatRole;
  createdAt: string;
  blocks: ChatContent[];
  suggestions?: ChatAction[];
};

export type AiChatLocale = 'ar' | 'en' | 'he';
export type AiChatSurface = 'admin' | 'customer';
