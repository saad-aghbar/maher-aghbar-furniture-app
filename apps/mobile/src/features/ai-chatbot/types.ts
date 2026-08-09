/**
 * AI chatbot message model — UI-ready shapes for future API wiring.
 * No network calls yet; screens render these locally / from demo seeds.
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
  /** Deep-link into the matching surface screen when present. */
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
  /** When set, chip navigates instead of sending a follow-up prompt. */
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

export type ChatMessage = {
  id: string;
  role: ChatRole;
  createdAt: string;
  /** Primary content blocks — assistant may stack several. */
  blocks: ChatContent[];
  /** Suggested follow-ups under an assistant turn. */
  suggestions?: ChatAction[];
};

export type ChatSuggestionChip = ChatAction;
