import { Image, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { localizedName } from '@maher/i18n';
import type { FinishedLot } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { fgDeliveryStatusLabel } from '../fgFilters';

type Props = {
  open: boolean;
  lot: FinishedLot | null;
  onClose: () => void;
  canTransfer?: boolean;
  canCount?: boolean;
  canReport?: boolean;
  onTransfer?: (lot: FinishedLot) => void;
  onCount?: (lot: FinishedLot) => void;
  onReport?: (lot: FinishedLot) => void;
};

function FactRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
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
        <Ionicons name={icon} size={15} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="bodySecondary" weight="medium" numberOfLines={2}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

function ActionChip({
  label,
  icon,
  onPress,
  primary,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: 1,
        minWidth: '46%',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: primary ? colors.brand : colors.borderStrong,
        backgroundColor: primary ? colors.brandSoft : colors.surface,
      }}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.brand : colors.textSecondary} />
      <AppText variant="caption" weight="semibold" color={primary ? 'brand' : 'secondary'} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function InventoryFgLotInspectSheet({
  open,
  lot,
  onClose,
  canTransfer = false,
  canCount = false,
  canReport = false,
  onTransfer,
  onCount,
  onReport,
}: Props) {
  const { t, locale, isRTL, formatDate, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  if (!lot) return null;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const productName =
    lot.productNameEn || lot.productNameAr
      ? localizedName(locale, {
          nameEn: lot.productNameEn ?? '',
          nameAr: lot.productNameAr ?? '',
        })
      : localizedName(locale, lot.inventoryItem);
  const dealerName =
    lot.dealerNameEn || lot.dealerNameAr
      ? localizedName(locale, {
          nameEn: lot.dealerNameEn ?? '',
          nameAr: lot.dealerNameAr ?? '',
        })
      : null;
  const imageUrl = lot.inventoryItem.product?.imageUrl;
  const qty = Number(lot.quantity);
  const statusLabel = fgDeliveryStatusLabel(lot, t);
  const salesOrderId = lot.salesOrder?.id ?? null;
  const deliveryId = lot.salesOrder?.deliveries?.[0]?.id ?? null;
  const poNumber = lot.productionOrderNumber ?? lot.productionOrder?.number ?? null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.inspectFinishedLot')}
      fitContent
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
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
            style={{
              gap: theme.spacing.md,
              padding: theme.spacing.md,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: 56, height: 56 }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Ionicons name="cube-outline" size={24} color={colors.brand} />
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="heading" weight={titleWeight} numberOfLines={2}>
                  {productName}
                </AppText>
                {lot.projectName ? (
                  <AppText variant="caption" color="muted" numberOfLines={1}>
                    {lot.projectName}
                  </AppText>
                ) : null}
                {statusLabel ? (
                  <StatusBadge status={lot.deliveryStatus ?? 'WAITING'} label={statusLabel} dot />
                ) : null}
              </View>
              <View
                style={{
                  minWidth: 56,
                  alignItems: 'center',
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radius.md,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AppText variant="heading" weight="semibold" dir="ltr" color="brand">
                  {qty}
                </AppText>
                <AppText variant="caption" color="brand" align="center">
                  {t('mobile.inventory.onHandShort')}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.xs,
            paddingBottom: theme.spacing.xs,
          }}
        >
          {lot.salesOrderNumber ? (
            <FactRow
              icon="briefcase-outline"
              label={t('inventory.salesOrder')}
              value={lot.salesOrderNumber}
            />
          ) : null}
          {poNumber ? (
            <FactRow
              icon="document-text-outline"
              label={t('inventory.productionOrder')}
              value={poNumber}
            />
          ) : null}
          {dealerName ? (
            <FactRow icon="people-outline" label={t('inventory.dealer')} value={dealerName} />
          ) : null}
          {lot.deliveryNumber ? (
            <FactRow
              icon="car-outline"
              label={t('mobile.inventory.deliveryNumber')}
              value={lot.deliveryNumber}
            />
          ) : null}
          {lot.deliveryDate ? (
            <FactRow
              icon="calendar-outline"
              label={t('mobile.inventory.plannedTruckDate')}
              value={formatDate(lot.deliveryDate)}
            />
          ) : null}
          {typeof lot.daysWaiting === 'number' ? (
            <FactRow
              icon="time-outline"
              label={t('mobile.inventory.daysWaitingLabel')}
              value={t('mobile.inventory.daysWaiting', { days: lot.daysWaiting })}
            />
          ) : null}
          <FactRow
            icon="shield-checkmark-outline"
            label={t('lifecycle.qcPassed')}
            value={
              String(lot.qcStatus ?? 'PASS').toUpperCase().includes('FAIL')
                ? t('lifecycle.qcFailed')
                : t('lifecycle.qcPassed')
            }
          />
          <FactRow
            icon="cube-outline"
            label={t('lifecycle.packagingComplete')}
            value={
              lot.packagingComplete !== false
                ? t('lifecycle.packagingComplete')
                : '—'
            }
          />
          <FactRow
            icon="time-outline"
            label={t('lifecycle.finishedAt')}
            value={formatDateTime(lot.finishedAt ?? lot.producedAt)}
          />
          <FactRow
            icon="business-outline"
            label={t('inventory.warehouse')}
            value={localizedName(locale, lot.warehouse)}
            last
          />
        </View>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {salesOrderId ? (
            <ActionChip
              label={t('mobile.scheduling.viewOrder')}
              icon="briefcase-outline"
              primary
              onPress={() => {
                onClose();
                router.push(`/(app)/(admin)/orders/${salesOrderId}` as Href);
              }}
            />
          ) : null}
          {deliveryId ? (
            <ActionChip
              label={t('mobile.inventory.viewDelivery')}
              icon="car-outline"
              onPress={() => {
                onClose();
                router.push(`/(app)/(admin)/orders/${salesOrderId}` as Href);
              }}
            />
          ) : null}
          {canTransfer && onTransfer ? (
            <ActionChip
              label={t('mobile.inventory.transfer')}
              icon="swap-horizontal-outline"
              onPress={() => {
                onClose();
                onTransfer(lot);
              }}
            />
          ) : null}
          {canCount && onCount ? (
            <ActionChip
              label={t('mobile.inventory.count')}
              icon="clipboard-outline"
              onPress={() => {
                onClose();
                onCount(lot);
              }}
            />
          ) : null}
          {canReport && onReport ? (
            <ActionChip
              label={t('mobile.inventory.itemReport')}
              icon="document-text-outline"
              onPress={() => {
                onClose();
                onReport(lot);
              }}
            />
          ) : null}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
