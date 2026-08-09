import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import {
  INVOICE_STATUS_FILTERS,
  isInvoiceStatusFilterActive,
  type InvoiceStatusFilter,
} from '../invoiceFilters';

type Props = {
  open: boolean;
  onClose: () => void;
  status: InvoiceStatusFilter;
  onApply: (status: InvoiceStatusFilter) => void;
};

/**
 * Status filter sheet — All / Paid / Unpaid / Overdue / Partial with Apply.
 */
export function InvoiceStatusFilterSheet({
  open,
  onClose,
  status,
  onApply,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.58), 480);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [draft, setDraft] = useState<InvoiceStatusFilter>(status);

  useEffect(() => {
    if (open) setDraft(status);
  }, [open, status]);

  const dismiss = () => onClose();

  const apply = () => {
    void haptics.confirmLight();
    onApply(draft);
    dismiss();
  };

  const reset = () => {
    void haptics.selection();
    setDraft('ALL');
  };

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={t('accounting.filterTitle')}
      fitContent
      maxHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
            overflow: 'hidden',
          }}
        >
          {isInvoiceStatusFilterActive(draft) ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.85,
              }}
            />
          ) : null}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              ...(isRTL
                ? { paddingRight: isInvoiceStatusFilterActive(draft) ? 4 : 0 }
                : { paddingLeft: isInvoiceStatusFilterActive(draft) ? 4 : 0 }),
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons
                name="funnel-outline"
                size={16}
                color={
                  isInvoiceStatusFilterActive(draft) ? colors.brand : colors.brand
                }
              />
            </View>
            <AppText
              variant="caption"
              style={{
                flex: 1,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontSize: 11,
                lineHeight: 14,
                color: colors.brand,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('accounting.filterStatus')}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              ...(isRTL
                ? { paddingRight: isInvoiceStatusFilterActive(draft) ? 4 : 0 }
                : { paddingLeft: isInvoiceStatusFilterActive(draft) ? 4 : 0 }),
            }}
          >
            {INVOICE_STATUS_FILTERS.map((s, index) => {
              const active = draft === s;
              const chip = (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    setDraft(s);
                  }}
                  style={{
                    minWidth: 96,
                    maxWidth: 168,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    minHeight: 40,
                    borderRadius: theme.radius.lg,
                    backgroundColor: active ? colors.brandSoft : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    overflow: 'hidden',
                    alignItems: isRTL ? 'flex-end' : 'flex-start',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        ...(isRTL ? { right: 0 } : { left: 0 }),
                        width: 3,
                        backgroundColor: colors.brand,
                        opacity: 0.85,
                      }}
                    />
                  ) : null}
                  <AppText
                    variant="label"
                    weight={active ? titleWeight : 'medium'}
                    numberOfLines={1}
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      paddingLeft: active && !isRTL ? 4 : 0,
                      paddingRight: active && isRTL ? 4 : 0,
                    }}
                  >
                    {t(`mobile.invoices.chips.${s}`)}
                  </AppText>
                </AnimatedPressable>
              );
              if (reduce) {
                return <View key={s}>{chip}</View>;
              }
              return (
                <Animated.View
                  key={s}
                  entering={FadeInDown.delay(30 + index * 30).duration(200)}
                >
                  {chip}
                </Animated.View>
              );
            })}
          </View>
        </View>

        <View
          style={{
            paddingTop: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <SecondaryButton
            label={t('accounting.filterReset')}
            onPress={reset}
            style={{ flex: 1, borderRadius: theme.radius.xl }}
          />
          <PrimaryButton
            label={t('accounting.filterApply')}
            onPress={apply}
            style={{ flex: 1.35, borderRadius: theme.radius.xl }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
