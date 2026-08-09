import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import {
  createAiChatConversation,
  sendAiChatMessage,
} from '@/api/modules/ai-chat';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';
import {
  CHAT_COMPOSER_HEIGHT,
  CHAT_COMPOSER_TAB_GAP,
  SURFACE_TAB_BAR_CLEARANCE,
} from '@/navigation/tabBarClearance';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { thinkingMessage, userTextMessage } from './demoConversation';
import { ChatComposer } from './components/ChatComposer';
import { ChatMessageBubble } from './components/ChatMessageBubble';
import type { ChatAction, ChatMessage } from './types';

type Props = {
  /** Fallback path when pressing back. */
  backFallback: Href;
};

function ChatScreenTitle({
  titleWeight,
  backFallback,
}: {
  titleWeight: 'medium' | 'semibold';
  backFallback: Href;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const onBack = useSmartBack(backFallback);
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <BackButton onPress={onBack} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.aiChat.title')}
      </AppText>
    </View>
  );
}

/**
 * Live system chatbot — conversations + tool-backed answers from the API.
 */
export function AiChatbotScreen({ backFallback }: Props) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'ai-chat.read');

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  // Fresh conversation when locale changes (avoid mixed-language history).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setBootError(null);
      setMessages([]);
      setConversationId(null);
      try {
        const conv = await createAiChatConversation({ locale });
        if (cancelled) return;
        setConversationId(conv.id);
        const isDealer = Boolean(user?.customerId);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            createdAt: new Date().toISOString(),
            blocks: [{ type: 'text', markdown: t('mobile.aiChat.demo.welcome') }],
            suggestions: isDealer
              ? [
                  { id: 'chip-orders', label: t('mobile.aiChat.demo.chipEntities') },
                  { id: 'chip-invoice', label: t('mobile.aiChat.demo.chipInvoice') },
                ]
              : [
                  { id: 'chip-profit', label: t('mobile.aiChat.demo.chipProfit') },
                  { id: 'chip-late', label: t('mobile.aiChat.demo.chipLate') },
                  { id: 'chip-stock', label: t('mobile.aiChat.demo.chipStock') },
                ],
          },
        ]);
      } catch {
        if (!cancelled) {
          setBootError(t('mobile.aiChat.errorStart'));
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, t, user?.customerId]);

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
        const result = await sendAiChatMessage(conversationId, {
          text: trimmed,
          clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          locale,
        });
        setMessages((prev) => {
          const withoutThinking = prev.filter((m) => m.id !== thinking.id);
          // Replace optimistic user if server returned one with different id
          const withoutOptimisticUser = withoutThinking.filter((m) => m.id !== userMsg.id);
          return [...withoutOptimisticUser, result.userMessage, result.assistantMessage];
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
              blocks: [
                {
                  type: 'error',
                  title: t('mobile.aiChat.errorTitle'),
                  body: t('mobile.aiChat.errorBody'),
                },
              ],
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
      if (action.href) {
        router.push(action.href as Href);
        return;
      }
      void runTurn(action.label);
    },
    [router, runTurn],
  );

  if (!allowed) {
    return (
      <AppScreen>
        <ChatScreenTitle titleWeight={titleWeight} backFallback={backFallback} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const listBottomPad =
    SURFACE_TAB_BAR_CLEARANCE + CHAT_COMPOSER_HEIGHT + CHAT_COMPOSER_TAB_GAP + theme.spacing.lg;

  return (
    <AppScreen
      padding="none"
      style={{ paddingBottom: 0, gap: 0 }}
      edges={{ top: true, bottom: false }}
    >
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
        <ChatScreenTitle titleWeight={titleWeight} backFallback={backFallback} />
      </View>

      {bootError ? (
        <View style={{ padding: theme.spacing.lg }}>
          <EmptyState title={t('mobile.aiChat.errorTitle')} description={bootError} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: listBottomPad,
            flexGrow: 1,
          }}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            booting ? (
              <AppText variant="caption" color="muted" align="center">
                {t('mobile.aiChat.thinking')}
              </AppText>
            ) : null
          }
          renderItem={({ item }) => (
            <ChatMessageBubble message={item} onAction={onSuggestion} />
          )}
        />
      )}

      <ChatComposer
        value={draft}
        onChangeText={setDraft}
        onSend={() => void runTurn(draft)}
        disabled={busy || !conversationId || Boolean(bootError)}
      />
    </AppScreen>
  );
}
