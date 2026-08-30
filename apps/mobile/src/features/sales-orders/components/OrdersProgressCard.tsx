import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DirectionalIcon } from '@/components/DirectionalIcon';
import { StatusBadge } from '@/components/badges/StatusBadge';
import {
  alignStart,
  extraStartPadding,
  localeRow,
  pinStart,
  useLocale,
} from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import {
  chipsLookLikeSameLabel,
  humanizeOrderChip,
  normalizeChipKey,
} from '../humanizeOrderChip';
import { resolveOrderMediaUri } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

export type OrdersProgressCardModel = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel?: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  dealerId?: string;
  dealerName?: string;
  sellerPrice?: number | null;
  kind?: 'order' | 'rfq';
  priority?: string;
};

type Props = {
  order: OrdersProgressCardModel;
  variant: 'admin' | 'dealer';
  onPress: () => void;
  onProgressPress?: () => void;
};

const MEDIA = 80;

function resolveOrderChips(
  order: OrdersProgressCardModel,
  locale: string,
  t: (key: string) => string,
) {
  const statusLabel = humanizeOrderChip(locale, order.status);
  const stageRaw = order.progressLabel?.trim() || '';
  const showStage =
    Boolean(stageRaw) && !chipsLookLikeSameLabel(stageRaw, order.status);
  const stageKey = showStage ? normalizeChipKey(stageRaw) || order.status : '';
  const stageLabel = showStage ? humanizeOrderChip(locale, stageRaw) : '';

  return {
    statusLabel,
    stageKey,
    stageLabel,
    progressCaption: stageLabel || t('mobile.orders.progress'),
  };
}

/**
 * Floor-list order card — cream board, humanized pills, directional chevron.
 */
export function OrdersProgressCard({ order, variant, onPress, onProgressPress }: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const urgent =
    (order.priority ?? '').toUpperCase() === 'URGENT' ||
    (order.priority ?? '').toUpperCase() === 'HIGH';
  const accent = urgent ? colors.warning : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const chips = resolveOrderChips(order, locale, t);
  const idLine =
    order.kind === 'rfq'
      ? variant === 'dealer'
        ? t('mobile.orders.rfqLabel')
        : `${t('mobile.orders.unapprovedLabel')} · ${order.number}`
      : order.number;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${order.number} ${order.title} ${pct}%`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: urgent ? colors.warning : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        marginBottom: theme.spacing.sm,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...pinStart(isRTL),
          width: 3,
          backgroundColor: accent,
          opacity: urgent ? 1 : 0.5,
        }}
      />

      <View
        style={{
          flexDirection: localeRow(isRTL),
          gap: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...extraStartPadding(isRTL, theme.spacing.md + 4),
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{
            width: MEDIA,
            height: MEDIA,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {resolveOrderMediaUri(order.imageUrl) ? (
            <Image
              source={{ uri: resolveOrderMediaUri(order.imageUrl)! }}
              style={{ width: MEDIA, height: MEDIA }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons name="cube-outline" size={28} color={colors.brand} />
          )}
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 4,
            alignItems: alignStart(isRTL),
          }}
        >
          {variant === 'admin' && order.dealerName ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              align="start"
              style={{
                width: '100%',
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              {order.dealerName}
            </AppText>
          ) : null}

          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={2}
            align="start"
            style={{ width: '100%' }}
          >
            {order.title}
          </AppText>

          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir={order.kind === 'rfq' && variant === 'dealer' ? 'auto' : 'ltr'}
            align="start"
            style={{ letterSpacing: 0.2 }}
          >
            {idLine}
          </AppText>

          <View
            style={{
              flexDirection: localeRow(isRTL),
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              width: '100%',
              marginTop: 2,
            }}
          >
            <StatusBadge
              status={order.status}
              label={chips.statusLabel}
              ink="board"
              dot
            />
            {chips.stageLabel ? (
              <StatusBadge
                status={chips.stageKey || order.status}
                label={chips.stageLabel}
                ink="board"
              />
            ) : null}
          </View>

          {variant === 'dealer' && order.sellerPrice != null ? (
            <AppText
              variant="caption"
              color="muted"
              dir="ltr"
              align="start"
              style={{ width: '100%' }}
            >
              {formatCurrency(order.sellerPrice)}
            </AppText>
          ) : null}
          {order.deliveryDate ? (
            <AppText variant="caption" color="muted" align="start" style={{ width: '100%' }}>
              {formatDate(order.deliveryDate)}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            alignSelf: 'center',
            width: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DirectionalIcon>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </DirectionalIcon>
        </View>
      </View>

      <View
        style={{
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          gap: theme.spacing.xs,
        }}
      >
        <View
          style={{
            flexDirection: localeRow(isRTL),
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {chips.progressCaption}
          </AppText>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: accent }}
            dir="ltr"
          >
            {`${pct}%`}
          </AppText>
        </View>
        <WorkflowProgressHit
          progressPercent={pct}
          height={5}
          accessibilityLabel={
            onProgressPress ? t('mobile.productionFlow.openWorkflow') : undefined
          }
          onPress={
            onProgressPress
              ? () => {
                  void haptics.selection();
                  onProgressPress();
                }
              : undefined
          }
        />
      </View>
    </AnimatedPressable>
  );
}
