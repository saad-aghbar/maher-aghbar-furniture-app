import { Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { SemiFinishedLot } from '@/api/modules/inventory';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { InventorySheetFooter } from './InventorySheetFooter';

type Props = {
  open: boolean;
  lot: SemiFinishedLot | null;
  onClose: () => void;
  onShowQr?: (lot: SemiFinishedLot) => void;
  onPrintQr?: (lot: SemiFinishedLot) => void;
};

function movementLabel(type: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    SEMI_FINISHED_ISSUE: t('inventory.movementIssue'),
    FINISHED_GOODS_RECEIPT: t('inventory.movementFinishedReceipt'),
    DELIVERY_ISSUE: t('inventory.movementDelivery'),
    DELIVERY_RESTORE: t('inventory.movementRestore'),
    CUSTOMER_RETURN: t('inventory.movementReturn'),
    SCRAP: t('inventory.movementScrap'),
    DAMAGE: t('inventory.movementDamage'),
    PRODUCTION_RETURN: t('inventory.movementProductionReturn'),
  };
  return map[type] ?? type.replaceAll('_', ' ').toLowerCase();
}

function movementIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'SEMI_FINISHED_ISSUE':
      return 'arrow-forward-outline';
    case 'FINISHED_GOODS_RECEIPT':
      return 'checkmark-done-outline';
    case 'DELIVERY_ISSUE':
      return 'car-outline';
    case 'DELIVERY_RESTORE':
    case 'PRODUCTION_RETURN':
    case 'CUSTOMER_RETURN':
      return 'return-down-back-outline';
    case 'SCRAP':
    case 'DAMAGE':
      return 'warning-outline';
    default:
      return 'swap-horizontal-outline';
  }
}

function lotAccent(
  status: string,
  colors: { info: string; success: string; warning: string; error: string; textMuted: string },
): string {
  switch (status) {
    case 'AVAILABLE':
      return colors.info;
    case 'RESERVED':
    case 'REQUIRES_REVIEW':
    case 'QUARANTINED':
      return colors.warning;
    case 'DAMAGED':
    case 'SCRAPPED':
      return colors.error;
    case 'CONSUMED':
    case 'DELIVERED':
      return colors.success;
    default:
      return colors.info;
  }
}

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

function SectionEyebrow({ label }: { label: string }) {
  const { locale, isRTL } = useLocale();
  const { colors } = useTheme();

  return (
    <AppText
      variant="caption"
      weight={locale === 'ar' ? 'regular' : 'medium'}
      style={{
        letterSpacing: locale === 'ar' ? 0 : 0.8,
        textTransform: locale === 'ar' ? 'none' : 'uppercase',
        fontSize: 11,
        lineHeight: 14,
        color: colors.brand,
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {label}
    </AppText>
  );
}

export function InventoryLotInspectSheet({
  open,
  lot,
  onClose,
  onShowQr,
  onPrintQr,
}: Props) {
  const { t, locale, isRTL, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  if (!lot) return null;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, lot.inventoryItem);
  const sku = lot.inventoryItem.sku?.trim();
  const qty = Number(lot.quantity);
  const accent = lotAccent(lot.status, colors);
  const imageUrl = lot.inventoryItem.product?.imageUrl;
  const product =
    lot.productNameEn || lot.inventoryItem.product
      ? localizedName(locale, {
          nameEn: lot.productNameEn ?? lot.inventoryItem.product?.nameEn ?? '',
          nameAr: lot.productNameAr ?? lot.inventoryItem.product?.nameAr ?? '',
          nameHe: lot.inventoryItem.product?.nameHe,
        })
      : lot.productionOrder?.productDescription;
  const stage =
    lot.producingStageNameEn || lot.stageInstance?.stageDefinition
      ? localizedName(locale, {
          nameEn: lot.producingStageNameEn ?? lot.stageInstance?.stageDefinition?.nameEn ?? '',
          nameAr: lot.producingStageNameAr ?? lot.stageInstance?.stageDefinition?.nameAr ?? '',
          nameHe: lot.stageInstance?.stageDefinition?.nameHe,
        })
      : null;
  const nextStage =
    lot.nextConsumingStageNameEn || lot.nextConsumingStageNameAr
      ? localizedName(locale, {
          nameEn: lot.nextConsumingStageNameEn ?? '',
          nameAr: lot.nextConsumingStageNameAr ?? '',
        })
      : null;
  const stageFlow =
    stage && nextStage ? `${stage} → ${nextStage}` : stage ?? nextStage;
  const orderNumber = lot.productionOrderNumber ?? lot.productionOrder?.number ?? null;
  const warehouseName = localizedName(locale, lot.warehouse);
  const binLabel = lot.location
    ? lot.location.name?.trim() || lot.location.code
    : null;
  const scanCode = lot.qrCode?.trim() || lot.wipKit?.qrCode?.trim() || null;
  const movements = lot.laterMovements ?? [];
  const statusLabel = t(`mobile.inventory.lotStatus.${lot.status}`);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.inspectLot')}
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
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: accent,
              opacity: 0.85,
            }}
          />
          <View
            style={{
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
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
                  width: 48,
                  height: 48,
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
                    style={{ width: 48, height: 48 }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Ionicons name="layers-outline" size={22} color={accent} />
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="heading" weight={titleWeight} numberOfLines={2}>
                  {name}
                </AppText>
                {sku ? (
                  <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
                    {sku}
                  </AppText>
                ) : null}
                <StatusBadge status={lot.status} label={statusLabel} dot />
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
                <AppText variant="caption" color="brand" align="center" numberOfLines={1}>
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
          {product ? (
            <FactRow icon="cube-outline" label={t('mobile.inventory.lotProduct')} value={product} />
          ) : null}
          {orderNumber ? (
            <FactRow
              icon="document-text-outline"
              label={t('inventory.productionOrder')}
              value={orderNumber}
            />
          ) : null}
          {stageFlow ? (
            <FactRow icon="construct-outline" label={t('inventory.stage')} value={stageFlow} />
          ) : null}
          <FactRow
            icon="time-outline"
            label={t('mobile.inventory.lotProducedAt')}
            value={formatDateTime(lot.producedAt)}
          />
          <FactRow
            icon="business-outline"
            label={t('inventory.warehouse')}
            value={warehouseName}
            last={!binLabel && !scanCode}
          />
          {binLabel ? (
            <FactRow
              icon="location-outline"
              label={t('mobile.inventory.wipLocation')}
              value={binLabel}
              last={!scanCode}
            />
          ) : null}
          {scanCode ? (
            <FactRow
              icon="qr-code-outline"
              label={t('mobile.inventory.wipQrLabel')}
              value={scanCode}
              last
            />
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionEyebrow label={t('mobile.inventory.lotLater')} />
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
            }}
          >
            {movements.length === 0 ? (
              nextStage ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: theme.spacing.sm,
                    padding: theme.spacing.md,
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
                    <Ionicons name="arrow-forward-outline" size={15} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodySecondary" weight="medium">
                      {t('mobile.inventory.lotAwaitsStage', { stage: nextStage })}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {stage
                        ? t('mobile.inventory.lotFlowHint', { from: stage, to: nextStage })
                        : t('mobile.inventory.lotNoLaterYet')}
                    </AppText>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: theme.spacing.xl,
                    paddingHorizontal: theme.spacing.lg,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="git-commit-outline" size={18} color={colors.textMuted} />
                  </View>
                  <AppText variant="caption" color="muted" align="center">
                    {t('mobile.inventory.lotNoLater')}
                  </AppText>
                </View>
              )
            ) : (
              movements.map((m, i) => {
                const last = i === movements.length - 1;
                const wh = locale === 'ar' ? m.warehouseNameAr : m.warehouseNameEn;
                return (
                  <View
                    key={`${m.type}-${m.createdAt}-${i}`}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                      gap: theme.spacing.sm,
                      padding: theme.spacing.md,
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
                      <Ionicons name={movementIcon(m.type)} size={15} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodySecondary" weight="medium">
                        {movementLabel(m.type, t)}
                      </AppText>
                      <AppText variant="caption" color="muted">
                        {[Number(m.quantity), wh, m.createdAt ? formatDateTime(m.createdAt) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {scanCode && onShowQr ? (
          <InventorySheetFooter
            primaryLabel={t('mobile.inventory.wipShowQr')}
            onPrimary={() => onShowQr(lot)}
            secondaryLabel={onPrintQr ? t('mobile.inventory.wipPrintKitLabel') : t('mobile.inventory.cancel')}
            onSecondary={onPrintQr ? () => onPrintQr(lot) : onClose}
          />
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
