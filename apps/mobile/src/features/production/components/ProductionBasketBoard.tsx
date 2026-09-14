import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import {
  productionFloorStatusLabel,
  type ProductionBasketBoardModel,
} from '../selectProduction';
import { ProductionOriginChip } from './ProductionOriginChip';
import { ProductionBasketItemRow } from './ProductionBasketItemRow';

type Props = {
  board: ProductionBasketBoardModel;
  onPressDetails: () => void;
  onPressItem: (itemId: string) => void;
};

/**
 * One commercial order board — same parchment recipe for day and all-time.
 */
export function ProductionBasketBoard({ board, onPressDetails, onPressItem }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pct = Math.max(0, Math.min(100, Math.round(board.progressPercent || 0)));
  const late = board.isLate;
  const blocked = board.blocked;
  const accent = late || blocked ? colors.error : colors.brand;
  const dealer = board.dealerName && board.dealerName !== '—' ? board.dealerName : null;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: late || blocked ? colors.error : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
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
          opacity: late || blocked ? 0.9 : 0.55,
        }}
      />

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${board.number} ${t('common.details')}`}
        onPress={() => {
          void haptics.selection();
          onPressDetails();
        }}
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
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
          >
            {board.number}
          </AppText>
          {dealer ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ flexShrink: 1, textAlign: isRTL ? 'right' : 'left' }}
            >
              {dealer}
            </AppText>
          ) : null}
          <StatusBadge
            status={board.status}
            dot
            label={productionFloorStatusLabel(
              board.status,
              t('mobile.production.inProduction'),
            )}
          />
          {late ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.error, fontSize: 11 }}
            >
              {t('mobile.production.late')}
            </AppText>
          ) : null}
          {board.origin ? <ProductionOriginChip origin={board.origin} compact /> : null}
        </View>
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('common.details')}
        </AppText>
      </AnimatedPressable>

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
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: blocked ? colors.error : colors.border,
            overflow: 'hidden',
          }}
        >
          {dealer ? (
            <MetaRow label={t('mobile.production.dealer')} value={dealer} isRTL={isRTL} />
          ) : null}
          {board.deliveryLabel ? (
            <>
              {dealer ? <Divider compact plain style={{ marginVertical: 0 }} /> : null}
              <MetaRow
                label={t('mobile.production.deliveryDate')}
                value={board.deliveryLabel}
                isRTL={isRTL}
                tone={late ? 'error' : undefined}
              />
            </>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          {board.items.map((item) => (
            <ProductionBasketItemRow
              key={item.id}
              item={item}
              onPress={() => onPressItem(item.id)}
            />
          ))}
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 10,
                letterSpacing: locale === 'en' ? 0.45 : 0,
                textTransform: locale === 'en' ? 'uppercase' : 'none',
              }}
            >
              {t('mobile.production.basketItemsOf', {
                done: board.doneCount,
                n: board.itemCount,
              })}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{ color: accent, fontSize: 15 }}
            >
              {`${pct}%`}
            </AppText>
          </View>
          <WorkflowProgressHit
            progressPercent={pct}
            height={5}
            accessibilityLabel={t('mobile.production.progress')}
          />
        </View>
      </View>
    </View>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  tone,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  tone?: 'error';
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
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
          textTransform: locale === 'en' ? 'uppercase' : 'none',
          letterSpacing: locale === 'en' ? 0.5 : 0,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          color: tone === 'error' ? colors.error : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
