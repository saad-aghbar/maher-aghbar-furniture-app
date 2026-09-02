import { View } from 'react-native';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
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
        weight={emphasize ? 'semibold' : 'medium'}
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

const MEDIA = 56;

function UsageRow({ row }: { row: ProductionMaterialUsageLine }) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, {
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameHe: row.nameHe,
  });
  const accent = statusColor(row.status, colors);
  const tense =
    row.status === 'OVER'
      ? colors.error
      : row.status === 'UNDER' || row.status === 'EXTRA'
        ? colors.warning
        : colors.borderStrong;
  const meta = [row.sku, row.unit].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: tense,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...productionBoardShadow(colorScheme),
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
          opacity: row.status === 'ON_TARGET' || row.status === 'UNUSED' ? 0.55 : 0.9,
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
          numberOfLines={1}
          style={{ flex: 1, color: accent, fontSize: 11 }}
        >
          {statusLabel(row.status, t)}
        </AppText>
        {row.sku ? (
          <AppText variant="caption" color="muted" weight={titleWeight} dir="ltr" numberOfLines={1}>
            {row.sku}
          </AppText>
        ) : null}
      </View>

      <View
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
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <InventorySkuThumb uri={row.imageUrl} size={MEDIA} rounded="lg" />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
            >
              {name}
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
            alignItems: 'stretch',
            flexWrap: 'wrap',
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <MetricCell label={t('mobile.production.usagePlanned')} value={row.assignedQty} />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4 }} />
          <MetricCell label={t('mobile.production.usageUsed')} value={row.usedQty} emphasize />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4 }} />
          <MetricCell
            label={t('mobile.production.usageReturned')}
            value={row.returnedQty}
          />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4 }} />
          <MetricCell
            label={t('mobile.production.usageScrap')}
            value={row.scrapQty}
            color={row.scrapQty > 0 ? colors.warning : undefined}
          />
        </View>

        {(() => {
          const linked = (row.tasks ?? []).find(
            (task) => task.recordedBy || task.assignedEmployee,
          );
          if (!linked) return null;
          const person = linked.recordedBy ?? linked.assignedEmployee;
          if (!person) return null;
          const personName = `${person.firstName} ${person.lastName}`.trim();
          const stage =
            locale === 'ar'
              ? linked.stageNameAr || linked.stageNameEn
              : locale === 'he'
                ? linked.stageNameHe || linked.stageNameEn
                : linked.stageNameEn;
          return (
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {t('mobile.production.usageUsedBy', {
                worker: personName || '—',
                stage: stage || '—',
              })}
            </AppText>
          );
        })()}
      </View>
    </View>
  );
}

export function ProductionMaterialUsageBoard({ materials }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md }}>
      <DealerBoard
        title={t('mobile.production.materials')}
        titleWeight={titleWeight}
        trailing={
          <AppText variant="caption" weight={titleWeight} dir="ltr" color="muted">
            {materials.length}
          </AppText>
        }
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={productionSectionLabelStyle(locale, colors.brand)}
        >
          {t('mobile.production.usageEyebrow')}
        </AppText>
        <AppText variant="caption" color="muted">
          {t('mobile.production.usageHint')}
        </AppText>
      </DealerBoard>

      {materials.length === 0 ? (
        <DealerEmptyPanel
          icon="layers-outline"
          text={`${t('mobile.production.usageEmptyTitle')}. ${t('mobile.production.usageEmptyBody')}`}
        />
      ) : (
        materials.map((row) => <UsageRow key={row.inventoryItemId} row={row} />)
      )}
    </View>
  );
}
