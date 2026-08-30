import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { OrderProductionSetupLine } from '../../api';
import { OrderCardMedia } from '../../components/OrderCardMedia';
import { orderBoardShadow } from '../../components/orderFloorStyle';
import {
  complexityBadgeKey,
  formatDim,
  lineDisplayName,
  materialStatusKey,
} from '../labels';

type Props = {
  line: OrderProductionSetupLine;
  onPress: () => void;
  index?: number;
};

export function SetupLineCard({ line, onPress, index = 0 }: Props) {
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const complexity = complexityBadgeKey(line.manufacturingComplexity);
  const materialKey = materialStatusKey(line.materialStatus);
  const title = lineDisplayName(line, locale);
  const issueCount = line.issues?.length ?? 0;
  const changes = line.changesFromCatalog ?? line.changes ?? [];
  const changeCount = changes.length;
  const dims = line.orderDimensions;
  const fabricName =
    line.fabric?.selected?.displayName?.trim() ||
    line.fabric?.requestedLabel?.trim() ||
    line.requestedFabricLabel?.trim() ||
    null;
  const materialCount = line.materials?.length ?? 0;
  const shortage =
    materialKey === 'SHORTAGE' ||
    (line.fabric?.shortageQty != null && line.fabric.shortageQty > 0);
  const estimate = line.estimatedCostSummary;
  const estimateLabel =
    estimate?.costAvailable && estimate.totalEstimated != null
      ? formatCurrency(estimate.totalEstimated)
      : t('mobile.productionSetup.cost.unavailable');

  const complexityLabel = t(`mobile.productionSetup.complexity.${complexity}`);
  const materialLabel = t(`mobile.productionSetup.materialStatus.${materialKey}`);
  const lineStatusLabel = t(
    `mobile.productionSetup.lineStatus.${String(line.status).toUpperCase()}`,
  );

  const complexityAccent =
    complexity === 'custom'
      ? colors.warning
      : complexity === 'modified'
        ? colors.info
        : colors.brand;

  const dimParts = [
    dims?.width != null ? formatDim(dims.width) : null,
    dims?.height != null ? formatDim(dims.height) : null,
    dims?.depth != null ? formatDim(dims.depth) : null,
  ].filter((x): x is string => Boolean(x) && x !== '—');

  return (
    <AnimatedPressable
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          alignItems: 'flex-start',
        }}
      >
        <OrderCardMedia imageUrl={line.product?.imageUrl ?? null} size={72} />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: theme.radius.sm,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: complexityAccent,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: complexityAccent, fontSize: 11 }}
              >
                {complexityLabel}
              </AppText>
            </View>
            <StatusBadge
              status={String(line.status)}
              label={
                lineStatusLabel.startsWith('mobile.')
                  ? String(line.status)
                  : lineStatusLabel
              }
            />
          </View>
          <AppText variant="label" weight="semibold" numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="caption" color="secondary" dir="ltr">
            {t('mobile.orderDetail.qty')}: {line.quantity}
            {line.product?.sku ? ` · ${line.product.sku}` : ''}
            {dimParts.length ? ` · ${dimParts.join('×')} cm` : ''}
          </AppText>
          {changeCount > 0 ? (
            <AppText variant="caption" style={{ color: colors.info }}>
              {t('mobile.productionSetup.changesCount', { n: changeCount })}
            </AppText>
          ) : null}
          {fabricName ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {t('mobile.productionSetup.sections.fabric')}: {fabricName}
            </AppText>
          ) : null}
          <AppText
            variant="caption"
            style={{
              color: shortage
                ? colors.warning
                : materialKey === 'READY'
                  ? colors.success
                  : colors.textMuted,
            }}
          >
            {t('mobile.productionSetup.materialsCount', { n: materialCount })}
            {' · '}
            {materialLabel.startsWith('mobile.') ? materialKey : materialLabel}
            {shortage ? ` · ${t('mobile.productionSetup.shortage')}` : ''}
          </AppText>
          <AppText variant="caption" weight="semibold" dir="ltr">
            {t('mobile.productionSetup.cost.estimatedShort')}: {estimateLabel}
          </AppText>
          {issueCount > 0 ? (
            <AppText variant="caption" style={{ color: colors.warning }}>
              {t('mobile.productionSetup.issueCount', { n: issueCount })}
            </AppText>
          ) : null}
          <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
            {t('mobile.productionSetup.openSetup')}
          </AppText>
        </View>
      </View>
      {index >= 0 ? null : null}
    </AnimatedPressable>
  );
}
