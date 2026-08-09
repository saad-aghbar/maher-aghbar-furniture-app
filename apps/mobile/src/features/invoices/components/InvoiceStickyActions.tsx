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
  pdfLabel: string;
  payLabel?: string;
};

/** Floating action pill — tab-bar language, icon chip + label, compact height. */
export function InvoiceStickyActions({ onPdf, onPay, pdfLabel, payLabel }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const showPay = Boolean(onPay && payLabel);

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
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={pdfLabel}
        onPress={() => {
          void haptics.selection();
          onPdf();
        }}
        style={{
          flex: 1,
          minHeight: 40,
          borderRadius: 20,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: showPay ? colors.surfaceSecondary : colors.brandSoft,
          borderWidth: showPay ? 0 : 1,
          borderColor: colors.brand,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: showPay ? colors.surface : colors.surface,
            borderWidth: 1,
            borderColor: colors.brand,
          }}
        >
          <Ionicons name="download-outline" size={15} color={colors.brand} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{ color: colors.brand, fontSize: 13, lineHeight: 16 }}
        >
          {pdfLabel}
        </AppText>
      </AnimatedPressable>

      {showPay ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={payLabel}
          onPress={() => {
            void haptics.selection();
            onPay?.();
          }}
          style={{
            flex: 1,
            minHeight: 40,
            borderRadius: 20,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            backgroundColor: colors.brand,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(245,241,234,0.18)',
            }}
          >
            <Ionicons name="card-outline" size={15} color={colors.onBrand} />
          </View>
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={1}
            style={{ color: colors.onBrand, fontSize: 13, lineHeight: 16 }}
          >
            {payLabel}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
