import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type {
  ProductionMaterialLine,
  ProductionMaterialTransaction,
} from '../api';
import {
  productionBoardShadow,
  productionSectionLabelStyle,
} from '../productionFloorStyle';

type Props = {
  materials: ProductionMaterialLine[];
  transactions?: ProductionMaterialTransaction[];
  returningItemId?: string | null;
  onReturn: (row: ProductionMaterialLine) => void;
};

function MetricCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  const { theme } = useTheme();

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
        color={emphasize ? 'brand' : 'primary'}
      >
        {value}
      </AppText>
      <AppText
        variant="caption"
        color={emphasize ? 'brand' : 'muted'}
        align="center"
        numberOfLines={2}
      >
        {label}
      </AppText>
    </View>
  );
}

function MetricRule() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: colors.border,
        marginVertical: 4,
      }}
    />
  );
}

const MEDIA = 56;

function MaterialRow({
  row,
  returning,
  onReturn,
}: {
  row: ProductionMaterialLine;
  returning: boolean;
  onReturn: () => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, row.inventoryItem);
  const canReturn = row.returnableQty > 0;
  const accent = canReturn ? colors.warning : colors.success;
  const sku = row.inventoryItem.sku?.trim();
  const unit = row.inventoryItem.unit?.trim();
  const meta = [sku, unit].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: canReturn ? colors.warning : colors.borderStrong,
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
          opacity: canReturn ? 0.9 : 0.55,
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
          {canReturn
            ? t('mobile.production.returnableQty')
            : t('mobile.production.usageStatusOnTarget')}
        </AppText>
        {sku ? (
          <AppText variant="caption" color="muted" weight={titleWeight} dir="ltr" numberOfLines={1}>
            {sku}
          </AppText>
        ) : null}
      </View>

      <View
        style={{
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
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
          <InventorySkuThumb uri={row.inventoryItem.imageUrl} size={MEDIA} rounded="lg" />
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
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xs,
          }}
        >
          <MetricCell label={t('mobile.production.issuedQty')} value={row.issuedQty} />
          <MetricRule />
          <MetricCell label={t('mobile.production.returnedQty')} value={row.returnedQty} />
          <MetricRule />
          <MetricCell
            label={t('mobile.production.returnableQty')}
            value={row.returnableQty}
            emphasize={canReturn}
          />
        </View>

        {canReturn ? (
          <SecondaryButton
            label={t('mobile.production.returnUnused')}
            loading={returning}
            haptic="medium"
            leading={
              returning ? undefined : (
                <Ionicons name="return-down-back-outline" size={18} color={colors.brand} />
              )
            }
            onPress={onReturn}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function txTypeLabel(type: string, t: (key: string) => string): string {
  if (type === 'PRODUCTION_ISSUE') return t('mobile.production.txIssue');
  if (type === 'PRODUCTION_RETURN') return t('mobile.production.txReturn');
  return type.replace(/_/g, ' ');
}

export function ProductionMaterialsCard({
  materials,
  transactions = [],
  returningItemId,
  onReturn,
}: Props) {
  const { t, locale, isRTL, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const ledger = transactions
    .filter((tx) => tx.type === 'PRODUCTION_ISSUE' || tx.type === 'PRODUCTION_RETURN')
    .slice()
    .reverse()
    .slice(0, 12);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <DealerBoard
        title={t('mobile.production.materials')}
        titleWeight={titleWeight}
        trailing={
          <AppText variant="caption" weight={titleWeight} dir="ltr" style={{ color: colors.brand }}>
            {materials.length}
          </AppText>
        }
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={productionSectionLabelStyle(locale, colors.brand)}
        >
          {t('mobile.production.hubMaterialsEyebrow')}
        </AppText>
      </DealerBoard>

      {materials.length === 0 ? (
        <DealerEmptyPanel
          icon="layers-outline"
          text={`${t('mobile.production.materialsEmptyTitle')}. ${t('mobile.production.materialsEmptyBody')}`}
        />
      ) : (
        materials.map((row) => (
          <MaterialRow
            key={row.inventoryItem.id}
            row={row}
            returning={returningItemId === row.inventoryItem.id}
            onReturn={() => onReturn(row)}
          />
        ))
      )}

      <DealerBoard title={t('mobile.production.materialsLedger')} titleWeight={titleWeight}>
        {ledger.length === 0 ? (
          <AppText variant="caption" color="muted">
            {t('mobile.production.materialsLedgerEmpty')}
          </AppText>
        ) : (
          ledger.map((tx) => {
            const name = localizedName(locale, tx.inventoryItem);
            const qty = Math.abs(Number(tx.quantity));
            const issue = tx.type === 'PRODUCTION_ISSUE';
            return (
              <View
                key={tx.id}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="caption" weight={titleWeight} numberOfLines={1}>
                    {txTypeLabel(tx.type, t)}
                    {' · '}
                    {name}
                  </AppText>
                  <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
                    {tx.number}
                    {tx.createdAt ? ` · ${formatDateTime(tx.createdAt)}` : ''}
                  </AppText>
                </View>
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: issue ? colors.warning : colors.success }}
                >
                  {issue ? `−${qty}` : `+${qty}`}
                </AppText>
              </View>
            );
          })
        )}
      </DealerBoard>
    </View>
  );
}
