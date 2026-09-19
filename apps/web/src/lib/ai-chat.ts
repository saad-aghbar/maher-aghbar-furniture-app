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

export type ChatMessage = {
  id: string;
  role: ChatRole;
  createdAt: string;
  blocks: ChatContent[];
  suggestions?: ChatAction[];
};

export type AiChatConversation = {
  id: string;
  locale: string;
  surface: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SendMessageResult = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
};

export type AiChatSurface = 'admin' | 'dealer';

/** Map Expo-style tool hrefs onto the matching website routes. */
export function remapChatHref(href: string | undefined, surface: AiChatSurface): string | undefined {
  if (!href) return undefined;
  const path = href.replace(/^\/\(app\)\/\(admin\)/, '').replace(/^\/\(app\)\/\(customer\)/, '');

  const adminMap: Array<[RegExp, string]> = [
    [/^\/orders\/([^/]+)/, '/sales-orders/$1'],
    [/^\/invoices\/([^/]+)/, '/invoices/$1'],
    [/^\/dealers\/([^/]+)/, '/customers/$1'],
    [/^\/products\/([^/]+)/, '/products/$1'],
    [/^\/requests\/([^/]+)/, '/requests/$1'],
    [/^\/inventory\/items\/([^/]+)/, '/inventory'],
    [/^\/catalog\/([^/]+)/, '/products/$1'],
  ];
  const dealerMap: Array<[RegExp, string]> = [
    [/^\/orders\/([^/]+)/, '/orders/$1'],
    [/^\/invoices\/([^/]+)/, '/invoices/$1'],
    [/^\/requests\/([^/]+)/, '/orders/requests/$1'],
    [/^\/catalog\/([^/]+)/, '/catalog'],
    [/^\/account\/statement/, '/statement'],
  ];

  const table = surface === 'dealer' ? dealerMap : adminMap;
  for (const [re, dest] of table) {
    const m = path.match(re);
    if (m) return dest.replace('$1', m[1] ?? '');
  }
  if (path.startsWith('/') && !path.includes('(app)')) return path;
  return undefined;
}

export function userTextMessage(text: string): ChatMessage {
  return {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    createdAt: new Date().toISOString(),
    blocks: [{ type: 'text', markdown: text }],
  };
}

export function thinkingMessage(): ChatMessage {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    createdAt: new Date().toISOString(),
    blocks: [{ type: 'thinking' }],
  };
}
