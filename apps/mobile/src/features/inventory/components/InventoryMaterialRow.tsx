import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
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

/** Floor material board — accent strip, soft elevation, action band. */
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
  const { colors, theme } = useTheme();
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
          ...theme.elevation.card,
        }}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: item.isLowStock ? colors.warning : colors.borderStrong,
            borderRadius: theme.radius.xl,
            backgroundColor: colors.surface,
            overflow: 'hidden',
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
              opacity: item.isLowStock ? 0.9 : 0.5,
              zIndex: 1,
            }}
          />
          <AnimatedPressable
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => {
              void haptics.selection();
              onPress();
            }}
            style={{
              minHeight: theme.sizes.touch.min * 1.35,
              padding: theme.spacing.md,
              paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
              paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
              gap: theme.spacing.sm,
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
                    width: 52,
                    height: 52,
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
                      style={{ width: 52, height: 52 }}
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
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText variant="body" weight={nameWeight} style={{ flex: 1 }}>
                    {item.name}
                  </AppText>
                  <StatusBadge
                    status={item.isLowStock ? 'OVERDUE' : 'ACTIVE'}
                    label={stockLabel}
                    dot
                  />
                </View>

                {meta ? (
                  <AppText variant="caption" color="muted" weight="regular" dir="ltr">
                    {meta}
                  </AppText>
                ) : null}

                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                    marginTop: 2,
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
                    <StatPill
                      label={t('mobile.inventory.costShort')}
                      value={item.costLabel}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </AnimatedPressable>

          {showActions ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginHorizontal: theme.spacing.md,
                paddingBottom: theme.spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                paddingTop: theme.spacing.sm,
              }}
            >
              {canReceive && onReceive ? (
                <ActionChip
                  label={t('mobile.inventory.receive')}
                  tone="brand"
                  onPress={onReceive}
                />
              ) : null}
              {canIssue && onIssue ? (
                <ActionChip
                  label={t('mobile.inventory.issue')}
                  tone="solid"
                  onPress={onIssue}
                />
              ) : null}
              {canEdit && onEdit ? (
                <ActionChip
                  label={t('mobile.inventory.edit')}
                  tone="ghost"
                  onPress={onEdit}
                />
              ) : null}
              {canLabelPdf && onLabelPdf ? (
                <ActionChip
                  label={t('mobile.inventory.labelPdf')}
                  tone="ghost"
                  onPress={onLabelPdf}
                />
              ) : null}
              {onQrCode ? (
                <ActionChip
                  label={t('mobile.inventory.qrCode')}
                  tone="ghost"
                  onPress={onQrCode}
                />
              ) : null}
            </View>
          ) : null}
        </View>
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
            : colors.surfaceSecondary,
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
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 36,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brand
          ? colors.brandSoft
          : ghost
            ? 'transparent'
            : colors.surface,
        borderWidth: ghost ? 1 : 1,
        borderColor: brand
          ? colors.brand
          : ghost
            ? colors.borderStrong
            : colors.borderStrong,
      }}
    >
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        color={brand ? 'brand' : 'primary'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
