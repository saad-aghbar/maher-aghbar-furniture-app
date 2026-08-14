import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ProductionMaterialLine } from '../api';

type Props = {
  materials: ProductionMaterialLine[];
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
  const { colors, theme } = useTheme();
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
          opacity: canReturn ? 0.85 : 0.4,
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
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name="cube-outline"
              size={18}
              color={canReturn ? colors.warning : colors.success}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="body" weight={titleWeight} numberOfLines={2}>
              {name}
            </AppText>
            {meta ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {meta}
              </AppText>
            ) : null}
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
          />
        ) : null}
      </View>
    </View>
  );
}

export function ProductionMaterialsCard({
  materials,
  returningItemId,
  onReturn,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <SurfaceCard style={{ gap: theme.spacing.md }}>
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
        <View style={{ flex: 1 }}>
          <AppText variant="heading" weight={titleWeight}>
            {t('mobile.production.materials')}
          </AppText>
        </View>
        <View
          style={{
            minWidth: 28,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <AppText variant="caption" weight="semibold" dir="ltr">
            {materials.length}
          </AppText>
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {materials.map((row) => (
          <MaterialRow
            key={row.inventoryItem.id}
            row={row}
            returning={returningItemId === row.inventoryItem.id}
            onReturn={() => onReturn(row)}
          />
        ))}
      </View>
    </SurfaceCard>
  );
}
