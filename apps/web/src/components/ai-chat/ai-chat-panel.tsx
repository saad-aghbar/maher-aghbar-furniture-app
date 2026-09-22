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
import { Board, BoardSkeleton, Button, ErrorBoard, Figure, Ledger, LedgerRow, Ltr, Meter, Stamp, cn } from '@maher/ui';
import { Send, Sparkles } from 'lucide-react';
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

function statusTone(status: string): 'success' | 'warning' | 'error' | 'brand' | 'neutral' {
  const key = status.toUpperCase();
  if (/(DELIVERED|PAID|COMPLETED|APPROVED|READY|ACTIVE)/.test(key)) return 'success';
  if (/(OVERDUE|REJECTED|CANCEL|FAIL|LATE)/.test(key)) return 'error';
  if (/(PENDING|WAITING|NEED|DRAFT|PARTIAL)/.test(key)) return 'warning';
  if (/(PRODUCTION|PROGRESS|SHIPPED|SENT)/.test(key)) return 'brand';
  return 'neutral';
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
    return (
      <p className="flex items-center gap-2 text-[13px] text-[var(--maher-text-secondary)]">
        <span className="maher-thinking-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        {thinkingLabel}
      </p>
    );
  }
  if (block.type === 'text') {
    return (
      <p className="whitespace-pre-wrap text-[14px] leading-6">
        {renderMarkdown(block.markdown)}
      </p>
    );
  }
  if (block.type === 'error') {
    return (
      <div className="rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-error-soft)] p-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--maher-error)]">
          <Stamp tone="error" size="sm">!</Stamp>
          {block.title}
        </p>
        <p className="mt-1 text-[13px] text-[var(--maher-text-secondary)]">{block.body}</p>
      </div>
    );
  }
  if (block.type === 'metrics') {
    return (
      <div className="space-y-2">
        {block.title ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{block.title}</p> : null}
        <div className="grid gap-3 rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-3 sm:grid-cols-3">
          {block.items.map((item) => (
            <Figure
              key={item.label}
              size="sm"
              label={item.label}
              value={item.value}
              delta={item.hint}
              tone={item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : item.tone === 'brand' ? 'brand' : 'neutral'}
            />
          ))}
        </div>
      </div>
    );
  }
  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)]">
        {block.title ? <p className="border-b border-[var(--maher-border)] px-3 py-2 text-[13px] font-semibold">{block.title}</p> : null}
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[var(--maher-surface-muted)] text-start text-[11px] uppercase tracking-[0.06em] text-[var(--maher-text-tertiary)]">
              {block.columns.map((col) => (
                <th key={col.key} className={cn('px-3 py-2 font-medium', col.align === 'end' && 'text-end')}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--maher-border)]">
                {block.columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2', col.align === 'end' && 'text-end')} dir={col.align === 'end' ? 'ltr' : undefined}>
                    {row[col.key] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.caption ? <p className="px-3 py-2 text-[12px] text-[var(--maher-text-tertiary)]">{block.caption}</p> : null}
      </div>
    );
  }
  if (block.type === 'entities') {
    return (
      <div className="space-y-2">
        {block.title ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{block.title}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {block.items.map((item, i) => {
            const href = remapChatHref(item.href, surface);
            const inner = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[var(--maher-text-primary)]">{item.title}</p>
                  {item.status ? <Stamp tone={statusTone(item.status)} size="sm">{item.status.replaceAll('_', ' ').toLowerCase()}</Stamp> : null}
                </div>
                {item.subtitle ? <p className="mt-1 text-[12px] text-[var(--maher-text-secondary)]">{item.subtitle}</p> : null}
                {item.meta ? <p className="mt-1 text-[12px] text-[var(--maher-text-tertiary)]">{item.meta}</p> : null}
                {item.amount ? <Ltr className="mt-1 block text-[14px] font-semibold">{item.amount}</Ltr> : null}
              </>
            );
            const shell = 'rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-3 text-start';
            if (!href) {
              return (
                <div key={`${item.title}-${i}`} className={shell}>
                  {inner}
                </div>
              );
            }
            return (
              <button key={`${item.title}-${i}`} type="button" onClick={() => onNavigate(href)} className={cn(shell, 'transition hover:border-[var(--maher-brand)] hover:shadow-[var(--maher-shadow-board)]')}>
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
      <div className="space-y-2">
        {block.title ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{block.title}</p> : null}
        <Ledger className="rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3">
          {block.items.map((item, i) => (
            <LedgerRow key={`${item.title}-${i}`} label={item.title} hint={item.subtitle} value={item.trailing ? <Ltr>{item.trailing}</Ltr> : ''} />
          ))}
        </Ledger>
      </div>
    );
  }
  if (block.type === 'chart') {
    const max = Math.max(1, ...block.points.map((p) => p.value));
    return (
      <div className="space-y-2">
        {block.title ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{block.title}</p> : null}
        <div className="space-y-2 rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-3">
          {block.points.map((p) => (
            <Meter key={p.label} value={p.value} max={max} label={p.label} valueLabel={p.display ?? String(p.value)} tone="brand" />
          ))}
        </div>
        {block.caption ? <p className="text-[12px] text-[var(--maher-text-tertiary)]">{block.caption}</p> : null}
      </div>
    );
  }
  if (block.type === 'clarification') {
    return <p className="text-[14px] leading-6">{block.question}</p>;
  }
  if (block.type === 'sources') {
    return (
      <ul className="list-disc ps-4 text-[12px] text-[var(--maher-text-tertiary)]">
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
    return <BoardSkeleton rows={6} />;
  }

  if (bootError) {
    return <ErrorBoard title={t('aiChat.errorTitle')} description={bootError} onRetry={() => window.location.reload()} />;
  }

  return (
    <Board tone="brand" wash="top" className="flex min-h-[34rem] flex-col">
      <Board.Header
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--maher-brand)]" />
            {t('aiChat.title')}
          </span>
        }
        description={t('aiChat.assistantName')}
        meta={<Stamp tone={busy ? 'warning' : 'success'} size="sm">{busy ? t('aiChat.thinking') : t('aiChat.assistantName')}</Stamp>}
      />
      <div ref={scrollerRef} className="flex max-h-[34rem] min-h-[22rem] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <Board.Empty title={t('aiChat.title')} />
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'maher-chat-bubble max-w-[92%] space-y-2 rounded-[18px] px-4 py-3 text-[14px] leading-6',
                msg.role === 'user'
                  ? 'ms-auto rounded-ee-[6px] bg-[var(--maher-text-primary)] text-[var(--maher-surface)]'
                  : 'rounded-es-[6px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-primary)]',
              )}
            >
              {msg.blocks.map((block, i) => (
                <div key={i}>
                  <BlockView block={block} surface={surface} onNavigate={onNavigate} thinkingLabel={t('aiChat.thinking')} />
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
                      className="rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--maher-text-secondary)] transition hover:border-[var(--maher-brand)] hover:text-[var(--maher-brand)] disabled:opacity-60"
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
        className="flex items-center gap-2 border-t border-[var(--maher-border)] bg-[var(--maher-surface)] px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void runTurn(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('aiChat.placeholder')}
          disabled={busy || !conversationId}
          className="h-11 min-w-0 flex-1 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 text-[14px] text-[var(--maher-text-primary)] outline-none transition placeholder:text-[var(--maher-text-tertiary)] focus:border-[var(--maher-brand)] focus:bg-[var(--maher-surface)] focus:shadow-[0_0_0_4px_var(--maher-brand-soft)]"
        />
        <Button type="submit" className="h-11 rounded-full px-4" disabled={busy || !draft.trim()} leadingIcon={<Send className="h-4 w-4 rtl:-scale-x-100" />} aria-label={t('aiChat.send')}>
          <span className="hidden sm:inline">{t('aiChat.send')}</span>
        </Button>
      </form>
    </Board>
  );
}
