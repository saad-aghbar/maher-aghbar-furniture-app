import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { PURCHASING_CHROME_CONTROL_H } from './PurchasingFilterTriggers';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** LTR bin/shelf line under the warehouse name so RTL does not mix the two. */
  caption?: string | null;
  active?: boolean;
  warning?: boolean;
  success?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function ReceiveFloorTrigger({
  icon,
  label,
  caption,
  active,
  warning,
  success,
  loading,
  disabled,
  onPress,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const selected = Boolean(active || success);
  const border = warning ? colors.warning : success ? colors.success : selected ? colors.brand : colors.borderStrong;
  const fill = warning ? colors.warningSoft : success ? colors.successSoft : selected ? colors.brandSoft : colors.surfaceSecondary;
  const ink = warning ? colors.warning : success ? colors.success : selected ? colors.brand : colors.textPrimary;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, busy: Boolean(loading), disabled: Boolean(disabled) }}
      disabled={Boolean(loading || disabled)}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        opacity: disabled ? 0.55 : 1,
        minHeight: PURCHASING_CHROME_CONTROL_H,
        borderRadius: theme.radius.xl,
        borderWidth: 1.5,
        borderColor: border,
        backgroundColor: fill,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
        ...(isRTL
          ? { paddingRight: selected || warning ? theme.spacing.md + 4 : theme.spacing.md }
          : { paddingLeft: selected || warning ? theme.spacing.md + 4 : theme.spacing.md }),
        ...orderBoardShadow(colorScheme),
      }}
    >
      {selected || warning ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 2,
            backgroundColor: border,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: selected || warning ? border : colors.border,
        }}
      >
        <Ionicons name={icon} size={15} color={ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={2}
          style={{
            fontSize: 13,
            lineHeight: 16,
            color: ink,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </AppText>
        {caption?.trim() ? (
          <AppText
            variant="caption"
            color="muted"
            dir="ltr"
            numberOfLines={1}
            style={{
              fontSize: 12,
              lineHeight: 15,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {caption.trim()}
          </AppText>
        ) : null}
      </View>
      <Ionicons
        name={success ? 'checkmark' : isRTL ? 'chevron-back' : 'chevron-forward'}
        size={16}
        color={ink}
      />
    </AnimatedPressable>
  );
}
