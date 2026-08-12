import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { SalesOrderListItem } from '@/api/modules/sales-orders';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { useCreateInvoiceMutation, useInvoiceSalesOrdersQuery } from '../query';
import { AppTextInput } from '@/components/forms/AppTextInput';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (invoiceId: string) => void;
};

const THUMB = 52;

/**
 * Create invoice from sales order — searchable floor picker with confirm.
 */
export function CreateInvoiceFromSalesOrderSheet({ open, onClose, onCreated }: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.min(Math.round(height * 0.82), 680);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ordersQuery = useInvoiceSalesOrdersQuery(open);
  const createMutation = useCreateInvoiceMutation();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedId(null);
    }
  }, [open]);

  const orders = ordersQuery.data?.data ?? [];
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return orders;
    return orders.filter((o) => {
      const hay = [
        o.number,
        o.externalOrderNumber,
        o.title,
        o.customer?.name,
        o.customer?.nameEn,
        o.customer?.nameAr,
        o.customer?.nameHe,
        o.customer?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, needle]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const reset = () => {
    setQuery('');
    setSelectedId(null);
    onClose();
  };

  const confirm = async () => {
    if (!selectedId) return;
    try {
      const invoice = await createMutation.mutateAsync(selectedId);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('accounting.invoiceCreated') });
      reset();
      onCreated(invoice.id);
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.invoices.paymentFailed'),
      });
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={reset}
      title={t('accounting.createFromSalesOrder')}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
        >
          {t('accounting.pickSalesOrderHint')}
        </AppText>

        <SearchBarShell>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('accounting.searchSalesOrders')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[
              {
                flex: 1,
                minWidth: 0,
                paddingVertical: theme.spacing.sm,
                fontSize: 16,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              },
              resolveAppFontStyle(locale, {
                weight: 'regular',
                variant: 'body',
                systemWeight: theme.typography.weights.regular,
              }),
            ]}
          />
        </SearchBarShell>

        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, maxHeight: Math.round(sheetHeight * 0.48) }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
          showsVerticalScrollIndicator
        >
          {filtered.length === 0 ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left', paddingVertical: theme.spacing.md }}
            >
              {orders.length === 0
                ? t('accounting.noSalesOrdersAvailable')
                : t('accounting.noSalesOrdersMatch')}
            </AppText>
          ) : (
            filtered.map((order) => (
              <SalesOrderPickRow
                key={order.id}
                order={order}
                active={selectedId === order.id}
                onPress={() => {
                  void haptics.selection();
                  setSelectedId(order.id);
                }}
                formatCurrency={formatCurrency}
                isRTL={isRTL}
                locale={locale}
                titleWeight={titleWeight}
              />
            ))
          )}
        </ScrollView>

        {selected ? (
          <AppText
            variant="caption"
            color="brand"
            weight="semibold"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {selected.number}
            {selected.title ? ` · ${selected.title}` : ''}
          </AppText>
        ) : null}

        <PrimaryButton
          label={t('accounting.createInvoice')}
          onPress={() => void confirm()}
          loading={createMutation.isPending}
          disabled={!selectedId}
          style={{ borderRadius: theme.radius.xl }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={reset}
          style={{ borderRadius: theme.radius.xl }}
        />
      </View>
    </BottomSheet>
  );
}

function SalesOrderPickRow({
  order,
  active,
  onPress,
  formatCurrency,
  isRTL,
  locale,
  titleWeight,
}: {
  order: SalesOrderListItem;
  active: boolean;
  onPress: () => void;
  formatCurrency: (n: number) => string;
  isRTL: boolean;
  locale: string;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const imageUri = resolveOrderMediaUri(order.imageUrl);
  const dealer = localizedName(
    locale,
    {
      name: order.customer?.name,
      nameEn: order.customer?.nameEn,
      nameAr: order.customer?.nameAr,
      nameHe: order.customer?.nameHe,
    },
    order.customer?.code || '—',
  );
  const amount = Number(order.sellerPrice ?? 0);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: theme.radius.md,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="cube-outline" size={22} color={colors.brand} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {order.title?.trim() || order.number}
          </AppText>
          <StatusBadge status={order.status} dot />
        </View>
        <AppText
          variant="caption"
          color="muted"
          numberOfLines={1}
          dir="ltr"
          style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
        >
          {[
            `${t('accounting.factoryOrderShort')} ${order.number}`,
            order.externalOrderNumber
              ? `${t('accounting.dealerOrderShort')} ${order.externalOrderNumber}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
        >
          {dealer}
          {amount > 0 ? ` · ${formatCurrency(amount)}` : ''}
        </AppText>
      </View>

      {active ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
      ) : (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={colors.textMuted}
        />
      )}
    </AnimatedPressable>
  );
}
