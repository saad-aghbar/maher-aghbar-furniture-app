import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionInsetStyle } from '@/features/production/productionFloorStyle';
import { FloorActionRow } from '@/features/sales-orders/components/FloorActionRow';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type {
  OrderPlanCatalogDiffRow,
  OrderPlanDims,
  OrderPlanMeasurement,
} from '@/api/modules/production';

type Props = {
  catalogDimensions?: OrderPlanDims | null;
  orderDimensions?: OrderPlanDims | null;
  measurements?: OrderPlanMeasurement[] | null;
  changesFromCatalog?: OrderPlanCatalogDiffRow[] | null;
  reviewRequired?: boolean;
  reviewDisabled?: boolean;
  reviewing?: boolean;
  onMarkReviewed?: () => void;
};

const DIM_FIELDS = ['width', 'height', 'depth', 'seatHeight'] as const;

function formatDim(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

/**
 * Read-only catalog vs order compare on the Production Plan desk.
 * Ports DimCompare / changesFromCatalog — does not invent a second diff.
 */
export function CatalogModificationsBoard({
  catalogDimensions,
  orderDimensions,
  measurements,
  changesFromCatalog,
  reviewRequired,
  reviewDisabled,
  reviewing,
  onMarkReviewed,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dimRows = DIM_FIELDS.filter(
    (field) => catalogDimensions?.[field] != null || orderDimensions?.[field] != null,
  );
  const extraChanges = (changesFromCatalog ?? []).filter(
    (row) => !DIM_FIELDS.includes(row.field as (typeof DIM_FIELDS)[number]),
  );

  return (
    <DealerBoard
      title={t('mobile.productionSetup.catalogTemplate.modificationsTitle')}
      titleWeight={titleWeight}
      accentColor={colors.warning}
      trailing={
        reviewRequired ? (
          <AppText variant="caption" weight={titleWeight} style={{ color: colors.warning }}>
            {t('mobile.productionSetup.needsReview')}
          </AppText>
        ) : null
      }
    >
      <View style={{ ...productionInsetStyle(theme, colors), gap: theme.spacing.sm }}>
        {reviewRequired ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.productionSetup.catalogTemplate.reviewRequired')}
          </AppText>
        ) : null}

        {dimRows.length === 0 && extraChanges.length === 0 && !(measurements ?? []).length ? (
          <AppText variant="caption" color="muted">
            {t('mobile.productionSetup.noCatalogChanges')}
          </AppText>
        ) : null}

        {dimRows.map((field) => (
          <View
            key={field}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="secondary" style={{ flex: 1 }}>
              {t(`mobile.productionSetup.dims.${field}`)}
            </AppText>
            <AppText variant="caption" weight={titleWeight} dir="ltr">
              {formatDim(catalogDimensions?.[field])} → {formatDim(orderDimensions?.[field])}
            </AppText>
          </View>
        ))}

        {(measurements ?? []).map((m) => (
          <View key={m.key} style={{ gap: 2 }}>
            <AppText variant="caption" color="muted">
              {m.label}
              {m.unit ? ` (${m.unit})` : ''}
            </AppText>
            <AppText variant="caption" weight={titleWeight} dir="ltr">
              {m.catalogValue != null ? `${m.catalogValue} → ` : ''}
              {m.value ?? '—'}
            </AppText>
          </View>
        ))}

        {extraChanges.map((c) => (
          <View
            key={`${c.field}-${String(c.from)}-${String(c.to)}`}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="secondary" style={{ flex: 1 }}>
              {c.label ?? c.field}
            </AppText>
            <AppText variant="caption" weight={titleWeight} dir="ltr">
              {formatDim(c.from)} → {formatDim(c.to)}
            </AppText>
          </View>
        ))}
      </View>
      {reviewRequired && onMarkReviewed ? (
        <FloorActionRow
          label={t('mobile.productionSetup.catalogTemplate.reviewModifications')}
          disabled={reviewDisabled || reviewing}
          onPress={onMarkReviewed}
        />
      ) : null}
    </DealerBoard>
  );
}
