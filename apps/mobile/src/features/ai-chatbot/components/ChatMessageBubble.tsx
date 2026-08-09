import { I18nManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ChatAction, ChatMessage } from '../types';
import { AssistantContentBlock, SuggestionChips } from './responseBoards';

type Props = {
  message: ChatMessage;
  onAction?: (action: ChatAction) => void;
};

/**
 * One chat turn — user pill or assistant stack of response boards.
 * Boards stay full-width; only placement of the user pill is edge-pinned.
 */
export function ChatMessageBubble({ message, onAction }: Props) {
  const { t, isRTL, locale, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isUser = message.role === 'user';
  const textAlign = isRTL ? 'right' : 'left';
  // Physical right for the user bubble whether or not the native root is RTL.
  const userEdge = I18nManager.isRTL ? 'flex-start' : 'flex-end';

  if (isUser) {
    const text =
      message.blocks.find((b) => b.type === 'text' && 'markdown' in b)?.markdown ?? '';
    return (
      <View
        style={{
          width: '100%',
          alignItems: userEdge,
          paddingHorizontal: theme.spacing.xs,
        }}
      >
        <View
          style={{
            maxWidth: '88%',
            borderRadius: theme.radius.xl,
            borderBottomRightRadius: theme.spacing.xs,
            borderBottomLeftRadius: theme.radius.xl,
            backgroundColor: colors.brand,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
          }}
        >
          <AppText
            variant="body"
            style={{
              color: colors.onBrand,
              textAlign,
              fontSize: 15,
              lineHeight: 21,
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {text}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: '100%',
        gap: theme.spacing.sm,
        // stretch so metric/table/chart boards use the full column width
        alignItems: 'stretch',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="chatbubbles-outline" size={14} color={colors.brand} />
        </View>
        <AppText variant="caption" weight={titleWeight} style={{ color: colors.brand }}>
          {t('mobile.aiChat.assistantName')}
        </AppText>
        <AppText variant="caption" color="muted" style={{ fontSize: 10 }} dir="ltr">
          {formatDateTime(message.createdAt)}
        </AppText>
      </View>

      {message.blocks.map((block, i) => (
        <AssistantContentBlock
          key={`${message.id}-${i}`}
          block={block}
          onAction={onAction}
        />
      ))}
      {message.suggestions?.length && onAction ? (
        <SuggestionChips actions={message.suggestions} onPress={onAction} />
      ) : null}
    </View>
  );
}
