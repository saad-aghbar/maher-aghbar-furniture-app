import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, FadeIn, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  /** Error = failed load. Empty = no rows (search or category). */
  tone?: 'error' | 'empty';
};

/**
 * Floor status board for the inventory hub — cream/wood, not debug chrome.
 * Compact so title + retry sit above the floating tab bar.
 */
export function InventoryHubStatus({
  title,
  description,
  retryLabel,
  onRetry,
  tone = 'empty',
}: Props) {
  const { isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isError = tone === 'error';
  const accent = isError ? colors.brandActive : colors.brand;
  const icon = isError ? 'cube-outline' : 'file-tray-outline';

  return (
    <FadeIn durationMs={theme.motion.duration.normal}>
      <View
        accessibilityRole={isError ? 'alert' : 'summary'}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: accent,
            opacity: 0.88,
            zIndex: 1,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
        <View
          style={{
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.sm,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 6 }
              : { paddingLeft: theme.spacing.lg + 6 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={icon} size={18} color={accent} />
            </View>
            <AppText
              variant="heading"
              weight={titleWeight}
              style={{
                flex: 1,
                minWidth: 0,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {title}
            </AppText>
          </View>
          {description ? (
            <AppText
              variant="bodySecondary"
              color="secondary"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {description}
            </AppText>
          ) : null}
          {onRetry && retryLabel ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
              onPress={() => {
                void haptics.selection();
                onRetry();
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.sm,
                marginTop: theme.spacing.xs,
                borderRadius: theme.radius.xl,
                backgroundColor: colors.brand,
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.elevation.rest,
              }}
            >
              <AppText
                variant="label"
                weight={titleWeight}
                style={{ color: colors.onBrand }}
              >
                {retryLabel}
              </AppText>
            </AnimatedPressable>
          ) : null}
        </View>
      </View>
    </FadeIn>
  );
}
