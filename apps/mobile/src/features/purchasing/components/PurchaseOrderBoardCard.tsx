import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { PurchaseCardModel } from '../selectPurchase';

type Props = {
  order: PurchaseCardModel;
  onPress: () => void;
};

export function PurchaseOrderBoardCard({ order, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={order.number}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
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
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
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
        <StatusBadge status={order.status} dot />
        <AppText variant="caption" color="brand" weight="semibold">
          {t('common.details')}
        </AppText>
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
        <View style={{ gap: 4 }}>
          <AppText
            variant="label"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
          >
            {order.number}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
          >
            {order.supplierName}
          </AppText>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <MetaRow
            label={t('catalog.linesShort')}
            value={String(order.lineCount)}
            valueLtr
            isRTL={isRTL}
          />
          <Divider compact />
          <MetaRow
            label={t('catalog.warehouseShort')}
            value={order.warehouseLabel ?? '—'}
            isRTL={isRTL}
            multiline
          />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ gap: 2, flex: 1 }}>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('catalog.totalShort')}
            </AppText>
            {order.expectedLabel ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
              >
                {order.expectedLabel}
              </AppText>
            ) : null}
          </View>
          <AppText
            weight="semibold"
            dir="ltr"
            style={{ fontSize: 16, textAlign: isRTL ? 'left' : 'right' }}
          >
            {`${order.totalLabel} JOD`}
          </AppText>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  valueLtr,
  multiline,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  multiline?: boolean;
}) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
          paddingTop: multiline ? 2 : 0,
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={multiline ? 3 : 1}
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          lineHeight: multiline ? 20 : undefined,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
