import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPress: () => void;
  openCount?: number;
};

/**
 * Hub jump into the factory inbox — 48px floor trigger, sibling of the dealer bar.
 */
export function ProductionProblemsBar({ onPress, openCount = 0 }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const waiting = openCount > 0;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const label = t('mobile.tasks.problemsTitle');
  const a11y =
    waiting ? `${label}. ${t('mobile.tasks.problemsOpenCount', { count: openCount })}` : label;

  return (
    <View
      style={{
        height: 48,
        borderRadius: theme.radius.xl,
        backgroundColor: waiting ? colors.errorSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: waiting ? colors.error : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {waiting ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.error,
            opacity: 0.85,
          }}
        />
      ) : null}

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ selected: waiting }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          height: 48,
          paddingHorizontal: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: waiting ? theme.spacing.md + 4 : theme.spacing.md }
            : { paddingLeft: waiting ? theme.spacing.md + 4 : theme.spacing.md }),
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: waiting ? colors.error : colors.border,
          }}
        >
          <Ionicons
            name="warning-outline"
            size={15}
            color={waiting ? colors.error : colors.textSecondary}
          />
        </View>

        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            lineHeight: 16,
            color: waiting ? colors.error : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </AppText>

        {waiting ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              paddingHorizontal: 6,
              borderRadius: 11,
              backgroundColor: colors.error,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              dir="ltr"
              style={{ color: colors.onBrand, fontSize: 11, lineHeight: 14 }}
            >
              {String(openCount)}
            </AppText>
          </View>
        ) : null}

        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={waiting ? colors.error : colors.textMuted}
        />
      </AnimatedPressable>
    </View>
  );
}
