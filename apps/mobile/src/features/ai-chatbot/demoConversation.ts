import type { ChatAction, ChatMessage } from './types';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function d(t: TranslateFn, key: string, vars?: Record<string, string | number>) {
  return t(`mobile.aiChat.demo.${key}`, vars);
}

type DemoIntent =
  | 'late'
  | 'stock'
  | 'clarify'
  | 'invoice'
  | 'profit'
  | 'entities'
  | 'error'
  | 'fallback';

const INTENT_BY_ACTION: Record<string, DemoIntent> = {
  'demo-late': 'late',
  'demo-stock': 'stock',
  'demo-clarify': 'clarify',
  'demo-invoice': 'invoice',
  'demo-profit': 'profit',
  'demo-entities': 'entities',
  'pick-oasis-jerash': 'clarify',
  'pick-nile-zarqa': 'clarify',
};

/** Multilingual keyword hints for free-typed demo prompts. */
function intentFromPrompt(prompt: string): DemoIntent {
  const q = prompt.trim().toLowerCase();

  if (
    /late|متأخر|מאחר|איחור/.test(q) ||
    q.includes('late')
  ) {
    return 'late';
  }
  if (/stock|material|مخزون|مواد|מלאי|חומר/.test(q)) {
    return 'stock';
  }
  if (/compare|clarif|قارن|مقارن|השוו|השוואה/.test(q)) {
    return 'clarify';
  }
  if (/receivable|invoice|ذمم|فواتير|יתרות|חשבונ/.test(q)) {
    return 'invoice';
  }
  if (/oasis|profit|ربح|רווח|last 3|آخر ثل|3 הזמנות/.test(q)) {
    return 'profit';
  }
  if (/show those|entities|cards|بطاقات|כרטיס|اعرض تلك|הצג את/.test(q)) {
    return 'entities';
  }
  if (/permission|error|صلاح|הרשא/.test(q)) {
    return 'error';
  }
  return 'fallback';
}

function resolveIntent(prompt: string, actionId?: string): DemoIntent {
  if (actionId && INTENT_BY_ACTION[actionId]) {
    return INTENT_BY_ACTION[actionId]!;
  }
  return intentFromPrompt(prompt);
}

/** Welcome + showcase turn so aesthetics are reviewable before the API exists. */
export function buildDemoConversation(
  t: TranslateFn,
  now = new Date(),
): ChatMessage[] {
  const t0 = new Date(now.getTime() - 8 * 60_000).toISOString();
  const t1 = new Date(now.getTime() - 7 * 60_000).toISOString();
  const t2 = new Date(now.getTime() - 6 * 60_000).toISOString();
  const t3 = new Date(now.getTime() - 5 * 60_000).toISOString();

  return [
    {
      id: 'welcome',
      role: 'assistant',
      createdAt: t0,
      blocks: [{ type: 'text', markdown: d(t, 'welcome') }],
      suggestions: [
        { id: 'demo-profit', label: d(t, 'chipProfit') },
        { id: 'demo-late', label: d(t, 'chipLate') },
        { id: 'demo-stock', label: d(t, 'chipStock') },
        { id: 'demo-clarify', label: d(t, 'chipClarify') },
      ],
    },
    {
      id: 'user-demo-1',
      role: 'user',
      createdAt: t1,
      blocks: [{ type: 'text', markdown: d(t, 'userProfitAsk') }],
    },
    {
      id: 'assistant-demo-1',
      role: 'assistant',
      createdAt: t2,
      blocks: [
        { type: 'text', markdown: d(t, 'profitIntro') },
        {
          type: 'metrics',
          title: d(t, 'metricsOasisTitle'),
          items: [
            { label: d(t, 'metricTotalProfit'), value: '2,840 ILS', tone: 'brand' },
            { label: d(t, 'metricAvgOrder'), value: '947 ILS' },
            { label: d(t, 'metricOrders'), value: '3', hint: d(t, 'metricCompleted') },
          ],
        },
        {
          type: 'table',
          title: d(t, 'tableBreakdownTitle'),
          columns: [
            { key: 'order', label: d(t, 'colOrder') },
            { key: 'product', label: d(t, 'colProduct') },
            { key: 'profit', label: d(t, 'colProfit'), align: 'end' },
          ],
          rows: [
            { order: 'SO-1042', product: d(t, 'productSectional'), profit: '1,120 ILS' },
            { order: 'SO-1038', product: d(t, 'productDining'), profit: '980 ILS' },
            { order: 'SO-1029', product: d(t, 'productArmchair'), profit: '740 ILS' },
          ],
          caption: d(t, 'tableCaption'),
        },
        {
          type: 'chart',
          title: d(t, 'chartTitle'),
          unit: 'ILS',
          points: [
            { label: '1042', value: 1120, display: '1.1k' },
            { label: '1038', value: 980, display: '980' },
            { label: '1029', value: 740, display: '740' },
          ],
        },
        {
          type: 'sources',
          lines: [d(t, 'sourceOrders'), d(t, 'sourceDemo')],
        },
      ],
      suggestions: [
        { id: 'demo-entities', label: d(t, 'chipEntities') },
        { id: 'demo-stock', label: d(t, 'chipStock') },
      ],
    },
    {
      id: 'user-demo-2',
      role: 'user',
      createdAt: t3,
      blocks: [{ type: 'text', markdown: d(t, 'userShowCards') }],
    },
    {
      id: 'assistant-demo-2',
      role: 'assistant',
      createdAt: now.toISOString(),
      blocks: [
        {
          type: 'entities',
          title: d(t, 'entitiesTitle'),
          items: [
            {
              kind: 'order',
              title: 'SO-1042',
              subtitle: d(t, 'productSectionalSofa'),
              meta: 'Oasis Living',
              status: 'COMPLETED',
              amount: d(t, 'amountProfit', { amount: '1,120 ILS' }),
            },
            {
              kind: 'order',
              title: 'SO-1038',
              subtitle: d(t, 'productDiningChairs'),
              meta: 'Oasis Living',
              status: 'COMPLETED',
              amount: d(t, 'amountProfit', { amount: '980 ILS' }),
            },
            {
              kind: 'order',
              title: 'SO-1029',
              subtitle: d(t, 'productLounge'),
              meta: 'Oasis Living',
              status: 'COMPLETED',
              amount: d(t, 'amountProfit', { amount: '740 ILS' }),
            },
          ],
        },
      ],
      suggestions: [
        { id: 'demo-late', label: d(t, 'chipLate') },
        { id: 'demo-invoice', label: d(t, 'chipInvoice') },
      ],
    },
  ];
}

function replyForIntent(intent: DemoIntent, t: TranslateFn): ChatMessage {
  const createdAt = new Date().toISOString();

  switch (intent) {
    case 'late':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          { type: 'text', markdown: d(t, 'lateIntro') },
          {
            type: 'list',
            title: d(t, 'lateQueueTitle'),
            items: [
              {
                title: d(t, 'lateItemJerash'),
                subtitle: d(t, 'lateDue'),
                trailing: d(t, 'lateBadge'),
                tone: 'warning',
              },
              {
                title: d(t, 'lateItemNile'),
                subtitle: d(t, 'lateBlocked'),
                trailing: d(t, 'lateBadge'),
                tone: 'warning',
              },
            ],
          },
          {
            type: 'entities',
            items: [
              {
                kind: 'order',
                title: 'SO-1091',
                subtitle: d(t, 'productCornerSofa'),
                meta: 'Jerash Furnishings',
                status: 'IN_PRODUCTION',
                amount: d(t, 'lateAmount'),
              },
            ],
          },
        ],
        suggestions: [
          { id: 'demo-stock', label: d(t, 'chipStock') },
          { id: 'demo-profit', label: d(t, 'chipProfitAgain') },
        ],
      };

    case 'stock':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          { type: 'text', markdown: d(t, 'stockIntro') },
          {
            type: 'metrics',
            items: [
              { label: d(t, 'metricLowSkus'), value: '5', tone: 'warning' },
              { label: d(t, 'metricCritical'), value: '2', tone: 'warning' },
            ],
          },
          {
            type: 'list',
            title: d(t, 'materialsTitle'),
            items: [
              {
                title: d(t, 'matVelvet'),
                subtitle: d(t, 'matVelvetSub'),
                trailing: d(t, 'badgeLow'),
                tone: 'warning',
              },
              {
                title: d(t, 'matFoam'),
                subtitle: d(t, 'matFoamSub'),
                trailing: d(t, 'badgeCritical'),
                tone: 'warning',
              },
              {
                title: d(t, 'matOak'),
                subtitle: d(t, 'matOakSub'),
                trailing: d(t, 'badgeLow'),
                tone: 'warning',
              },
            ],
          },
        ],
        suggestions: [{ id: 'demo-late', label: d(t, 'chipLateShort') }],
      };

    case 'clarify':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          {
            type: 'clarification',
            question: d(t, 'clarifyQuestion'),
            options: [
              { id: 'pick-oasis-jerash', label: d(t, 'clarifyOasisJerash') },
              { id: 'pick-nile-zarqa', label: d(t, 'clarifyNileZarqa') },
            ],
          },
        ],
      };

    case 'invoice':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          { type: 'text', markdown: d(t, 'receivablesIntro') },
          {
            type: 'metrics',
            items: [
              { label: d(t, 'metricOutstanding'), value: '18,420 ILS', tone: 'warning' },
              { label: d(t, 'metricOverdue'), value: '4,100 ILS', tone: 'warning' },
            ],
          },
          {
            type: 'entities',
            title: d(t, 'invoicesTitle'),
            items: [
              {
                kind: 'invoice',
                title: 'INV-2201',
                subtitle: 'Dead Sea Spa Residences',
                status: 'ISSUED',
                amount: d(t, 'invoiceLeft', { amount: '6,200 ILS' }),
              },
              {
                kind: 'dealer',
                title: 'Oasis Living',
                subtitle: d(t, 'statementBalance'),
                amount: '3,450 ILS',
              },
            ],
          },
        ],
      };

    case 'profit':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          { type: 'text', markdown: d(t, 'profitShort') },
          {
            type: 'metrics',
            items: [
              { label: d(t, 'metricTotalProfit'), value: '2,840 ILS', tone: 'brand' },
              { label: d(t, 'metricOrders'), value: '3' },
            ],
          },
          {
            type: 'table',
            columns: [
              { key: 'order', label: d(t, 'colOrder') },
              { key: 'profit', label: d(t, 'colProfit'), align: 'end' },
            ],
            rows: [
              { order: 'SO-1042', profit: '1,120 ILS' },
              { order: 'SO-1038', profit: '980 ILS' },
              { order: 'SO-1029', profit: '740 ILS' },
            ],
          },
        ],
        suggestions: [{ id: 'demo-entities', label: d(t, 'chipShowCards') }],
      };

    case 'entities':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          {
            type: 'entities',
            items: [
              {
                kind: 'order',
                title: 'SO-1042',
                subtitle: d(t, 'productSectionalSofa'),
                meta: 'Oasis Living',
                status: 'COMPLETED',
                amount: d(t, 'amountProfit', { amount: '1,120 ILS' }),
              },
            ],
          },
        ],
      };

    case 'error':
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [
          {
            type: 'error',
            title: d(t, 'errorTitle'),
            body: d(t, 'errorBody'),
          },
        ],
      };

    default:
      return {
        id: id('a'),
        role: 'assistant',
        createdAt,
        blocks: [{ type: 'text', markdown: d(t, 'fallback') }],
        suggestions: [
          { id: 'demo-profit', label: d(t, 'chipProfitShort') },
          { id: 'demo-late', label: d(t, 'chipLateShort') },
          { id: 'demo-stock', label: d(t, 'chipStockShort') },
          { id: 'demo-clarify', label: d(t, 'chipClarifyShort') },
        ],
      };
  }
}

/** Map a demo chip / typed prompt to a full assistant reply (local only). */
export function demoReplyForPrompt(
  prompt: string,
  t: TranslateFn,
  actionId?: string,
): ChatMessage {
  return replyForIntent(resolveIntent(prompt, actionId), t);
}

export function promptForSuggestion(action: ChatAction, t: TranslateFn): string {
  switch (action.id) {
    case 'demo-profit':
      return d(t, 'promptProfit');
    case 'demo-late':
      return d(t, 'promptLate');
    case 'demo-stock':
      return d(t, 'promptStock');
    case 'demo-clarify':
      return d(t, 'promptClarify');
    case 'demo-entities':
      return d(t, 'promptEntities');
    case 'demo-invoice':
      return d(t, 'promptInvoice');
    case 'pick-oasis-jerash':
      return d(t, 'promptOasisJerash');
    case 'pick-nile-zarqa':
      return d(t, 'promptNileZarqa');
    default:
      return action.label;
  }
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
