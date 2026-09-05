import { View } from 'react-native';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionInsetStyle } from '@/features/production/productionFloorStyle';
import { FloorActionRow } from '@/features/sales-orders/components/FloorActionRow';
import { planTypeLens } from '@/features/sales-orders/catalogTemplateAction';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OrderPlanCatalogTemplate } from '@/api/modules/production';

type Props = {
  catalogTemplate: OrderPlanCatalogTemplate;
  onUsePlan: () => void;
  usePlanDisabled?: boolean;
};

/**
 * Type context at the top of the Production Plan desk.
 * STANDARD / MODIFIED: optional catalog accelerator. CUSTOM: manual plan only.
 */
export function StandardProductPlanBoard({
  catalogTemplate,
  onUsePlan,
  usePlanDisabled,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const lens = planTypeLens(catalogTemplate.manufacturingComplexity);
  const productName =
    localizedName(
      locale,
      {
        nameEn: catalogTemplate.product?.nameEn ?? null,
        nameAr: catalogTemplate.product?.nameAr ?? null,
        nameHe: catalogTemplate.product?.nameHe ?? null,
      },
      catalogTemplate.product?.sku ?? '',
    ) || catalogTemplate.product?.nameEn || '—';
  const qty = catalogTemplate.quantity ?? 0;
  const sku = catalogTemplate.product?.sku?.trim() || null;
  const showAction = catalogTemplate.actionAvailable && !usePlanDisabled && lens !== 'custom';
  const titleKey =
    lens === 'custom'
      ? 'mobile.productionSetup.catalogTemplate.customProduct'
      : lens === 'modified'
        ? 'mobile.productionSetup.catalogTemplate.modifiedProduct'
        : 'mobile.productionSetup.catalogTemplate.standardProduct';
  const accent = lens === 'modified' ? colors.warning : colors.brand;

  return (
    <DealerBoard
      title={t(titleKey)}
      titleWeight={titleWeight}
      accentColor={accent}
      trailing={
        <View
          style={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: theme.radius.lg,
            backgroundColor: lens === 'modified' ? colors.warningSoft : colors.brandSoft,
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          <AppText variant="caption" weight={titleWeight} style={{ color: accent }}>
            {t(`mobile.orders.journey.kind.${lens}`)}
          </AppText>
        </View>
      }
    >
      <View
        style={{
          ...productionInsetStyle(theme, colors),
          gap: theme.spacing.sm,
        }}
      >
        {lens === 'custom' ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.productionSetup.catalogTemplate.customManual')}
          </AppText>
        ) : (
          <>
            <AppText variant="heading" weight={titleWeight}>
              {qty > 1 ? `${productName} ×${qty}` : productName}
            </AppText>
            {sku ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {t('mobile.productionSetup.catalogTemplate.sku', { sku })}
              </AppText>
            ) : null}
            <AppText variant="caption" color="secondary">
              {lens === 'modified'
                ? t('mobile.productionSetup.catalogTemplate.basedOnProduct', { name: productName })
                : t('mobile.productionSetup.catalogTemplate.basedOnFactoryCatalog')}
            </AppText>
            {lens === 'modified' ? (
              <AppText variant="caption" color="secondary">
                {t('mobile.productionSetup.catalogTemplate.modifiedBaseline')}
              </AppText>
            ) : null}
            <AppText variant="label" weight={titleWeight} color="brand">
              {catalogTemplate.hasUsableDefinition
                ? t('mobile.productionSetup.catalogTemplate.planAvailable')
                : t('mobile.productionSetup.catalogTemplate.noSavedPlan')}
            </AppText>
            {catalogTemplate.requestedFabricLabel ? (
              <View style={{ gap: 4 }}>
                <AppText variant="caption" color="muted">
                  {t('mobile.productionSetup.requestedFabric')}
                </AppText>
                <AppText variant="label" weight={titleWeight}>
                  {catalogTemplate.requestedFabricLabel}
                </AppText>
                {catalogTemplate.requestedFabricNeedsReview ? (
                  <AppText variant="caption" color="secondary">
                    {t('mobile.productionSetup.catalogTemplate.inventoryMaterial')}
                    {isRTL ? ' — ' : ': '}
                    {t('mobile.productionSetup.needsReview')}
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </View>
      {showAction ? (
        <FloorActionRow
          label={t('mobile.productionSetup.catalogTemplate.usePlan')}
          onPress={onUsePlan}
        />
      ) : null}
    </DealerBoard>
  );
}
