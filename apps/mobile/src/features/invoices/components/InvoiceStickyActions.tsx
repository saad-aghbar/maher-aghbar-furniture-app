import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onPdf: () => void;
  onPay?: () => void;
  onApplyCredit?: () => void;
  pdfLabel: string;
  payLabel?: string;
  applyCreditLabel?: string;
};

/** Floating action pill — PDF + optional Apply credit + Record payment. */
export function InvoiceStickyActions({
  onPdf,
  onPay,
  onApplyCredit,
  pdfLabel,
  payLabel,
  applyCreditLabel,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const showPay = Boolean(onPay && payLabel);
  const showCredit = Boolean(onApplyCredit && applyCreditLabel);
  const actionCount = 1 + (showCredit ? 1 : 0) + (showPay ? 1 : 0);
  const compact = actionCount >= 3;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor:
          colorScheme === 'dark' ? 'rgba(42,36,37,0.96)' : 'rgba(255,255,255,0.96)',
        padding: 6,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <ActionChip
        label={pdfLabel}
        icon="download-outline"
        onPress={onPdf}
        variant={showPay || showCredit ? 'secondary' : 'primary'}
        compact={compact}
        titleWeight={titleWeight}
      />

      {showCredit ? (
        <ActionChip
          label={applyCreditLabel!}
          icon="wallet-outline"
          onPress={() => onApplyCredit?.()}
          variant={showPay ? 'secondary' : 'primary'}
          compact={compact}
          titleWeight={titleWeight}
        />
      ) : null}

      {showPay ? (
        <ActionChip
          label={payLabel!}
          icon="card-outline"
          onPress={() => onPay?.()}
          variant="brand"
          compact={compact}
          titleWeight={titleWeight}
        />
      ) : null}
    </View>
  );
}

function ActionChip({
  label,
  icon,
  onPress,
  variant,
  compact,
  titleWeight,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant: 'primary' | 'secondary' | 'brand';
  compact: boolean;
  titleWeight: 'medium' | 'semibold';
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  const bg =
    variant === 'brand'
      ? colors.brand
      : variant === 'primary'
        ? colors.brandSoft
        : colors.surfaceSecondary;
  const textColor = variant === 'brand' ? colors.onBrand : colors.brand;
  const border =
    variant === 'primary'
      ? { borderWidth: 1, borderColor: colors.brand }
      : { borderWidth: 0, borderColor: 'transparent' };

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: 1,
        minHeight: 40,
        borderRadius: 20,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 4 : theme.spacing.sm,
        paddingHorizontal: compact ? theme.spacing.sm : theme.spacing.md,
        backgroundColor: bg,
        ...border,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            variant === 'brand' ? 'rgba(245,241,234,0.18)' : colors.surface,
          borderWidth: variant === 'brand' ? 0 : 1,
          borderColor: colors.brand,
        }}
      >
        <Ionicons
          name={icon}
          size={15}
          color={variant === 'brand' ? colors.onBrand : colors.brand}
        />
      </View>
      <AppText
        variant="caption"
        weight={titleWeight}
        numberOfLines={1}
        style={{ color: textColor, fontSize: compact ? 11 : 13, lineHeight: 16 }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
