import { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  listSalesOrders,
  type SalesOrderListItem,
} from '@/api/modules/sales-orders';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerSearchBar } from '@/features/dealer-ui';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  /** Previously confirmed order — used when search filters it out of the list. */
  selectedOrder?: SalesOrderListItem | null;
  onConfirm: (order: SalesOrderListItem) => void;
};

/**
 * Searchable order picker — floor cards with image, number, status.
 */
export function ReturnOrderPickerSheet({
  open,
  onClose,
  selectedId,
  selectedOrder = null,
  onConfirm,
}: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [draftId, setDraftId] = useState(selectedId);
  const [draftOrder, setDraftOrder] = useState<SalesOrderListItem | null>(
    selectedOrder,
  );

  useEffect(() => {
    if (open) {
      setDraftId(selectedId);
      setDraftOrder(selectedOrder);
      setSearch('');
      setQ('');
    }
  }, [open, selectedId, selectedOrder]);

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const ordersQuery = useQuery({
    queryKey: ['returns-orders', q],
    queryFn: () => listSalesOrders({ page: 1, pageSize: 30, q: q || undefined }),
    enabled: open,
  });

  const orders = ordersQuery.data?.data ?? [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('catalog.selectSalesOrder')}
      sheetHeight={560}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
        <DealerSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('mobile.returns.orderSearchPlaceholder')}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {ordersQuery.isLoading ? (
            <AppText variant="caption" color="muted">
              {t('mobile.returns.loading')}
            </AppText>
          ) : ordersQuery.isError ? (
            <AppText variant="caption" color="error">
              {t('mobile.returns.errorBody')}
            </AppText>
          ) : orders.length === 0 ? (
            <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.returns.orderPickerEmpty')}
            </AppText>
          ) : (
            orders.map((order) => (
              <ReturnOrderPickCard
                key={order.id}
                order={order}
                selected={order.id === draftId}
                titleWeight={titleWeight}
                formatDate={formatDate}
                onPress={() => {
                  void haptics.selection();
                  setDraftId(order.id);
                  setDraftOrder(order);
                }}
              />
            ))
          )}
        </ScrollView>

        <View style={{ gap: theme.spacing.sm }}>
          <PrimaryButton
            label={t('common.confirm')}
            disabled={!draftOrder}
            onPress={() => {
              if (!draftOrder) return;
              void haptics.confirmLight();
              onConfirm(draftOrder);
              onClose();
            }}
            style={{ borderRadius: theme.radius.xl }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={onClose}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function ReturnOrderPickCard({
  order,
  selected,
  titleWeight,
  formatDate,
  onPress,
}: {
  order: SalesOrderListItem;
  selected: boolean;
  titleWeight: 'medium' | 'semibold';
  formatDate: (iso: string) => string;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const uri = resolveOrderMediaUri(order.imageUrl);
  const subtitle =
    order.title ||
    order.projectName ||
    order.externalOrderNumber ||
    null;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={order.number}
      onPress={onPress}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.brand : colors.borderStrong,
        backgroundColor: selected ? colors.brandSoft : colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
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
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + (selected ? 4 : 0) }
            : { paddingLeft: theme.spacing.md + (selected ? 4 : 0) }),
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {uri ? (
            <Image source={{ uri }} style={{ width: 72, height: 72 }} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{ flex: 1, fontSize: 16, color: colors.textPrimary }}
            >
              {order.number}
            </AppText>
            <StatusBadge status={order.status} dot />
          </View>
          {subtitle ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
            >
              {subtitle}
            </AppText>
          ) : null}
          {order.requiredDeliveryDate ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
            >
              {t('mobile.returns.deliveryBy', {
                date: formatDate(order.requiredDeliveryDate),
              })}
            </AppText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}
