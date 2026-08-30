import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, FadeIn, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'error' | 'empty';
};

/**
 * Shared floor status board — cream/wood, human copy, retry clears the tab bar.
 */
export function FloorStatus({
  title,
  description,
  actionLabel,
  onAction,
  tone = 'empty',
}: Props) {
  const { isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isError = tone === 'error';
  const accent = isError ? colors.brandActive : colors.brand;
  const icon = isError ? 'cube-outline' : 'file-tray-outline';

  return (
    <FadeIn
      durationMs={theme.motion.duration.normal}
      style={{ flexGrow: 1 }}
    >
      <View
        accessibilityRole={isError ? 'alert' : 'summary'}
        style={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.lg + SURFACE_TAB_BAR_CLEARANCE + insets.bottom,
        }}
      >
        <View
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
            {onAction && actionLabel ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                onPress={() => {
                  void haptics.selection();
                  onAction();
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
                  {actionLabel}
                </AppText>
              </AnimatedPressable>
            ) : null}
          </View>
        </View>
      </View>
    </FadeIn>
  );
}
