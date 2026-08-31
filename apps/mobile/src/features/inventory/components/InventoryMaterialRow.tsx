import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItemCardModel } from '../selectInventory';
import { formatInventoryMaterialType, showsRawMaterialPhoto } from '../selectInventory';

type Props = {
  item: InventoryItemCardModel;
  index: number;
  onPress: () => void;
  canReceive?: boolean;
  canIssue?: boolean;
  canEdit?: boolean;
  canLabelPdf?: boolean;
  onReceive?: () => void;
  onIssue?: () => void;
  onEdit?: () => void;
  onLabelPdf?: () => void;
  onQrCode?: () => void;
  /** Skip stagger enter (section tab swaps). */
  animateEnter?: boolean;
};

const MEDIA = 56;

/** Floor material card — rail, header band, thumb, inset qty, footer chips. */
export function InventoryMaterialRow({
  item,
  index,
  onPress,
  canReceive,
  canIssue,
  canEdit,
  canLabelPdf,
  onReceive,
  onIssue,
  onEdit,
  onLabelPdf,
  onQrCode,
  animateEnter = true,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const stockLabel = item.isLowStock
    ? t('mobile.inventory.lowStock')
    : t('mobile.inventory.inStock');
  const showActions = Boolean(
    (canReceive && onReceive) ||
      (canIssue && onIssue) ||
      (canEdit && onEdit) ||
      (canLabelPdf && onLabelPdf) ||
      onQrCode,
  );
  const nameWeight = locale === 'ar' ? 'medium' : 'semibold';
  const materialTypeLabel = formatInventoryMaterialType(item.materialType, t);
  const meta = [item.sku, materialTypeLabel, item.color].filter(Boolean).join(' · ');
  const showPhoto = showsRawMaterialPhoto(item.itemClass);
  const accent = item.isLowStock ? colors.warning : colors.brand;

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: item.isLowStock ? colors.warning : colors.borderStrong,
          backgroundColor: colors.surface,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: item.isLowStock ? 0.9 : 0.55,
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
          <StatusBadge
            status={item.isLowStock ? 'OVERDUE' : 'ACTIVE'}
            label={stockLabel}
            dot
          />
          <AppText variant="caption" color="brand" weight={nameWeight}>
            {t('common.details')}
          </AppText>
        </View>

        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => {
            void haptics.selection();
            onPress();
          }}
          style={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              alignItems: 'flex-start',
            }}
          >
            {showPhoto ? (
              <View
                style={{
                  width: MEDIA,
                  height: MEDIA,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: MEDIA, height: MEDIA }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <AppText variant="caption" color="muted" align="center">
                    {t('mobile.inventory.noPhoto')}
                  </AppText>
                )}
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <AppText
                variant="label"
                weight={nameWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
              >
                {item.name}
              </AppText>
              {meta ? (
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {meta}
                </AppText>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              padding: theme.spacing.sm,
            }}
          >
            <StatPill
              label={t('mobile.inventory.onHandShort')}
              value={item.quantityLabel}
              emphasize
            />
            <StatPill
              label={t('mobile.inventory.minShort')}
              value={`${item.minStock} ${item.unit}`}
              warning={item.isLowStock}
            />
            {item.showCost && item.costLabel ? (
              <StatPill label={t('mobile.inventory.costShort')} value={item.costLabel} />
            ) : null}
          </View>
        </AnimatedPressable>

        {showActions ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            }}
          >
            {canReceive && onReceive ? (
              <ActionChip label={t('mobile.inventory.receive')} tone="brand" onPress={onReceive} />
            ) : null}
            {canIssue && onIssue ? (
              <ActionChip label={t('mobile.inventory.issue')} tone="solid" onPress={onIssue} />
            ) : null}
            {canEdit && onEdit ? (
              <ActionChip label={t('mobile.inventory.edit')} tone="ghost" onPress={onEdit} />
            ) : null}
            {canLabelPdf && onLabelPdf ? (
              <ActionChip label={t('mobile.inventory.labelPdf')} tone="ghost" onPress={onLabelPdf} />
            ) : null}
            {onQrCode ? (
              <ActionChip label={t('mobile.inventory.qrCode')} tone="ghost" onPress={onQrCode} />
            ) : null}
          </View>
        ) : null}
      </View>
    </ListItemEnter>
  );
}

function StatPill({
  label,
  value,
  emphasize,
  warning,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warning?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'baseline',
        gap: 6,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 5,
        borderRadius: theme.radius.md,
        backgroundColor: warning
          ? colors.warningSoft
          : emphasize
            ? colors.brandSoft
            : colors.surface,
        borderWidth: 1,
        borderColor: warning ? colors.warning : colors.border,
      }}
    >
      <AppText
        variant="caption"
        color={warning ? 'warning' : 'muted'}
        weight={locale === 'ar' ? 'regular' : 'medium'}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        color={warning ? 'warning' : emphasize ? 'brand' : 'primary'}
        dir="ltr"
      >
        {value}
      </AppText>
    </View>
  );
}

function ActionChip({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'brand' | 'solid' | 'ghost';
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();
  const brand = tone === 'brand';
  const ghost = tone === 'ghost';

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
        minHeight: 40,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brand
          ? colors.brandSoft
          : ghost
            ? colors.surfaceSecondary
            : colors.brand,
        borderWidth: 1,
        borderColor: brand ? colors.brand : ghost ? colors.border : colors.brand,
      }}
    >
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        style={{ color: brand ? colors.brand : ghost ? colors.textPrimary : colors.onBrand }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
