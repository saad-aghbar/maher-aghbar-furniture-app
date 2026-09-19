import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import {
  receiptKindFromStatus,
  receiptProductLabel,
  selectReceiptStub,
} from '../selectDealerReceipts';
import { DealerReceiptStub } from './DealerReceiptStub';

type Props = {
  row: DealerDeliveryDto;
  onPress: () => void;
  onConfirm?: () => void;
  index?: number;
  selected?: boolean;
};

/** Receipt ticket — receipt stub + qty/address, not a station % or promised-day card. */
export function DealerReceiptCard({ row, onPress, onConfirm, index = 0, selected = false }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const kind = receiptKindFromStatus(row.customerStatus) ?? 'awaiting';
  const awaiting = kind === 'awaiting';
  const stub = selectReceiptStub(row);
  const name = receiptProductLabel(row, locale);
  const uri = resolveOrderMediaUri(row.imageUrl);
  const qty =
    row.quantity != null && Number.isFinite(Number(row.quantity))
      ? String(row.quantity)
      : '—';
  const address = row.deliveryAddress?.trim() || '—';
  const accent = awaiting ? colors.warning : colors.success;

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.dealerReceipts.a11yCard', {
          number: row.salesOrderNumber,
          product: name,
          status: t(
            awaiting
              ? 'mobile.dealerReceipts.stubAwaiting'
              : 'mobile.dealerReceipts.stubReceived',
          ),
        })}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: selected ? colors.brand : colors.borderStrong,
          backgroundColor: selected ? colors.brandSoft : colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
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
            opacity: awaiting ? 0.9 : 0.55,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ flexShrink: 1, color: colors.brand }}
          >
            {row.salesOrderNumber}
          </AppText>
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={1}
            style={{ color: awaiting ? colors.warning : colors.success }}
          >
            {t(
              awaiting
                ? 'mobile.dealerReceipts.stubAwaiting'
                : 'mobile.dealerReceipts.stubReceived',
            )}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'stretch',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <ProductThumb uri={uri} size={72} radius={theme.radius.md} />
          <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
            <AppText
              variant="title"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {name}
            </AppText>
            <View
              style={{
                marginTop: theme.spacing.xs,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.orders.qty')} · {qty}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {address}
              </AppText>
            </View>
          </View>
          <DealerReceiptStub kind={stub.kind} ymd={stub.ymd} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: awaiting ? colors.warningSoft : colors.surfaceSecondary,
          }}
        >
          {awaiting && onConfirm ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={`${t('lifecycle.confirmReceived')} ${row.salesOrderNumber}`}
              onPress={() => {
                void haptics.selection();
                onConfirm();
              }}
              style={{ flex: 1 }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                numberOfLines={2}
                style={{
                  color: colors.warning,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('lifecycle.confirmWhenReceived')}
              </AppText>
            </AnimatedPressable>
          ) : (
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={2}
              style={{
                flex: 1,
                color: colors.success,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.dealerReceipts.receivedCaption')}
            </AppText>
          )}
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
