import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { attentionChrome, useTheme } from '@/theme';

type Props = {
  eyebrow: string;
  title: string;
  actionLabel?: string;
  onPress?: () => void;
};

/**
 * Dark charcoal ATTENTION card with gold-tan IDs.
 * The action is a filled chocolate pill + cream type so it stays tappable on charcoal.
 */
export function AttentionCard({ eyebrow, title, actionLabel, onPress }: Props) {
  const { isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const chrome = attentionChrome(colors, colorScheme);

  const body = (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="caption"
        weight="semibold"
        style={{
          color: chrome.accent,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {eyebrow}
      </AppText>
      <AppText
        variant="body"
        weight="medium"
        style={{
          color: chrome.on,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {title}
      </AppText>
      {actionLabel ? (
        <View
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: theme.spacing.xs,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: chrome.actionFill,
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: chrome.on }}>
            {actionLabel}
          </AppText>
          <Ionicons
            name={isRTL ? 'arrow-back' : 'arrow-forward'}
            size={14}
            color={chrome.on}
          />
        </View>
      ) : null}
    </View>
  );

  const cardStyle = {
    borderRadius: theme.radius.card,
    backgroundColor: chrome.surface,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: chrome.border,
    ...theme.elevation.raised,
  };

  if (onPress) {
    return (
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={
          actionLabel ? `${eyebrow}. ${title}. ${actionLabel}` : `${eyebrow}. ${title}`
        }
        onPress={() => {
          void haptics.confirmLight();
          onPress();
        }}
        style={cardStyle}
      >
        {body}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyle}>{body}</View>;
}
