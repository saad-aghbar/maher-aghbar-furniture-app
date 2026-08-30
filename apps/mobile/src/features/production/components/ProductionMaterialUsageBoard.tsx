import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ProductionMaterialUsageLine, ProductionMaterialUsageStatus } from '../api';
import {
  productionBoardShadow,
  productionSectionLabelStyle,
} from '../productionFloorStyle';

type Props = {
  materials: ProductionMaterialUsageLine[];
};

function statusColor(
  status: ProductionMaterialUsageStatus,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (status) {
    case 'OVER':
      return colors.error;
    case 'UNDER':
      return colors.warning;
    case 'EXTRA':
      return colors.warning;
    case 'UNUSED':
      return colors.textMuted;
    default:
      return colors.success;
  }
}

function statusLabel(status: ProductionMaterialUsageStatus, t: (key: string) => string): string {
  switch (status) {
    case 'OVER':
      return t('mobile.production.usageStatusOver');
    case 'UNDER':
      return t('mobile.production.usageStatusUnder');
    case 'EXTRA':
      return t('mobile.production.usageStatusExtra');
    case 'UNUSED':
      return t('mobile.production.usageStatusUnused');
    default:
      return t('mobile.production.usageStatusOnTarget');
  }
}

function MetricCell({
  label,
  value,
  emphasize,
  color,
  signed,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  color?: string;
  signed?: boolean;
}) {
  const { theme, colors } = useTheme();
  const display =
    signed && value > 0 ? `+${value}` : String(value);
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <AppText
        variant="heading"
        weight="semibold"
        dir="ltr"
        align="center"
        style={{ color: color ?? (emphasize ? colors.brand : colors.textPrimary) }}
      >
        {display}
      </AppText>
      <AppText variant="caption" color="muted" align="center" numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

function UsageRow({ row }: { row: ProductionMaterialUsageLine }) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, {
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameHe: row.nameHe,
  });
  const accent = statusColor(row.status, colors);

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
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
        }}
      />
      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <InventorySkuThumb uri={row.imageUrl} size={36} rounded="full" />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="body" weight={titleWeight} numberOfLines={2}>
              {name}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
              {[row.sku, row.unit].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: accent,
            }}
          >
            <AppText variant="caption" weight="semibold" style={{ color: accent }}>
              {statusLabel(row.status, t)}
            </AppText>
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'stretch',
            borderRadius: theme.radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <MetricCell label={t('mobile.production.usageAssigned')} value={row.assignedQty} />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4 }} />
          <MetricCell label={t('mobile.production.usageUsed')} value={row.usedQty} emphasize />
          {row.returnedQty > 0 ? (
            <>
              <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4 }} />
              <MetricCell
                label={t('mobile.production.usageReturned')}
                value={row.returnedQty}
              />
            </>
          ) : null}
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4 }} />
          <MetricCell
            label={t('mobile.production.usageVariance')}
            value={row.varianceQty}
            color={accent}
            signed
          />
        </View>
      </View>
    </View>
  );
}

export function ProductionMaterialUsageBoard({ materials }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...productionBoardShadow(colorScheme),
      }}
    >
      <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.45 }} />
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
            }}
          >
            <Ionicons name="layers-outline" size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={productionSectionLabelStyle(locale, colors.brand)}
            >
              {t('mobile.production.usageEyebrow')}
            </AppText>
            <AppText variant="heading" weight={titleWeight}>
              {t('mobile.production.materials')}
            </AppText>
          </View>
          <AppText variant="caption" weight="semibold" dir="ltr" color="muted">
            {materials.length}
          </AppText>
        </View>

        <AppText variant="caption" color="muted">
          {t('mobile.production.usageHint')}
        </AppText>

        {materials.length === 0 ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            }}
          >
            <AppText variant="body" weight="medium">
              {t('mobile.production.usageEmptyTitle')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.production.usageEmptyBody')}
            </AppText>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {materials.map((row) => (
              <UsageRow key={row.inventoryItemId} row={row} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
