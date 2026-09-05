import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { SetupLineFabric } from '../../api';
import {
  OrderBoardCard,
  OrderSectionHeader,
} from '../../components/OrderBoardCard';

type Props = {
  fabric?: SetupLineFabric | null;
  requestedFabricLabel?: string | null;
  editable: boolean;
  onPickFabric?: () => void;
};

export function SetupFabricSection({
  fabric,
  requestedFabricLabel,
  editable,
  onPickFabric,
}: Props) {
  const { t, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();

  const requested =
    fabric?.requestedLabel?.trim() || requestedFabricLabel?.trim() || null;
  const selected = fabric?.selected ?? null;
  const selectedName =
    selected?.displayName?.trim() ||
    selected?.inventoryItem?.nameEn?.trim() ||
    null;
  const selectedSku = selected?.sku?.trim() || selected?.inventoryItem?.sku || null;
  const expectedQty = fabric?.expectedQty ?? selected?.expectedQty ?? null;
  const availableQty = fabric?.availableQty ?? selected?.availability?.available ?? null;
  const shortageQty = fabric?.shortageQty ?? selected?.availability?.short ?? null;
  const imageUrl =
    fabric?.imageUrl ?? selected?.inventoryItem?.imageUrl ?? null;
  const unitCost = fabric?.unitCost ?? selected?.unitCost ?? null;
  const unitCostAvailable =
    fabric?.unitCostAvailable ?? selected?.costAvailable ?? unitCost != null;
  const hasShortage = shortageQty != null && shortageQty > 0;

  return (
    <OrderBoardCard accent={colors.brand}>
      <OrderSectionHeader
        icon="color-palette-outline"
        label={t('mobile.productionSetup.sections.fabric')}
        accent={colors.brand}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          alignItems: 'flex-start',
        }}
      >
        <ProductThumb uri={imageUrl} size={64} radius={theme.radius.md} />
        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.fabric.requested')}
            </AppText>
            <AppText variant="label" weight="semibold" numberOfLines={2}>
              {requested ?? '—'}
            </AppText>
          </View>

          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.fabric.selected')}
            </AppText>
            <AppText variant="label" weight="semibold" numberOfLines={2}>
              {selectedName ?? '—'}
            </AppText>
            {selectedSku ? (
              <AppText variant="caption" color="secondary" dir="ltr">
                {selectedSku}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
        }}
      >
        <Metric
          label={t('mobile.productionSetup.fabric.expectedQty')}
          value={expectedQty != null && expectedQty > 0 ? String(expectedQty) : '—'}
        />
        <Metric
          label={t('mobile.productionSetup.fabric.available')}
          value={availableQty != null ? String(availableQty) : '—'}
        />
        <Metric
          label={t('mobile.productionSetup.shortage')}
          value={hasShortage ? String(shortageQty) : '—'}
          warn={hasShortage}
        />
        <Metric
          label={t('mobile.productionSetup.cost.unit')}
          value={
            unitCostAvailable && unitCost != null
              ? formatCurrency(unitCost)
              : t('mobile.productionSetup.cost.unavailable')
          }
        />
      </View>

      {fabric?.notes ? (
        <AppText variant="caption" color="secondary">
          {fabric.notes}
        </AppText>
      ) : null}

      {editable && onPickFabric ? (
        <SecondaryButton
          label={t('mobile.productionSetup.fabric.pick')}
          onPress={onPickFabric}
        />
      ) : null}
    </OrderBoardCard>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        minWidth: 88,
        gap: 2,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: warn ? colors.warning : colors.border,
      }}
    >
      <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
        {label}
      </AppText>
      <AppText
        variant="label"
        weight="semibold"
        dir="ltr"
        style={warn ? { color: colors.warning } : undefined}
      >
        {value}
      </AppText>
    </View>
  );
}
