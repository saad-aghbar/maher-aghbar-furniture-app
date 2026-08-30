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
 * Dark charcoal ATTENTION card with gold-tan labels (image 4).
 */
export function AttentionCard({ eyebrow, title, actionLabel, onPress }: Props) {
  const { isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const chrome = attentionChrome(colors);

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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: theme.spacing.xs,
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: chrome.accent }}>
            {actionLabel}
          </AppText>
          <Ionicons
            name={isRTL ? 'arrow-back' : 'arrow-forward'}
            size={16}
            color={chrome.accent}
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
        accessibilityLabel={`${eyebrow}. ${title}`}
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
