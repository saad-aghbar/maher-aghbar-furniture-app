import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { OrderCardMedia } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  selectAtRiskActionKey,
  selectAtRiskReasonKey,
  selectAtRiskStatusKey,
  selectDaysLate,
  type AdminScheduleCardModel,
} from '../selectAdminScheduling';

const MEDIA = 76;

export function atRiskTone(status?: string | null): 'late' | 'risk' | 'blocked' {
  if (status === 'LATE') return 'late';
  if (status === 'BLOCKED') return 'blocked';
  return 'risk';
}

export function atRiskIcon(status?: string | null): keyof typeof Ionicons.glyphMap {
  if (status === 'LATE') return 'time-outline';
  if (status === 'BLOCKED') return 'ban-outline';
  return 'warning-outline';
}

export function atRiskActionIcon(action?: string | null): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case 'RECALCULATE':
      return 'refresh-outline';
    case 'REVIEW_ESTIMATES':
      return 'create-outline';
    case 'VIEW_PRODUCTION':
      return 'layers-outline';
    case 'MANAGE_WORKERS':
      return 'people-outline';
    case 'REVIEW_COMMITMENT':
      return 'calendar-outline';
    case 'VIEW_MATERIALS':
      return 'cube-outline';
    default:
      return 'arrow-forward-outline';
  }
}

type Props = {
  card: AdminScheduleCardModel;
  onPress: () => void;
  onAction?: () => void;
  canAct?: boolean;
};

export function AtRiskOrderCard({ card, onPress, onAction, canAct }: Props) {
  const { t, tPlural, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const tone = atRiskTone(card.riskStatus);
  const accent = tone === 'risk' ? colors.warning : colors.error;
  const wash = tone === 'risk' ? colors.warningSoft : colors.errorSoft;
  const productTitle = card.title !== card.number ? card.title : card.number;
  const promisedIso = card.committedDeliveryDate ?? card.requiredDeliveryDate;
  const projectedIso =
    card.projectedCompletion ?? card.earliestAvailableDate ?? card.suggestedDeliveryDate;
  const daysLate = selectDaysLate(promisedIso, projectedIso);
  const statusLabel = t(selectAtRiskStatusKey(card.riskStatus));
  const reasonLabel = t(selectAtRiskReasonKey(card));
  const actionLabel = t(selectAtRiskActionKey(card.recommendedAction));
  const showAction = Boolean(canAct && onAction && card.recommendedAction && card.recommendedAction !== 'NONE');

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: accent,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.adminScheduling.atRisk.a11yCard', {
        number: card.number,
        status: statusLabel,
        projected: projectedIso ? formatDate(projectedIso) : t('mobile.adminScheduling.atRisk.noProjected'),
        committed: promisedIso ? formatDate(promisedIso) : t('mobile.adminScheduling.atRisk.noProjected'),
        reason: reasonLabel,
      })}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 4,
          backgroundColor: accent,
        }}
      />

      <View
        style={{
          height: 4,
          backgroundColor: wash,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: accent,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL ? { paddingRight: theme.spacing.md + 6 } : { paddingLeft: theme.spacing.md + 6 }),
        }}
      >
        <OrderCardMedia imageUrl={card.imageUrl} size={MEDIA} />
        <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              width: '100%',
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ flex: 1, fontSize: 16, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' }}
            >
              {productTitle}
            </AppText>
            {card.status ? <StatusBadge status={card.status} dot /> : null}
          </View>
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir="ltr"
            style={{ letterSpacing: 0.4, fontVariant: ['tabular-nums'] }}
          >
            {card.number}
          </AppText>
          {card.dealerName ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {card.dealerName}
            </AppText>
          ) : null}
        </View>
      </View>

      <View
        style={{
          marginTop: theme.spacing.md,
          marginHorizontal: theme.spacing.md,
          ...(isRTL ? { marginRight: theme.spacing.md + 6 } : { marginLeft: theme.spacing.md + 6 }),
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: theme.radius.full,
            backgroundColor: wash,
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          <Ionicons name={atRiskIcon(card.riskStatus)} size={13} color={accent} />
          <AppText variant="caption" weight="semibold" style={{ color: accent, fontSize: 12 }}>
            {statusLabel}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <DateTile
            label={t('mobile.adminScheduling.atRisk.promised')}
            value={promisedIso ? formatDate(promisedIso) : '—'}
            empty={!promisedIso}
          />
          <DateTile
            label={t('mobile.adminScheduling.dates.projectedCompletion')}
            value={
              projectedIso
                ? formatDate(projectedIso)
                : t('mobile.adminScheduling.atRisk.noProjected')
            }
            empty={!projectedIso}
            emphasis
          />
        </View>

        {daysLate != null ? (
          <View
            style={{
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: theme.radius.full,
              backgroundColor: colors.errorSoft,
            }}
          >
            <AppText variant="caption" weight="semibold" style={{ color: colors.error, fontSize: 11 }}>
              {tPlural('mobile.adminScheduling.atRisk.daysLate', daysLate)}
            </AppText>
          </View>
        ) : null}

        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
        >
          {reasonLabel}
        </AppText>
      </View>
      {showAction ? null : <View style={{ height: theme.spacing.md }} />}
    </AnimatedPressable>
      {showAction ? (
        <View
          style={{
            marginTop: theme.spacing.md,
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.md,
            ...(isRTL ? { marginRight: theme.spacing.md + 6 } : { marginLeft: theme.spacing.md + 6 }),
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={() => {
              void haptics.selection();
              onAction?.();
            }}
            style={{
              minHeight: 40,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.full,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <Ionicons name={atRiskActionIcon(card.recommendedAction)} size={15} color={colors.brand} />
            <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
              {actionLabel}
            </AppText>
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );
}

function DateTile({
  label,
  value,
  empty,
  emphasis,
}: {
  label: string;
  value: string;
  empty?: boolean;
  emphasis?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 10,
        borderRadius: theme.radius.lg,
        backgroundColor: emphasis ? colors.surfaceSecondary : colors.background,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        gap: 4,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
      }}
    >
      <AppText variant="caption" color="muted" numberOfLines={1} style={{ fontSize: 10, letterSpacing: 0.3 }}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="semibold"
        dir="ltr"
        numberOfLines={1}
        style={{
          color: empty ? colors.textMuted : colors.textPrimary,
          fontSize: 13,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
