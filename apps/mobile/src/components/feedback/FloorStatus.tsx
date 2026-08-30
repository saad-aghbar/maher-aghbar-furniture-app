import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, FadeIn, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

type Props = {
  /** Page landmark (Gendy) — sits above the error line when set. */
  landmark?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'error' | 'empty';
};

/**
 * Shared floor status — Liquorice line, Army Camo pill, clears the tab bar.
 */
export function FloorStatus({
  landmark,
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

  return (
    <FadeIn durationMs={theme.motion.duration.normal} style={{ flexGrow: 1 }}>
      <View
        accessibilityRole={isError ? 'alert' : 'summary'}
        style={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing['2xl'] + SURFACE_TAB_BAR_CLEARANCE + insets.bottom,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
          gap: theme.spacing.md,
        }}
      >
        {landmark ? (
          <AppText
            variant="title"
            weight={titleWeight}
            style={{
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {landmark}
          </AppText>
        ) : null}
        <AppText
          variant="heading"
          weight={titleWeight}
          style={{
            color: colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
        {description ? (
          <AppText
            variant="bodySecondary"
            style={{
              color: isError ? colors.brand : colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
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
              borderRadius: theme.radius.full,
              backgroundColor: colors.brand,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              justifyContent: 'center',
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
    </FadeIn>
  );
}
