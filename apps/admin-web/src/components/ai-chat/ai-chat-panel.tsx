'use client';

import { apiFetch } from '@/lib/api-client';
import {
  remapChatHref,
  thinkingMessage,
  userTextMessage,
  type AiChatConversation,
  type AiChatSurface,
  type ChatAction,
  type ChatContent,
  type ChatMessage,
  type SendMessageResult,
} from '@/lib/ai-chat';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  MetricCard,
  Skeleton,
  StatusBadge,
  cn,
} from '@maher/ui';
import { Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  surface: AiChatSurface;
  onNavigate: (href: string) => void;
};

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function BlockView({
  block,
  surface,
  onNavigate,
  thinkingLabel,
}: {
  block: ChatContent;
  surface: AiChatSurface;
  onNavigate: (href: string) => void;
  thinkingLabel: string;
}) {
  if (block.type === 'thinking') {
    return <p className="animate-pulse text-sm text-text-secondary">{thinkingLabel}</p>;
  }
  if (block.type === 'text') {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
        {renderMarkdown(block.markdown)}
      </p>
    );
  }
  if (block.type === 'error') {
    return (
      <div className="rounded-lg border border-[var(--maher-error-border,var(--maher-border))] bg-[var(--maher-error-soft)] p-3">
        <p className="text-sm font-semibold text-[var(--maher-error)]">{block.title}</p>
        <p className="mt-1 text-sm text-text-secondary">{block.body}</p>
      </div>
    );
  }
  if (block.type === 'metrics') {
    return (
      <div className="space-y-2">
        {block.title ? <p className="text-xs font-semibold uppercase text-text-tertiary">{block.title}</p> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          {block.items.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              hint={item.hint}
              tone={item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : item.tone === 'brand' ? 'brand' : 'neutral'}
            />
          ))}
        </div>
      </div>
    );
  }
  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        {block.title ? <p className="border-b border-border px-3 py-2 text-sm font-semibold">{block.title}</p> : null}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-muted text-start text-xs text-text-tertiary">
              {block.columns.map((col) => (
                <th key={col.key} className={cn('px-3 py-2 font-medium', col.align === 'end' && 'text-end')}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {block.columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2', col.align === 'end' && 'text-end')} dir={col.align === 'end' ? 'ltr' : undefined}>
                    {row[col.key] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.caption ? <p className="px-3 py-2 text-xs text-text-tertiary">{block.caption}</p> : null}
      </div>
    );
  }
  if (block.type === 'entities') {
    return (
      <div className="space-y-2">
        {block.title ? <p className="text-xs font-semibold uppercase text-text-tertiary">{block.title}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {block.items.map((item, i) => {
            const href = remapChatHref(item.href, surface);
            const inner = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-text-primary">{item.title}</p>
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                {item.subtitle ? <p className="mt-1 text-xs text-text-secondary">{item.subtitle}</p> : null}
                {item.meta ? <p className="mt-1 text-xs text-text-tertiary">{item.meta}</p> : null}
                {item.amount ? (
                  <p className="mt-1 text-sm font-medium" dir="ltr">
                    {item.amount}
                  </p>
                ) : null}
              </>
            );
            if (!href) {
              return (
                <div key={`${item.title}-${i}`} className="rounded-xl border border-border p-3">
                  {inner}
                </div>
              );
            }
            return (
              <button
                key={`${item.title}-${i}`}
                type="button"
                onClick={() => onNavigate(href)}
                className="rounded-xl border border-border p-3 text-start hover:border-brand/40"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (block.type === 'list') {
    return (
      <ul className="space-y-2">
        {block.title ? <p className="text-xs font-semibold uppercase text-text-tertiary">{block.title}</p> : null}
        {block.items.map((item, i) => (
          <li key={`${item.title}-${i}`} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              {item.subtitle ? <p className="text-xs text-text-secondary">{item.subtitle}</p> : null}
            </div>
            {item.trailing ? (
              <span className="text-xs text-text-tertiary" dir="ltr">
                {item.trailing}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'chart') {
    const max = Math.max(1, ...block.points.map((p) => p.value));
    return (
      <div className="space-y-2">
        {block.title ? <p className="text-xs font-semibold uppercase text-text-tertiary">{block.title}</p> : null}
        <div className="flex h-32 items-end gap-2">
          {block.points.map((p) => (
            <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-brand"
                style={{ height: `${Math.max(8, (p.value / max) * 100)}%` }}
                title={p.display ?? String(p.value)}
              />
              <span className="truncate text-[10px] text-text-tertiary">{p.label}</span>
            </div>
          ))}
        </div>
        {block.caption ? <p className="text-xs text-text-tertiary">{block.caption}</p> : null}
      </div>
    );
  }
  if (block.type === 'clarification') {
    return <p className="text-sm text-text-primary">{block.question}</p>;
  }
  if (block.type === 'sources') {
    return (
      <ul className="list-disc ps-4 text-xs text-text-tertiary">
        {block.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }
  return null;
}

export function AiChatPanel({ surface, onNavigate }: Props) {
  const locale = useLocale();
  const t = useTranslations('mobile');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setBootError(null);
      setMessages([]);
      setConversationId(null);
      try {
        const conv = await apiFetch<AiChatConversation>('/api/v1/ai-chat/conversations', {
          method: 'POST',
          body: JSON.stringify({ locale }),
        });
        if (cancelled) return;
        setConversationId(conv.id);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            createdAt: new Date().toISOString(),
            blocks: [{ type: 'text', markdown: t('aiChat.demo.welcome') }],
            suggestions:
              surface === 'dealer'
                ? [
                    { id: 'chip-orders', label: t('aiChat.demo.chipEntities') },
                    { id: 'chip-invoice', label: t('aiChat.demo.chipInvoice') },
                  ]
                : [
                    { id: 'chip-profit', label: t('aiChat.demo.chipProfit') },
                    { id: 'chip-late', label: t('aiChat.demo.chipLate') },
                    { id: 'chip-stock', label: t('aiChat.demo.chipStock') },
                  ],
          },
        ]);
      } catch {
        if (!cancelled) setBootError(t('aiChat.errorStart'));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, surface, t]);

  const runTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !conversationId) return;
      setBusy(true);
      setDraft('');
      const userMsg = userTextMessage(trimmed);
      const thinking = thinkingMessage();
      setMessages((prev) => [...prev, userMsg, thinking]);
      scrollToEnd();
      try {
        const result = await apiFetch<SendMessageResult>(
          `/api/v1/ai-chat/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              text: trimmed,
              clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              locale,
            }),
            signal: AbortSignal.timeout(90_000),
          },
        );
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== thinking.id && m.id !== userMsg.id);
          return [...without, result.userMessage, result.assistantMessage];
        });
      } catch {
        setMessages((prev) => {
          const withoutThinking = prev.filter((m) => m.id !== thinking.id);
          return [
            ...withoutThinking,
            {
              id: `err-${Date.now()}`,
              role: 'assistant',
              createdAt: new Date().toISOString(),
              blocks: [{ type: 'error', title: t('aiChat.errorTitle'), body: t('aiChat.errorBody') }],
            },
          ];
        });
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [busy, conversationId, locale, scrollToEnd, t],
  );

  const onSuggestion = useCallback(
    (action: ChatAction) => {
      const href = remapChatHref(action.href, surface);
      if (href) {
        onNavigate(href);
        return;
      }
      void runTurn(action.label);
    },
    [onNavigate, runTurn, surface],
  );

  if (booting) {
    return (
      <Card title={t('aiChat.title')}>
        <Skeleton className="h-64 rounded-lg" />
      </Card>
    );
  }

  if (bootError) {
    return (
      <ErrorState
        title={t('aiChat.errorTitle')}
        description={bootError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <Card title={t('aiChat.title')} description={t('aiChat.assistantName')} className="flex min-h-[32rem] flex-col">
      <div ref={scrollerRef} className="flex max-h-[32rem] min-h-[20rem] flex-1 flex-col gap-4 overflow-y-auto pe-1">
        {messages.length === 0 ? (
          <EmptyState title={t('aiChat.title')} />
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-[92%] space-y-2 rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'ms-auto bg-brand text-white'
                  : 'bg-surface-muted text-text-primary',
              )}
            >
              {msg.blocks.map((block, i) => (
                <div key={i} className={msg.role === 'user' && block.type === 'text' ? 'text-white' : undefined}>
                  <BlockView
                    block={block}
                    surface={surface}
                    onNavigate={onNavigate}
                    thinkingLabel={t('aiChat.thinking')}
                  />
                </div>
              ))}
              {msg.suggestions?.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {msg.suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onSuggestion(s)}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary hover:border-brand hover:text-brand"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void runTurn(draft);
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('aiChat.placeholder')}
            disabled={busy || !conversationId}
          />
        </div>
        <Button type="submit" disabled={busy || !draft.trim()} leadingIcon={<Send className="h-4 w-4" />}>
          {t('aiChat.send')}
        </Button>
      </form>
    </Card>
  );
}
